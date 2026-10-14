/**
 * Enhanced Telegram Bot Service for Business OS
 * Features:
 * - Free Telegram Bot HTTP API with long-polling (or webhooks).
 * - Multi-tenant isolation.
 * - Secure account linking with short-lived single-use tokens.
 * - Dynamic role-based menus (Owner/Admin, Employee, Customer, Guest).
 * - Conversational multi-step flows with timeouts and cancellation:
 *    * Apply for Leave
 *    * Update Task Status
 *    * Book Appointment
 *    * Reschedule / Cancel Appointment
 *    * Contact Staff / Human Escalation
 * - Real-time business data inspection.
 * - Zero paid AI dependencies.
 */

import crypto from "crypto";
import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Employee from "../models/employee.model.js";
import Customer from "../models/customer.model.js";
import Invoice from "../models/invoice.model.js";
import Appointment from "../models/appointment.model.js";
import Task from "../models/task.model.js";
import Inventory from "../models/inventory.model.js";
import Leave from "../models/leave.model.js";
import LeavePolicy from "../models/LeavePolicy.js";
import Attendance from "../models/attendance.model.js";
import Notification from "../models/notification.model.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

// Track active polling loops per bot token:
// { [botToken]: { timer: timeoutId, running: boolean, offset: number, tenantId: string } }
const activePollingBots = new Map();

// In-memory conversation state machine per chatId:
// { [chatId]: { flow: string, step: string, data: object, expiresAt: number } }
const userSessions = new Map();

/**
 * Make an HTTP request to Telegram Bot API
 */
async function callTelegramApi(token, method, payload = {}) {
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await response.json();
}

/**
 * Validate bot token with Telegram's getMe API
 */
export async function verifyTelegramBotToken(token) {
  try {
    const data = await callTelegramApi(token, "getMe");
    if (data.ok && data.result) {
      return {
        valid: true,
        bot: {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
        },
      };
    }
    return {
      valid: false,
      error: data.description || "Invalid Bot Token provided.",
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message || "Failed to reach Telegram API server.",
    };
  }
}

/**
 * Send message with optional inline keyboard buttons
 */
export async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  return await callTelegramApi(token, "sendMessage", payload);
}

/**
 * Edit message text and inline keyboard (for smooth in-chat transitions)
 */
export async function editTelegramMessage(token, chatId, messageId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  return await callTelegramApi(token, "editMessageText", payload);
}

/**
 * Answer callback query to dismiss loading clock in Telegram UI
 */
export async function answerCallbackQuery(token, callbackQueryId, text = null) {
  const payload = { callback_query_id: callbackQueryId };
  if (text) payload.text = text;
  return await callTelegramApi(token, "answerCallbackQuery", payload);
}

// =========================================================================
// ACCOUNT LINKING & AUTHENTICATION
// =========================================================================

/**
 * Generate a short-lived single-use linking token for a User
 */
export async function generateUserLinkToken(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const rawCode = `TG-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  user.telegramLinkToken = rawCode;
  user.telegramLinkTokenExpires = expires;
  await user.save();

  return {
    code: rawCode,
    expiresAt: expires,
  };
}

/**
 * Unlink a user's Telegram account
 */
export async function unlinkTelegramAccount(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.telegramChatId = "";
  user.telegramUsername = "";
  user.telegramLinked = false;
  user.telegramLinkedAt = null;
  user.telegramLinkToken = "";
  user.telegramLinkTokenExpires = null;
  await user.save();

  // Also sync Employee model if relevant
  if (user.employeeId || user.email) {
    await Employee.findOneAndUpdate(
      {
        tenantId: user.tenantId,
        $or: [{ employeeId: user.employeeId }, { email: user.email }],
      },
      { $set: { telegramChatId: "", telegramUsername: "" } }
    );
  }

  return true;
}

/**
 * Resolve user profile and role by Telegram chatId
 */
async function resolveUserProfile(tenantId, chatId) {
  if (!chatId) return { type: "GUEST", role: "GUEST" };

  // 1. Check User model
  const user = await User.findOne({
    tenantId,
    telegramChatId: String(chatId),
    telegramLinked: true,
  });

  if (user) {
    const isOwnerOrAdmin = ["OWNER", "ADMIN", "MANAGER"].includes(user.role);
    return {
      type: isOwnerOrAdmin ? "ADMIN" : "EMPLOYEE",
      role: user.role,
      user,
      name: user.name || "User",
      email: user.email,
    };
  }

  // 2. Check Employee model directly
  const emp = await Employee.findOne({
    tenantId,
    telegramChatId: String(chatId),
  });

  if (emp) {
    return {
      type: "EMPLOYEE",
      role: "EMPLOYEE",
      employee: emp,
      name: emp.name,
      email: emp.email,
    };
  }

  // 3. Check Customer model
  const customer = await Customer.findOne({
    tenantId,
    telegramChatId: String(chatId),
  });

  if (customer) {
    return {
      type: "CUSTOMER",
      role: "CUSTOMER",
      customer,
      name: customer.name,
      email: customer.email,
    };
  }

  return { type: "GUEST", role: "GUEST" };
}

// =========================================================================
// ROLE-BASED DYNAMIC MENUS
// =========================================================================

/**
 * Generate Main Menu tailored to the user's role
 */
async function getRoleBasedMenu(tenantId, chatId, companyName) {
  const profile = await resolveUserProfile(tenantId, chatId);

  if (profile.type === "ADMIN") {
    const text =
      `👔 *Welcome, ${profile.name} (Administrator)*\n` +
      `_Business OS Command Center - ${companyName}_\n\n` +
      `Select an administrative action below:`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "📊 Operations Overview", callback_data: "admin_overview" },
          { text: "📅 Today's Schedule", callback_data: "admin_appointments" },
        ],
        [
          { text: "🧾 Outstanding Invoices", callback_data: "admin_invoices" },
          { text: "⚠️ Low Stock Alerts", callback_data: "admin_inventory" },
        ],
        [
          { text: "📋 Pending Tasks", callback_data: "admin_tasks" },
          { text: "📈 Executive Summary", callback_data: "admin_summary" },
        ],
        [
          { text: "⚙️ Notification Prefs", callback_data: "admin_prefs" },
          { text: "🔓 Unlink Account", callback_data: "account_unlink" },
        ],
      ],
    };
    return { text, replyMarkup };
  }

  if (profile.type === "EMPLOYEE") {
    const text =
      `👷 *Welcome, ${profile.name} (Staff Portal)*\n` +
      `_Company: ${companyName}_\n\n` +
      `Manage your assigned work and attendance:`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "📋 My Tasks", callback_data: "emp_tasks" },
          { text: "✏️ Update Task Status", callback_data: "emp_action_update_task" },
        ],
        [
          { text: "⏱️ My Attendance", callback_data: "emp_attendance" },
          { text: "🏖️ My Leave Balance", callback_data: "emp_leave_balance" },
        ],
        [
          { text: "📝 Apply for Leave", callback_data: "emp_action_apply_leave" },
          { text: "🔍 Leave Status", callback_data: "emp_leave_status" },
        ],
        [
          { text: "❓ Staff Help", callback_data: "public_help" },
          { text: "🔓 Unlink Account", callback_data: "account_unlink" },
        ],
      ],
    };
    return { text, replyMarkup };
  }

  if (profile.type === "CUSTOMER") {
    const text =
      `👋 *Hello, ${profile.name}!*\n` +
      `_Client Self-Service - ${companyName}_\n\n` +
      `How can we help you today?`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "📅 My Appointments", callback_data: "cust_appointments" },
          { text: "⏰ Next Upcoming", callback_data: "cust_next_apt" },
        ],
        [
          { text: "🧾 My Invoices", callback_data: "cust_invoices" },
          { text: "💳 Payment Status", callback_data: "cust_payment_status" },
        ],
        [
          { text: "📆 Book Appointment", callback_data: "action_book_apt" },
          { text: "🔄 Reschedule / Cancel", callback_data: "cust_manage_apt" },
        ],
        [
          { text: "💬 Contact Business", callback_data: "public_contact" },
          { text: "🔓 Unlink Account", callback_data: "account_unlink" },
        ],
      ],
    };
    return { text, replyMarkup };
  }

  // Guest / Unlinked Menu
  const text =
    `👋 *Welcome to ${companyName} Assistant!*\n\n` +
    `I am your digital concierge. Choose an option below or link your account for personal self-service:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🏢 Business Info & Hours", callback_data: "public_info" },
        { text: "🛠️ Services Offered", callback_data: "public_services" },
      ],
      [
        { text: "📆 Book an Appointment", callback_data: "action_book_apt" },
        { text: "💬 Contact Staff", callback_data: "public_contact" },
      ],
      [
        { text: "🔗 Link Business OS Account", callback_data: "public_link_prompt" },
        { text: "❓ Help", callback_data: "public_help" },
      ],
    ],
  };
  return { text, replyMarkup };
}

// =========================================================================
// DATA FETCHERS
// =========================================================================

/**
 * Admin Executive Operations Overview
 */
export async function getSummaryData(tenantId, companyName) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [invoices, appointments, tasks, lowStock] = await Promise.all([
    Invoice.find({ tenantId }).sort({ createdAt: -1 }).limit(10),
    Appointment.find({ tenantId, date: { $regex: `^${todayStr}` } }),
    Task.find({ tenantId, status: { $ne: "Completed" } }),
    Inventory.find({ tenantId, quantity: { $lte: 5 } }),
  ]);

  let totalRev = 0;
  let pendingInv = 0;
  invoices.forEach((i) => {
    totalRev += Number(i.amountPaid) || 0;
    if (i.status === "PENDING" || i.status === "PARTIAL") pendingInv++;
  });

  const text =
    `📊 *${companyName || "Business OS"} - Operations Overview*\n` +
    `_Live Snapshot: ${todayStr}_\n\n` +
    `💰 *Collected Revenue:* ₹${totalRev.toLocaleString("en-IN")}\n` +
    `🧾 *Pending / Due Invoices:* ${pendingInv}\n` +
    `📅 *Appointments Today:* ${appointments.length}\n` +
    `✅ *Open Tasks:* ${tasks.length}\n` +
    `⚠️ *Low Stock Items (<=5):* ${lowStock.length}\n\n` +
    `Select an option below for itemized records:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📅 View Today's Appointments", callback_data: "admin_appointments" },
        { text: "🧾 View Invoices", callback_data: "admin_invoices" },
      ],
      [
        { text: "🔄 Refresh", callback_data: "admin_overview" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Admin: Today's / Upcoming Appointments
 */
async function getAdminAppointments(tenantId) {
  const appointments = await Appointment.find({ tenantId }).sort({ date: 1, time: 1 }).limit(6);

  let text = `📅 *Appointment Schedule*\n\n`;
  if (!appointments || appointments.length === 0) {
    text += `_No scheduled appointments found._\n`;
  } else {
    appointments.forEach((apt, idx) => {
      text +=
        `${idx + 1}. *${apt.customer?.name || "Client"}* — ${apt.service}\n` +
        `   🗓️ ${apt.date} at ${apt.time} | Specialist: ${apt.employee || "Unassigned"}\n` +
        `   Status: *${apt.status}* | Payment: *${apt.paymentStatus}*\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "admin_appointments" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Admin: Invoices & Balances
 */
async function getAdminInvoices(tenantId) {
  const invoices = await Invoice.find({ tenantId, status: { $ne: "CANCELLED" } })
    .sort({ createdAt: -1 })
    .limit(6);

  let text = `🧾 *Recent Tax Invoices*\n\n`;
  if (!invoices || invoices.length === 0) {
    text += `_No invoices recorded._\n`;
  } else {
    invoices.forEach((inv, idx) => {
      text +=
        `${idx + 1}. *#${inv.invoiceNumber}* - ${inv.customer?.name || "Client"}\n` +
        `   Grand Total: ₹${Number(inv.grandTotal || 0).toLocaleString("en-IN")}\n` +
        `   Balance Due: ₹${Number(inv.balanceDue || 0).toLocaleString("en-IN")}\n` +
        `   Status: *${inv.status}*\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "admin_invoices" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Admin: Low Stock Items
 */
async function getAdminInventory(tenantId) {
  const items = await Inventory.find({ tenantId }).sort({ quantity: 1 }).limit(6);

  let text = `📦 *Stock & Inventory Levels*\n\n`;
  if (!items || items.length === 0) {
    text += `_No inventory items recorded._\n`;
  } else {
    items.forEach((item, idx) => {
      const isLow = (item.quantity ?? 0) <= (item.minStockThreshold ?? 5);
      const icon = isLow ? "⚠️" : "✅";
      text +=
        `${idx + 1}. ${icon} *${item.name || item.productName}*\n` +
        `   Stock: *${item.quantity ?? 0}* (Limit: ${item.minStockThreshold ?? 5}) | SKU: \`${item.sku || "N/A"}\`\n` +
        `   Price: ₹${item.price ?? item.unitPrice ?? 0}\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "admin_inventory" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Employee: My Assigned Tasks
 */
async function getEmployeeTasks(tenantId, empName, empEmail) {
  const query = {
    tenantId,
    $or: [{ assignedTo: empName }, ...(empEmail ? [{ assignedToEmail: empEmail }] : [])],
  };

  const tasks = await Task.find(query).sort({ status: 1, dueDate: 1 }).limit(6);

  let text = `📋 *My Assigned Tasks*\n\n`;
  if (!tasks || tasks.length === 0) {
    text += `_No open tasks currently assigned to you! 👍_\n`;
  } else {
    tasks.forEach((t, idx) => {
      const statusIcon = t.status === "Completed" ? "✅" : t.status === "In Progress" ? "🔵" : "🟡";
      text +=
        `${idx + 1}. ${statusIcon} *${t.title}*\n` +
        `   Priority: *${t.priority}* | Due: *${t.dueDate || "N/A"}*\n` +
        `   Status: *${t.status}*\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✏️ Update Task Status", callback_data: "emp_action_update_task" },
        { text: "🔄 Refresh", callback_data: "emp_tasks" },
      ],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Employee: Today's Attendance
 */
async function getEmployeeAttendance(tenantId, empName, employeeId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const query = {
    tenantId,
    date: todayStr,
    $or: [{ employeeName: empName }, ...(employeeId ? [{ employeeId }] : [])],
  };

  const record = await Attendance.findOne(query);

  let text =
    `⏱️ *Today's Attendance Snapshot*\n` +
    `_Date: ${todayStr}_\n\n`;

  if (!record) {
    text +=
      `Status: *Not Checked In Today*\n\n` +
      `_Please use the Web Staff Portal to check in when your shift starts._\n`;
  } else {
    text +=
      `👤 *Staff:* ${record.employeeName}\n` +
      `🟢 *Check-In:* ${record.checkIn || "-"}\n` +
      `🔴 *Check-Out:* ${record.checkOut || "-"}\n` +
      `⏱️ *Hours Logged:* ${record.hours || 0} hrs\n` +
      `📊 *Status:* *${record.status}*\n` +
      (record.notes ? `📝 *Notes:* ${record.notes}\n` : "");
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "emp_attendance" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Employee: Leave Balances
 */
async function getEmployeeLeaveBalance(tenantId, employeeId, empName) {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [policy, approvedLeaves] = await Promise.all([
    LeavePolicy.findOne({ tenantId }),
    Leave.find({
      tenantId,
      status: "Approved",
      from: { $gte: yearStart, $lte: yearEnd },
      $or: [{ employeeId }, { employee: empName }],
    }),
  ]);

  const leaveTypes = policy?.leaveTypes?.filter((t) => t.enabled) || [
    { type: "Casual Leave", entitledPerYear: 12 },
    { type: "Sick Leave", entitledPerYear: 12 },
    { type: "Paid Vacation", entitledPerYear: 15 },
  ];

  const used = {};
  approvedLeaves.forEach((l) => {
    used[l.type] = (used[l.type] || 0) + Number(l.days || 0);
  });

  let text = `🏖️ *My Leave Balances (${year})*\n\n`;
  leaveTypes.forEach((lt) => {
    const taken = used[lt.type] || 0;
    const remaining = Math.max(0, lt.entitledPerYear - taken);
    text += `• *${lt.type}:* ${remaining} remaining (Used: ${taken} / Total: ${lt.entitledPerYear})\n`;
  });

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📝 Apply for Leave", callback_data: "emp_action_apply_leave" },
        { text: "🔍 Leave History", callback_data: "emp_leave_status" },
      ],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Employee: Recent Leave Application Status
 */
async function getEmployeeLeaveStatus(tenantId, empName, employeeId) {
  const leaves = await Leave.find({
    tenantId,
    $or: [{ employee: empName }, ...(employeeId ? [{ employeeId }] : [])],
  })
    .sort({ createdAt: -1 })
    .limit(5);

  let text = `🏖️ *My Recent Leave Applications*\n\n`;
  if (!leaves || leaves.length === 0) {
    text += `_No leave applications found._\n`;
  } else {
    leaves.forEach((l, idx) => {
      const badge =
        l.status === "Approved" ? "🟢 Approved" : l.status === "Rejected" ? "🔴 Rejected" : "🟡 Pending";
      text +=
        `${idx + 1}. *${l.type}* (${l.from} to ${l.to})\n` +
        `   Duration: ${l.days} days | Reason: ${l.reason}\n` +
        `   Status: *${badge}*\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📝 Apply for Leave", callback_data: "emp_action_apply_leave" },
        { text: "🔄 Refresh", callback_data: "emp_leave_status" },
      ],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Customer: My Appointments
 */
async function getCustomerAppointments(tenantId, custName, custEmail, custPhone) {
  const or = [];
  if (custName) or.push({ "customer.name": custName });
  if (custEmail) or.push({ "customer.email": custEmail });
  if (custPhone) or.push({ "customer.phone": custPhone });

  const appointments = await Appointment.find({ tenantId, $or: or }).sort({ date: 1 }).limit(5);

  let text = `📅 *Your Appointments*\n\n`;
  if (!appointments || appointments.length === 0) {
    text += `_You do not have any upcoming bookings._\n`;
  } else {
    appointments.forEach((apt, idx) => {
      text +=
        `${idx + 1}. *${apt.service}*\n` +
        `   🗓️ ${apt.date} at ${apt.time}\n` +
        `   Specialist: ${apt.employee || "Assigned Team Member"}\n` +
        `   Status: *${apt.status}* | Ref: \`${apt.appointmentId}\`\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📆 Book New Appointment", callback_data: "action_book_apt" },
        { text: "🔄 Reschedule / Cancel", callback_data: "cust_manage_apt" },
      ],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Customer: My Invoices
 */
async function getCustomerInvoices(tenantId, custName, custEmail, custPhone) {
  const or = [];
  if (custName) or.push({ "customer.name": custName });
  if (custEmail) or.push({ "customer.email": custEmail });
  if (custPhone) or.push({ "customer.phone": custPhone });

  const invoices = await Invoice.find({ tenantId, $or: or }).sort({ createdAt: -1 }).limit(5);

  let text = `🧾 *Your Invoices & Billing*\n\n`;
  if (!invoices || invoices.length === 0) {
    text += `_No invoices found for your account._\n`;
  } else {
    invoices.forEach((inv, idx) => {
      const isPaid = inv.status === "PAID";
      text +=
        `${idx + 1}. *Invoice #${inv.invoiceNumber}*\n` +
        `   Total: ₹${Number(inv.grandTotal || 0).toLocaleString("en-IN")}\n` +
        `   Balance Due: ₹${Number(inv.balanceDue || 0).toLocaleString("en-IN")}\n` +
        `   Status: *${isPaid ? "✅ PAID" : "🔴 PENDING"}*\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "💳 Payment Methods", callback_data: "cust_payment_status" },
        { text: "🔄 Refresh", callback_data: "cust_invoices" },
      ],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Public: Business Info & Working Hours
 */
async function getPublicInfo(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  const name = tenant?.companyName || "Our Business";

  const text =
    `🏢 *${name}*\n\n` +
    `📍 *Address:* ${tenant?.address || "Downtown HQ"}${tenant?.city ? `, ${tenant.city}` : ""}\n` +
    `📞 *Phone:* ${tenant?.businessPhone || "Contact via desk"}\n` +
    `✉️ *Email:* ${tenant?.businessEmail || "info@business.com"}\n` +
    `⏰ *Business Hours:* ${tenant?.openTime || "09:00"} - ${tenant?.closeTime || "19:00"}\n` +
    (tenant?.website ? `🌐 *Website:* ${tenant.website}\n` : "");

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🛠️ Services Offered", callback_data: "public_services" },
        { text: "📆 Book Appointment", callback_data: "action_book_apt" },
      ],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

/**
 * Public: Services Offered
 */
async function getPublicServices(tenantId) {
  // Pull unique services from recent appointments or standard catalog
  const recent = await Appointment.find({ tenantId }).distinct("service");
  const services = recent.length > 0 ? recent.slice(0, 8) : ["General Consultation", "Standard Service", "Support & Maintenance"];

  let text = `🛠️ *Services Available at Our Business*\n\n`;
  services.forEach((s, idx) => {
    text += `${idx + 1}. *${s}*\n`;
  });
  text += `\n_Ready to reserve a spot? Click the button below:_`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "📆 Book an Appointment Now", callback_data: "action_book_apt" }],
      [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
    ],
  };
  return { text, replyMarkup };
}

// =========================================================================
// CONVERSATIONAL MULTI-STEP FLOW HANDLERS
// =========================================================================

/**
 * Start or progress multi-step conversation
 */
async function handleConversationalStep(botToken, tenantId, chatId, messageText, messageId = null) {
  const session = userSessions.get(chatId);
  if (!session) return false;

  // Check timeout (10 mins)
  if (Date.now() > session.expiresAt) {
    userSessions.delete(chatId);
    await sendTelegramMessage(botToken, chatId, "⏳ *Session timed out.* Please select an option from the menu.");
    return false;
  }

  const cleanText = messageText.trim();
  const lower = cleanText.toLowerCase();

  // Global Cancel command
  if (lower === "cancel" || lower === "/cancel" || lower === "exit") {
    userSessions.delete(chatId);
    const tenant = await Tenant.findById(tenantId);
    const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, tenant?.companyName);
    await sendTelegramMessage(botToken, chatId, "❌ *Operation cancelled.* Returning to Main Menu.", replyMarkup);
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // FLOW 1: APPLY FOR LEAVE (Employee)
  // ──────────────────────────────────────────────────────────
  if (session.flow === "APPLY_LEAVE") {
    if (session.step === "AWAIT_TYPE") {
      session.data.type = cleanText;
      session.step = "AWAIT_FROM";
      userSessions.set(chatId, session);

      const prompt =
        `🗓️ *Start Date*\n\n` +
        `Please enter the starting date in *YYYY-MM-DD* format (or type *Today* / *Tomorrow*):\n\n` +
        `_Example: 2026-10-15_`;
      await sendTelegramMessage(botToken, chatId, prompt, {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
      });
      return true;
    }

    if (session.step === "AWAIT_FROM") {
      let fromDate = cleanText;
      if (lower === "today") fromDate = new Date().toISOString().slice(0, 10);
      else if (lower === "tomorrow") {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        fromDate = d.toISOString().slice(0, 10);
      }

      session.data.from = fromDate;
      session.step = "AWAIT_TO";
      userSessions.set(chatId, session);

      const prompt =
        `🗓️ *End Date*\n\n` +
        `Please enter the ending date in *YYYY-MM-DD* format (type *Same* if single-day leave):`;
      await sendTelegramMessage(botToken, chatId, prompt, {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
      });
      return true;
    }

    if (session.step === "AWAIT_TO") {
      let toDate = cleanText;
      if (lower === "same") toDate = session.data.from;
      session.data.to = toDate;
      session.step = "AWAIT_REASON";
      userSessions.set(chatId, session);

      const prompt = `📝 *Reason for Leave*\n\nPlease state the brief reason for your leave application:`;
      await sendTelegramMessage(botToken, chatId, prompt, {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
      });
      return true;
    }

    if (session.step === "AWAIT_REASON") {
      session.data.reason = cleanText;
      session.step = "AWAIT_CONFIRM";
      userSessions.set(chatId, session);

      const d1 = new Date(session.data.from);
      const d2 = new Date(session.data.to);
      const days = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      session.data.days = days;

      const confirmText =
        `📋 *Please Confirm Your Leave Application*\n\n` +
        `• *Leave Type:* ${session.data.type}\n` +
        `• *From:* ${session.data.from}\n` +
        `• *To:* ${session.data.to} (${days} days)\n` +
        `• *Reason:* ${session.data.reason}\n\n` +
        `Click *Submit* to send to management for approval:`;

      await sendTelegramMessage(botToken, chatId, confirmText, {
        inline_keyboard: [
          [
            { text: "✅ Submit Leave Application", callback_data: "confirm_apply_leave" },
            { text: "❌ Cancel", callback_data: "cancel_flow" },
          ],
        ],
      });
      return true;
    }
  }

  // ──────────────────────────────────────────────────────────
  // FLOW 2: BOOK AN APPOINTMENT (Guest / Customer)
  // ──────────────────────────────────────────────────────────
  if (session.flow === "BOOK_APPOINTMENT") {
    if (session.step === "AWAIT_SERVICE") {
      session.data.service = cleanText;
      session.step = "AWAIT_DATE";
      userSessions.set(chatId, session);

      await sendTelegramMessage(
        botToken,
        chatId,
        `🗓️ *Select or Enter Date*\nPlease provide the appointment date (YYYY-MM-DD) or type *Tomorrow*:`,
        { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]] }
      );
      return true;
    }

    if (session.step === "AWAIT_DATE") {
      let aptDate = cleanText;
      if (lower === "today") aptDate = new Date().toISOString().slice(0, 10);
      else if (lower === "tomorrow") {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        aptDate = d.toISOString().slice(0, 10);
      }
      session.data.date = aptDate;
      session.step = "AWAIT_TIME";
      userSessions.set(chatId, session);

      await sendTelegramMessage(
        botToken,
        chatId,
        `⏰ *Preferred Time*\nPlease enter your preferred time (e.g. *10:00 AM*, *02:30 PM*):`,
        { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]] }
      );
      return true;
    }

    if (session.step === "AWAIT_TIME") {
      session.data.time = cleanText;

      // If customer is already linked, skip asking for name/phone
      const profile = await resolveUserProfile(tenantId, chatId);
      if (profile.type === "CUSTOMER" || profile.name) {
        session.data.customerName = profile.name;
        session.data.customerEmail = profile.email || "";
        session.step = "AWAIT_CONFIRM";
        userSessions.set(chatId, session);

        const confirmText =
          `📅 *Confirm Appointment Booking*\n\n` +
          `• *Customer:* ${profile.name}\n` +
          `• *Service:* ${session.data.service}\n` +
          `• *Date & Time:* ${session.data.date} at ${session.data.time}\n\n` +
          `Confirm to secure this appointment?`;

        await sendTelegramMessage(botToken, chatId, confirmText, {
          inline_keyboard: [
            [
              { text: "✅ Confirm Booking", callback_data: "confirm_book_apt" },
              { text: "❌ Cancel", callback_data: "cancel_flow" },
            ],
          ],
        });
        return true;
      }

      session.step = "AWAIT_NAME";
      userSessions.set(chatId, session);
      await sendTelegramMessage(botToken, chatId, `👤 *Your Name*\nPlease type your full name:`, {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
      });
      return true;
    }

    if (session.step === "AWAIT_NAME") {
      session.data.customerName = cleanText;
      session.step = "AWAIT_PHONE";
      userSessions.set(chatId, session);

      await sendTelegramMessage(botToken, chatId, `📞 *Contact Phone Number*\nPlease enter your phone number:`, {
        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
      });
      return true;
    }

    if (session.step === "AWAIT_PHONE") {
      session.data.customerPhone = cleanText;
      session.step = "AWAIT_CONFIRM";
      userSessions.set(chatId, session);

      const confirmText =
        `📅 *Confirm Appointment Booking*\n\n` +
        `• *Name:* ${session.data.customerName}\n` +
        `• *Phone:* ${session.data.customerPhone}\n` +
        `• *Service:* ${session.data.service}\n` +
        `• *Date & Time:* ${session.data.date} at ${session.data.time}\n\n` +
        `Confirm to reserve this slot:`;

      await sendTelegramMessage(botToken, chatId, confirmText, {
        inline_keyboard: [
          [
            { text: "✅ Confirm Booking", callback_data: "confirm_book_apt" },
            { text: "❌ Cancel", callback_data: "cancel_flow" },
          ],
        ],
      });
      return true;
    }
  }

  // ──────────────────────────────────────────────────────────
  // FLOW 3: CONTACT STAFF / LEAVE MESSAGE
  // ──────────────────────────────────────────────────────────
  if (session.flow === "CONTACT_MESSAGE" && session.step === "AWAIT_MSG") {
    userSessions.delete(chatId);

    // Notify Business Owner in app and Telegram
    await Notification.create({
      tenantId,
      title: "New Customer Enquiry via Telegram",
      message: `Telegram user [${chatId}] sent: "${cleanText}"`,
      type: "General",
      link: "/crm",
    }).catch(() => {});

    // Also dispatch direct Telegram alert to admin
    const { notifyAppointmentEvent } = await import("./telegramNotifier.service.js").catch(() => ({}));
    const tenant = await Tenant.findById(tenantId);
    if (tenant?.telegramConfig?.adminChatId) {
      await sendTelegramMessage(
        botToken,
        tenant.telegramConfig.adminChatId,
        `💬 *New Customer Inquiry via Telegram*\n` +
        `From Chat ID: \`${chatId}\`\n\n` +
        `"${cleanText}"\n\n` +
        `_Reply directly or check your notifications portal._`
      );
    }

    await sendTelegramMessage(
      botToken,
      chatId,
      `✅ *Message Sent to Management!*\nThank you. Our team will get back to you shortly.`,
      { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] }
    );
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // FLOW 4: ENTER LINKING CODE
  // ──────────────────────────────────────────────────────────
  if (session.flow === "ACCOUNT_LINK" && session.step === "AWAIT_CODE") {
    userSessions.delete(chatId);
    return await handleLinkingToken(botToken, tenantId, chatId, cleanText);
  }

  return false;
}

/**
 * Handle account linking token verification
 */
async function handleLinkingToken(botToken, tenantId, chatId, rawToken) {
  const token = rawToken.trim().toUpperCase();

  const user = await User.findOne({
    tenantId,
    telegramLinkToken: token,
    telegramLinkTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `❌ *Invalid or Expired Linking Code.*\n\nPlease generate a fresh code in Business OS (**Settings $\\rightarrow$ Integrations** or your Profile) and try again.`,
      { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] }
    );
    return true;
  }

  // Bind Telegram chatId and username
  user.telegramChatId = String(chatId);
  user.telegramLinked = true;
  user.telegramLinkedAt = new Date();
  user.telegramLinkToken = "";
  user.telegramLinkTokenExpires = null;
  await user.save();

  // Also sync Employee or Customer model if matching
  if (user.employeeId || user.email) {
    await Employee.findOneAndUpdate(
      {
        tenantId,
        $or: [{ employeeId: user.employeeId }, { email: user.email }],
      },
      { $set: { telegramChatId: String(chatId), telegramUsername: user.telegramUsername || "" } }
    );
  }

  const tenant = await Tenant.findById(tenantId);
  const welcomeText =
    `🎉 *Account Successfully Linked!*\n\n` +
    `👤 *User:* ${user.name}\n` +
    `🏷️ *Role:* ${user.role}\n` +
    `🏢 *Tenant:* ${tenant?.companyName || "Business OS"}\n\n` +
    `Your Telegram bot menu has been customized to your credentials.`;

  const { replyMarkup } = await getRoleBasedMenu(tenantId, chatId, tenant?.companyName);
  await sendTelegramMessage(botToken, chatId, welcomeText, replyMarkup);
  return true;
}

// =========================================================================
// MAIN UPDATE DISPATCHER
// =========================================================================

export async function handleTelegramUpdate(botToken, tenantId, update) {
  try {
    const tenant = await Tenant.findById(tenantId);
    const companyName = tenant?.companyName || "Business OS";

    // ──────────────────────────────────────────────────────────
    // 1. Handle Inline Button Callbacks
    // ──────────────────────────────────────────────────────────
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const action = cb.data;

      await answerCallbackQuery(botToken, cb.id);
      if (!chatId) return;

      // Cancel any active flow
      if (action === "cancel_flow") {
        userSessions.delete(chatId);
        const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
        await editTelegramMessage(botToken, chatId, messageId, "❌ *Cancelled.* Main Menu:", replyMarkup);
        return;
      }

      // Return to Role Main Menu
      if (action === "menu_main") {
        userSessions.delete(chatId);
        const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }

      // ── Admin Menu Actions ──
      if (action === "admin_overview" || action === "admin_summary") {
        const { text, replyMarkup } = await getSummaryData(tenantId, companyName);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "admin_appointments") {
        const { text, replyMarkup } = await getAdminAppointments(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "admin_invoices") {
        const { text, replyMarkup } = await getAdminInvoices(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "admin_inventory") {
        const { text, replyMarkup } = await getAdminInventory(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "admin_tasks") {
        const tasks = await Task.find({ tenantId, status: { $ne: "Completed" } }).limit(6);
        let text = `📋 *Open Operational Tasks*\n\n`;
        if (!tasks || tasks.length === 0) text += `_No pending tasks._\n`;
        else {
          tasks.forEach((t, i) => {
            text += `${i + 1}. *${t.title}* (${t.priority})\n   Assigned: ${t.assignedTo} | Due: ${t.dueDate || "N/A"}\n\n`;
          });
        }
        await editTelegramMessage(botToken, chatId, messageId, text, {
          inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: "admin_tasks" }],
            [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
          ],
        });
        return;
      }
      if (action === "admin_prefs") {
        const prefs = tenant?.telegramConfig?.notificationPreferences || {};
        const text =
          `⚙️ *Telegram Notification Channels*\n\n` +
          `• Appointments: ${prefs.appointments ? "✅ Enabled" : "❌ Disabled"}\n` +
          `• Invoices & Payments: ${prefs.invoices ? "✅ Enabled" : "❌ Disabled"}\n` +
          `• Tasks: ${prefs.tasks ? "✅ Enabled" : "❌ Disabled"}\n` +
          `• Leave Requests: ${prefs.leaves ? "✅ Enabled" : "❌ Disabled"}\n` +
          `• Inventory Alerts: ${prefs.inventory ? "✅ Enabled" : "❌ Disabled"}\n` +
          `• Daily Summary: ${prefs.dailySummary ? "✅ Enabled" : "❌ Disabled"} (${prefs.dailySummaryTime || "09:00"})\n\n` +
          `_Configure preferences in your Web Dashboard under Settings $\\rightarrow$ Integrations._`;

        await editTelegramMessage(botToken, chatId, messageId, text, {
          inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]],
        });
        return;
      }

      // ── Employee Menu Actions ──
      const profile = await resolveUserProfile(tenantId, chatId);

      if (action === "emp_tasks") {
        const { text, replyMarkup } = await getEmployeeTasks(tenantId, profile.name, profile.email);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "emp_attendance") {
        const { text, replyMarkup } = await getEmployeeAttendance(tenantId, profile.name, profile.user?.employeeId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "emp_leave_balance") {
        const { text, replyMarkup } = await getEmployeeLeaveBalance(tenantId, profile.user?.employeeId, profile.name);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "emp_leave_status") {
        const { text, replyMarkup } = await getEmployeeLeaveStatus(tenantId, profile.name, profile.user?.employeeId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }

      // ── Conversational Flow: Employee Apply Leave ──
      if (action === "emp_action_apply_leave") {
        userSessions.set(chatId, {
          flow: "APPLY_LEAVE",
          step: "AWAIT_TYPE",
          data: { employee: profile.name, employeeEmail: profile.email, employeeId: profile.user?.employeeId || "" },
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        const text =
          `📝 *Apply for Leave - Step 1/4*\n\n` +
          `Please select the type of leave you wish to apply for:`;

        await editTelegramMessage(botToken, chatId, messageId, text, {
          inline_keyboard: [
            [
              { text: "Casual Leave", callback_data: "leave_type_Casual Leave" },
              { text: "Sick Leave", callback_data: "leave_type_Sick Leave" },
            ],
            [
              { text: "Paid Vacation", callback_data: "leave_type_Paid Vacation" },
              { text: "Emergency Leave", callback_data: "leave_type_Emergency Leave" },
            ],
            [{ text: "❌ Cancel", callback_data: "cancel_flow" }],
          ],
        });
        return;
      }

      if (action.startsWith("leave_type_")) {
        const leaveType = action.replace("leave_type_", "");
        const session = userSessions.get(chatId) || { flow: "APPLY_LEAVE", data: {} };
        session.data.type = leaveType;
        session.step = "AWAIT_FROM";
        session.expiresAt = Date.now() + 10 * 60 * 1000;
        userSessions.set(chatId, session);

        const prompt =
          `🗓️ *Start Date*\nSelected: *${leaveType}*\n\n` +
          `Type the start date in *YYYY-MM-DD* format (or type *Tomorrow*):`;

        await editTelegramMessage(botToken, chatId, messageId, prompt, {
          inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
        });
        return;
      }

      if (action === "confirm_apply_leave") {
        const session = userSessions.get(chatId);
        if (!session || !session.data) return;

        userSessions.delete(chatId);

        // Create Leave record in database
        const newLeave = await Leave.create({
          tenantId,
          employee: session.data.employee || profile.name,
          employeeEmail: session.data.employeeEmail || profile.email || "",
          employeeId: session.data.employeeId || "",
          type: session.data.type,
          from: session.data.from,
          to: session.data.to,
          days: session.data.days || 1,
          reason: session.data.reason || "Applied via Telegram Bot",
          status: "Pending",
        });

        // Trigger notifications
        const { notifyLeaveEvent } = await import("./telegramNotifier.service.js");
        notifyLeaveEvent({ tenantId, leave: newLeave, eventType: "SUBMITTED" }).catch(() => {});

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `✅ *Leave Application Submitted Successfully!*\n\nYour manager has been notified. You will receive an instant update here once a decision is made.`,
          { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] }
        );
        return;
      }

      // ── Conversational Flow: Employee Update Task ──
      if (action === "emp_action_update_task") {
        const tasks = await Task.find({
          tenantId,
          status: { $ne: "Completed" },
          $or: [{ assignedTo: profile.name }, ...(profile.email ? [{ assignedToEmail: profile.email }] : [])],
        }).limit(5);

        if (!tasks || tasks.length === 0) {
          await editTelegramMessage(
            botToken,
            chatId,
            messageId,
            `👍 *No pending tasks found to update.*`,
            { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] }
          );
          return;
        }

        const buttons = tasks.map((t) => [
          { text: `📌 ${t.title.slice(0, 24)}... (${t.status})`, callback_data: `task_select_${t._id}` },
        ]);
        buttons.push([{ text: "❌ Cancel", callback_data: "cancel_flow" }]);

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `✏️ *Select Task to Update:*`,
          { inline_keyboard: buttons }
        );
        return;
      }

      if (action.startsWith("task_select_")) {
        const taskId = action.replace("task_select_", "");
        const task = await Task.findById(taskId);
        if (!task) return;

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `✏️ *Update Status for:*\n"${task.title}"\nCurrent Status: *${task.status}*\n\nChoose new status:`,
          {
            inline_keyboard: [
              [
                { text: "🔵 Mark In Progress", callback_data: `task_status_${taskId}_In Progress` },
                { text: "✅ Mark Completed", callback_data: `task_status_${taskId}_Completed` },
              ],
              [{ text: "❌ Cancel", callback_data: "cancel_flow" }],
            ],
          }
        );
        return;
      }

      if (action.startsWith("task_status_")) {
        const parts = action.split("_");
        const taskId = parts[2];
        const newStatus = parts.slice(3).join("_");

        const updated = await Task.findByIdAndUpdate(taskId, { $set: { status: newStatus } }, { new: true });

        if (updated) {
          const { notifyTaskEvent } = await import("./telegramNotifier.service.js");
          notifyTaskEvent({ tenantId, task: updated, eventType: "UPDATED" }).catch(() => {});
        }

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `✅ *Task status updated to: ${newStatus}!*`,
          { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] }
        );
        return;
      }

      // ── Customer Menu Actions ──
      if (action === "cust_appointments") {
        const { text, replyMarkup } = await getCustomerAppointments(tenantId, profile.name, profile.email);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "cust_next_apt") {
        const apt = await Appointment.findOne({
          tenantId,
          status: { $in: ["CONFIRMED", "SCHEDULED"] },
          $or: [{ "customer.name": profile.name }, ...(profile.email ? [{ "customer.email": profile.email }] : [])],
        }).sort({ date: 1, time: 1 });

        let text = `⏰ *Next Upcoming Appointment*\n\n`;
        if (!apt) text += `_You have no upcoming appointments scheduled._\n`;
        else {
          text +=
            `🛠️ *Service:* ${apt.service}\n` +
            `🗓️ *Date & Time:* ${apt.date} at ${apt.time}\n` +
            `👨‍💼 *Specialist:* ${apt.employee || "Assigned Specialist"}\n` +
            `Status: *${apt.status}* | Ref: \`${apt.appointmentId}\`\n`;
        }

        await editTelegramMessage(botToken, chatId, messageId, text, {
          inline_keyboard: [
            [{ text: "📆 Book Another", callback_data: "action_book_apt" }],
            [{ text: "🔙 Main Menu", callback_data: "menu_main" }],
          ],
        });
        return;
      }
      if (action === "cust_invoices" || action === "cust_payment_status") {
        const { text, replyMarkup } = await getCustomerInvoices(tenantId, profile.name, profile.email);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }

      // ── Book Appointment Flow ──
      if (action === "action_book_apt") {
        userSessions.set(chatId, {
          flow: "BOOK_APPOINTMENT",
          step: "AWAIT_SERVICE",
          data: {},
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        // Pull common services
        const recent = await Appointment.find({ tenantId }).distinct("service");
        const list = recent.length > 0 ? recent.slice(0, 4) : ["Consultation", "Standard Service", "Support Session"];

        const buttons = list.map((s) => [{ text: s, callback_data: `book_service_${s}` }]);
        buttons.push([{ text: "❌ Cancel", callback_data: "cancel_flow" }]);

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `📆 *Book an Appointment - Step 1/3*\n\nPlease select or type the service:`,
          { inline_keyboard: buttons }
        );
        return;
      }

      if (action.startsWith("book_service_")) {
        const sName = action.replace("book_service_", "");
        const session = userSessions.get(chatId) || { flow: "BOOK_APPOINTMENT", data: {} };
        session.data.service = sName;
        session.step = "AWAIT_DATE";
        session.expiresAt = Date.now() + 10 * 60 * 1000;
        userSessions.set(chatId, session);

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `🗓️ *Select Date for ${sName}*\n\nPlease enter date (YYYY-MM-DD) or type *Tomorrow*:`,
          { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]] }
        );
        return;
      }

      if (action === "confirm_book_apt") {
        const session = userSessions.get(chatId);
        if (!session || !session.data) return;

        userSessions.delete(chatId);
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const appointmentId = `APT-${randomSuffix}`;

        const newApt = await Appointment.create({
          tenantId,
          appointmentId,
          customer: {
            name: session.data.customerName || "Customer",
            phone: session.data.customerPhone || "",
            email: session.data.customerEmail || "",
          },
          service: session.data.service,
          employee: "Unassigned",
          date: session.data.date,
          time: session.data.time,
          status: "CONFIRMED",
          paymentStatus: "PENDING",
        });

        // Trigger automated notification
        const { notifyAppointmentEvent } = await import("./telegramNotifier.service.js");
        notifyAppointmentEvent({ tenantId, appointment: newApt, eventType: "CREATED" }).catch(() => {});

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `🎉 *Appointment Confirmed!*\n\nReference: \`${appointmentId}\`\nService: *${newApt.service}*\nDate: *${newApt.date} at ${newApt.time}*\n\nWe look forward to serving you!`,
          { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] }
        );
        return;
      }

      // ── Public Menu Actions ──
      if (action === "public_info") {
        const { text, replyMarkup } = await getPublicInfo(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "public_services") {
        const { text, replyMarkup } = await getPublicServices(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "public_contact") {
        userSessions.set(chatId, {
          flow: "CONTACT_MESSAGE",
          step: "AWAIT_MSG",
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          `💬 *Contact Our Team*\n\nPlease type your message or enquiry below. A staff member will be alerted immediately:`,
          { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]] }
        );
        return;
      }
      if (action === "public_link_prompt") {
        userSessions.set(chatId, {
          flow: "ACCOUNT_LINK",
          step: "AWAIT_CODE",
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        const text =
          `🔗 *Link Your Business OS Account*\n\n` +
          `1. Open Business OS in your browser.\n` +
          `2. Go to **Settings $\\rightarrow$ Integrations**.\n` +
          `3. Click **"Generate Telegram Linking Code"**.\n` +
          `4. Type the 6-character code here (e.g. \`TG-A1B2C3\`):`;

        await editTelegramMessage(botToken, chatId, messageId, text, {
          inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]],
        });
        return;
      }
      if (action === "account_unlink") {
        const prof = await resolveUserProfile(tenantId, chatId);
        if (prof.user) {
          await unlinkTelegramAccount(prof.user._id);
        } else if (prof.customer) {
          await Customer.findByIdAndUpdate(prof.customer._id, { $set: { telegramChatId: "", telegramUsername: "" } });
        }

        const text = `🔓 *Your Telegram account has been unlinked successfully.*`;
        const { replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
        return;
      }
      if (action === "public_help") {
        const text =
          `❓ *Business OS Bot Help*\n\n` +
          `• Type */start* or *menu* anytime to return to your personalized menu.\n` +
          `• Type */link <code>* to connect your employee or customer account.\n` +
          `• Type */unlink* to disconnect your Telegram account.\n` +
          `• Type *cancel* during any multi-step operation to abort cleanly.\n\n` +
          `_Powered by official Business OS Multi-Channel Automation._`;

        await editTelegramMessage(botToken, chatId, messageId, text, {
          inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]],
        });
        return;
      }

      return;
    }

    // ──────────────────────────────────────────────────────────
    // 2. Handle Incoming Direct Messages & Commands
    // ──────────────────────────────────────────────────────────
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const rawText = msg.text.trim();
      const lower = rawText.toLowerCase();

      if (!chatId) return;

      // Check active conversational session first
      if (userSessions.has(chatId)) {
        const handled = await handleConversationalStep(botToken, tenantId, chatId, rawText, msg.message_id);
        if (handled) return;
      }

      // Check deep linking in /start command: /start link_TOKEN
      if (lower.startsWith("/start link_")) {
        const token = rawText.slice(12).trim();
        return await handleLinkingToken(botToken, tenantId, chatId, token);
      }

      // Handle direct /link <code> command
      if (lower.startsWith("/link")) {
        const token = rawText.replace(/^\/link/i, "").trim();
        if (!token) {
          userSessions.set(chatId, {
            flow: "ACCOUNT_LINK",
            step: "AWAIT_CODE",
            expiresAt: Date.now() + 10 * 60 * 1000,
          });
          await sendTelegramMessage(
            botToken,
            chatId,
            `🔗 Please send your 6-character linking code (e.g. \`TG-A1B2C3\`):`,
            { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_flow" }]] }
          );
          return;
        }
        return await handleLinkingToken(botToken, tenantId, chatId, token);
      }

      // Handle /unlink command
      if (lower === "/unlink") {
        const prof = await resolveUserProfile(tenantId, chatId);
        if (prof.user) await unlinkTelegramAccount(prof.user._id);
        const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
        await sendTelegramMessage(botToken, chatId, `🔓 *Account Unlinked.*`, replyMarkup);
        return;
      }

      // Main Menu triggers
      if (
        lower === "/start" ||
        lower === "hi" ||
        lower === "hello" ||
        lower === "hey" ||
        lower === "menu" ||
        lower.startsWith("/menu")
      ) {
        userSessions.delete(chatId);
        const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      // Quick slash commands
      if (lower === "/summary") {
        const { text, replyMarkup } = await getSummaryData(tenantId, companyName);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/appointments") {
        const { text, replyMarkup } = await getAdminAppointments(tenantId);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/tasks") {
        const prof = await resolveUserProfile(tenantId, chatId);
        const { text, replyMarkup } = await getEmployeeTasks(tenantId, prof.name, prof.email);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/help" || lower === "help") {
        const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      // Graceful fallback for unknown message
      const { text, replyMarkup } = await getRoleBasedMenu(tenantId, chatId, companyName);
      await sendTelegramMessage(
        botToken,
        chatId,
        `🤖 *I didn't quite catch that.* Please select an option from your personalized menu below:`,
        replyMarkup
      );
    }
  } catch (error) {
    console.error("❌ Error handling Telegram update:", error);
  }
}

// =========================================================================
// LONG-POLLING RUNNER
// =========================================================================

async function pollTelegramUpdates(botToken, tenantId) {
  const botState = activePollingBots.get(botToken);
  if (!botState || !botState.running) return;

  try {
    const payload = {
      offset: botState.offset,
      timeout: 20,
      allowed_updates: ["message", "callback_query"],
    };

    const data = await callTelegramApi(botToken, "getUpdates", payload);

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        botState.offset = update.update_id + 1;
        handleTelegramUpdate(botToken, tenantId, update).catch((e) =>
          console.error("Update process error:", e)
        );
      }
    }
  } catch (err) {
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (activePollingBots.get(botToken)?.running) {
    botState.timer = setTimeout(() => pollTelegramUpdates(botToken, tenantId), 500);
  }
}

export function startTelegramBotPolling(botToken, tenantId) {
  if (!botToken) return;
  stopTelegramBotPolling(botToken);

  const state = {
    running: true,
    offset: 0,
    tenantId,
    timer: null,
  };
  activePollingBots.set(botToken, state);

  callTelegramApi(botToken, "deleteWebhook")
    .then(() => {
      pollTelegramUpdates(botToken, tenantId);
      console.log(`🤖 Telegram Bot polling started for tenant: ${tenantId}`);
    })
    .catch((e) => {
      console.warn("⚠️ Failed to delete webhook before polling:", e.message);
      pollTelegramUpdates(botToken, tenantId);
    });
}

export function stopTelegramBotPolling(botToken) {
  if (!botToken) return;
  const state = activePollingBots.get(botToken);
  if (state) {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    activePollingBots.delete(botToken);
    console.log(`🛑 Telegram Bot polling stopped for token.`);
  }
}

export async function initializeConnectedTelegramBots() {
  try {
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN;

    const tenants = await Tenant.find({
      $or: [
        { "telegramConfig.connected": true, "telegramConfig.botToken": { $ne: "" } },
        ...(envBotToken ? [{ status: "ACTIVE" }] : []),
      ],
    });

    for (const tenant of tenants) {
      const token = tenant.telegramConfig?.botToken || envBotToken;
      if (token) {
        startTelegramBotPolling(token, tenant._id.toString());
      }
    }
  } catch (error) {
    console.warn("⚠️ Error initializing Telegram bots on startup:", error.message);
  }
}
