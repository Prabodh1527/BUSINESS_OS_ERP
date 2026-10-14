import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Customer from "../models/customer.model.js";
import Employee from "../models/employee.model.js";
import TelegramLog from "../models/telegramLog.model.js";
import { sendTelegramMessage } from "./telegramBot.service.js";
import {
  sendWhatsAppMessage,
  formatInvoiceWhatsAppText,
  formatAppointmentWhatsAppText,
} from "./whatsapp.service.js";

/**
 * Helper to retrieve active bot token and config for a tenant
 */
async function getTenantTelegramContext(tenantId) {
  try {
    const tenant = await Tenant.findOne({ _id: tenantId });
    if (!tenant) return null;

    const token = tenant.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const isConnected = tenant.telegramConfig?.connected || Boolean(process.env.TELEGRAM_BOT_TOKEN);

    return {
      token: token && isConnected ? token : null,
      tenant,
      prefs: tenant.telegramConfig?.notificationPreferences || {},
      adminChatId: tenant.telegramConfig?.adminChatId || "",
      companyName: tenant.companyName || "Business OS",
    };
  } catch (err) {
    console.warn("⚠️ Error getting tenant Telegram context:", err.message);
    return null;
  }
}

/**
 * Log message delivery status to database
 */
async function recordDeliveryLog({ tenantId, event, recipientChatId, recipientName, recipientRole, status, text, error }) {
  try {
    await TelegramLog.create({
      tenantId: tenantId.toString(),
      event,
      recipientChatId: recipientChatId || "",
      recipientName: recipientName || "User",
      recipientRole: recipientRole || "ADMIN",
      status: status || "SENT",
      messageSnippet: text ? text.slice(0, 180) : "",
      errorMessage: error ? String(error).slice(0, 250) : "",
    });
  } catch (logErr) {
    // Non-fatal logging failure
  }
}

/**
 * Send message to an authorized chat ID and record delivery
 */
async function dispatchToChat({ token, tenantId, chatId, text, replyMarkup, event, recipientName, recipientRole }) {
  if (!token || !chatId) return false;

  try {
    const res = await sendTelegramMessage(token, chatId, text, replyMarkup);
    const success = Boolean(res?.ok);

    await recordDeliveryLog({
      tenantId,
      event,
      recipientChatId: chatId,
      recipientName,
      recipientRole,
      status: success ? "SENT" : "FAILED",
      text,
      error: success ? null : res?.description,
    });

    return success;
  } catch (err) {
    await recordDeliveryLog({
      tenantId,
      event,
      recipientChatId: chatId,
      recipientName,
      recipientRole,
      status: "FAILED",
      text,
      error: err.message,
    });
    return false;
  }
}

/**
 * Dispatch WhatsApp message if tenant has WhatsApp configured
 */
async function dispatchWhatsAppIfEnabled({ tenant, to, text, event }) {
  if (!tenant || !to || !text) return;
  const config = tenant.whatsappConfig || {};
  const isConnected = config.connected || Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (!isConnected) return;

  const token = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  try {
    const res = await sendWhatsAppMessage({
      phoneNumberId: phoneId,
      accessToken: token,
      to,
      text,
    });
    if (res.success) {
      await recordDeliveryLog({
        tenantId: tenant._id.toString(),
        event: `WHATSAPP_${event}`,
        recipientChatId: to,
        recipientName: "Customer",
        recipientRole: "CUSTOMER",
        status: "SENT",
        text,
      });
    }
  } catch (err) {
    console.warn("WhatsApp notification error:", err.message);
  }
}

/**
 * Get all authorized admin/owner chat IDs for a tenant
 */
async function getTenantAdminChatIds(tenantId, fallbackAdminChatId = "") {
  const chatIds = new Set();
  if (fallbackAdminChatId) chatIds.add(fallbackAdminChatId);

  try {
    const adminUsers = await User.find({
      tenantId,
      role: { $in: ["OWNER", "ADMIN", "MANAGER"] },
      telegramLinked: true,
      telegramChatId: { $ne: "" },
    });

    adminUsers.forEach((u) => {
      if (u.telegramChatId) chatIds.add(u.telegramChatId);
    });
  } catch (err) {
    console.warn("Could not fetch admin chat IDs:", err.message);
  }

  return Array.from(chatIds);
}

/**
 * Find linked employee chat ID by name, email, or employeeId
 */
async function getEmployeeChatId(tenantId, { name, email, employeeId }) {
  try {
    // Check User model first
    const userQuery = { tenantId, telegramLinked: true, telegramChatId: { $ne: "" } };
    const orConditions = [];
    if (email) orConditions.push({ email: email.toLowerCase() });
    if (employeeId) orConditions.push({ employeeId });
    if (name) orConditions.push({ name });

    if (orConditions.length > 0) {
      userQuery.$or = orConditions;
      const user = await User.findOne(userQuery);
      if (user?.telegramChatId) return { chatId: user.telegramChatId, name: user.name };
    }

    // Check Employee model
    const empQuery = { tenantId, telegramChatId: { $ne: "" } };
    if (orConditions.length > 0) {
      empQuery.$or = orConditions;
      const emp = await Employee.findOne(empQuery);
      if (emp?.telegramChatId) return { chatId: emp.telegramChatId, name: emp.name };
    }
  } catch (err) {
    console.warn("Could not find employee Telegram chat ID:", err.message);
  }
  return null;
}

/**
 * Find linked customer chat ID by email, phone, or name
 */
async function getCustomerChatId(tenantId, { email, phone, name }) {
  try {
    const conditions = [];
    if (email) conditions.push({ email: email.toLowerCase() });
    if (phone) conditions.push({ phone });
    if (name) conditions.push({ name });

    if (conditions.length === 0) return null;

    const customer = await Customer.findOne({
      tenantId,
      $or: conditions,
      telegramChatId: { $ne: "" },
    });

    if (customer?.telegramChatId) {
      return { chatId: customer.telegramChatId, name: customer.name };
    }
  } catch (err) {
    console.warn("Could not find customer Telegram chat ID:", err.message);
  }
  return null;
}

// =========================================================================
// 1. APPOINTMENT NOTIFICATIONS
// =========================================================================
export async function notifyAppointmentEvent({ tenantId, appointment, eventType = "CREATED" }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;
    if (ctx.prefs.appointments === false) return;

    const { token, companyName } = ctx;
    const icons = {
      CREATED: "🆕",
      CONFIRMED: "🟢",
      RESCHEDULED: "🔄",
      CANCELLED: "❌",
      REMINDER: "⏰",
    };
    const titles = {
      CREATED: "New Appointment Booked",
      CONFIRMED: "Appointment Confirmed",
      RESCHEDULED: "Appointment Rescheduled",
      CANCELLED: "Appointment Cancelled",
      REMINDER: "Upcoming Appointment Reminder",
    };

    const icon = icons[eventType] || "📅";
    const title = titles[eventType] || "Appointment Update";

    const commonText =
      `${icon} *${title}*\n` +
      `_Business: ${companyName}_\n\n` +
      `📌 *ID:* \`${appointment.appointmentId}\`\n` +
      `👤 *Customer:* ${appointment.customer?.name || "Client"}\n` +
      `🛠️ *Service:* ${appointment.service}\n` +
      `🗓️ *Date & Time:* ${appointment.date} at ${appointment.time}\n` +
      `👨‍💼 *Specialist:* ${appointment.employee || "Unassigned"}\n` +
      `💰 *Status / Payment:* ${appointment.status} | ${appointment.paymentStatus}\n` +
      (appointment.notes ? `📝 *Notes:* ${appointment.notes}\n` : "");

    // 1. Notify Admin(s)
    const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
    for (const adminChatId of adminChatIds) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: adminChatId,
        text: commonText,
        event: `APPOINTMENT_${eventType}`,
        recipientName: "Administrator",
        recipientRole: "ADMIN",
      });
    }

    // 2. Notify Assigned Employee (if linked)
    if (appointment.employee && appointment.employee !== "Unassigned") {
      const emp = await getEmployeeChatId(tenantId, { name: appointment.employee });
      if (emp && !adminChatIds.includes(emp.chatId)) {
        await dispatchToChat({
          token,
          tenantId,
          chatId: emp.chatId,
          text: `📋 *Appointment Notice for You*\n\n${commonText}`,
          event: `APPOINTMENT_${eventType}`,
          recipientName: emp.name,
          recipientRole: "EMPLOYEE",
        });
      }
    }

    // 3. Notify Customer (if customer has Telegram linked)
    const cust = await getCustomerChatId(tenantId, {
      email: appointment.customer?.email,
      phone: appointment.customer?.phone,
      name: appointment.customer?.name,
    });
    if (cust) {
      const custText =
        `${icon} *${title}*\n` +
        `Hello ${cust.name}, here are the details for your session with *${companyName}*:\n\n` +
        `📌 *Reference:* \`${appointment.appointmentId}\`\n` +
        `🛠️ *Service:* ${appointment.service}\n` +
        `🗓️ *Date:* ${appointment.date} at ${appointment.time}\n` +
        `👨‍💼 *Staff Specialist:* ${appointment.employee || "Assigned Team Member"}\n` +
        `Status: *${appointment.status}*\n\n` +
        `_Reply /start or use the menu below to view your upcoming bookings._`;

      await dispatchToChat({
        token,
        tenantId,
        chatId: cust.chatId,
        text: custText,
        event: `APPOINTMENT_${eventType}`,
        recipientName: cust.name,
        recipientRole: "CUSTOMER",
      });
    }

    // 4. WhatsApp Direct Message (if customer phone exists and WhatsApp connected)
    const customerPhone = appointment.customer?.phone;
    if (customerPhone && ctx.tenant) {
      const waText = formatAppointmentWhatsAppText(appointment, companyName, eventType);
      await dispatchWhatsAppIfEnabled({
        tenant: ctx.tenant,
        to: customerPhone,
        text: waText,
        event: `APPOINTMENT_${eventType}`,
      });
    }
  } catch (err) {
    console.warn("⚠️ Appointment Telegram notification error:", err.message);
  }
}

// =========================================================================
// 2. INVOICE & PAYMENT NOTIFICATIONS
// =========================================================================
export async function notifyInvoiceEvent({ tenantId, invoice, eventType = "CREATED", paymentAmount = null }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;
    if (ctx.prefs.invoices === false) return;

    const { token, companyName } = ctx;

    let text = "";
    if (eventType === "CREATED") {
      text =
        `🧾 *New Tax Invoice Generated*\n` +
        `_Business: ${companyName}_\n\n` +
        `📄 *Invoice #:* \`${invoice.invoiceNumber}\`\n` +
        `👤 *Client:* ${invoice.customer?.name || "Customer"}\n` +
        `💰 *Grand Total:* ₹${Number(invoice.grandTotal || 0).toLocaleString("en-IN")}\n` +
        `💳 *Balance Due:* ₹${Number(invoice.balanceDue || 0).toLocaleString("en-IN")}\n` +
        `📅 *Due Date:* ${invoice.dueDate || "Due upon receipt"}\n` +
        `Status: *${invoice.status}*`;
    } else if (eventType === "PAYMENT_RECEIVED") {
      text =
        `💵 *Payment Received!*\n` +
        `_Business: ${companyName}_\n\n` +
        `📄 *Invoice #:* \`${invoice.invoiceNumber}\`\n` +
        `👤 *Client:* ${invoice.customer?.name || "Customer"}\n` +
        `✅ *Amount Paid Now:* ₹${Number(paymentAmount || invoice.amountPaid || 0).toLocaleString("en-IN")}\n` +
        `💳 *Remaining Balance:* ₹${Number(invoice.balanceDue || 0).toLocaleString("en-IN")}\n` +
        `Current Status: *${invoice.status}*`;
    } else if (eventType === "OVERDUE") {
      text =
        `⚠️ *Payment Reminder / Overdue Notice*\n` +
        `_Business: ${companyName}_\n\n` +
        `📄 *Invoice #:* \`${invoice.invoiceNumber}\`\n` +
        `👤 *Client:* ${invoice.customer?.name || "Customer"}\n` +
        `🔴 *Outstanding Balance:* ₹${Number(invoice.balanceDue || 0).toLocaleString("en-IN")}\n` +
        `Due Date was: ${invoice.dueDate || "N/A"}`;
    }

    // 1. Notify Admin(s)
    const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
    for (const adminChatId of adminChatIds) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: adminChatId,
        text,
        event: `INVOICE_${eventType}`,
        recipientName: "Administrator",
        recipientRole: "ADMIN",
      });
    }

    // 2. Notify Customer if linked
    const cust = await getCustomerChatId(tenantId, {
      email: invoice.customer?.email,
      phone: invoice.customer?.phone,
      name: invoice.customer?.name,
    });
    if (cust) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: cust.chatId,
        text: `📄 *Invoice Notice from ${companyName}*\n\n${text}`,
        event: `INVOICE_${eventType}`,
        recipientName: cust.name,
        recipientRole: "CUSTOMER",
      });
    }

    // 3. WhatsApp Direct Message (if customer phone exists and WhatsApp connected)
    const customerPhone = invoice.customer?.phone;
    if (customerPhone && ctx.tenant) {
      const waText = formatInvoiceWhatsAppText(invoice, companyName, eventType);
      await dispatchWhatsAppIfEnabled({
        tenant: ctx.tenant,
        to: customerPhone,
        text: waText,
        event: `INVOICE_${eventType}`,
      });
    }
  } catch (err) {
    console.warn("⚠️ Invoice notification error:", err.message);
  }
}

// =========================================================================
// 3. TASK ASSIGNMENT & STATUS NOTIFICATIONS
// =========================================================================
export async function notifyTaskEvent({ tenantId, task, eventType = "ASSIGNED" }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;
    if (ctx.prefs.tasks === false) return;

    const { token, companyName } = ctx;

    const priorityBadge =
      task.priority === "High" || task.priority === "Urgent" ? "🔴" : task.priority === "Medium" ? "🟡" : "🟢";

    const text =
      `📋 *Task ${eventType === "ASSIGNED" ? "Assigned" : "Updated"}*\n` +
      `_Business: ${companyName}_\n\n` +
      `📌 *Title:* ${task.title}\n` +
      (task.description ? `📝 *Description:* ${task.description}\n` : "") +
      `👤 *Assigned To:* ${task.assignedTo}\n` +
      `${priorityBadge} *Priority:* ${task.priority}\n` +
      `🗓️ *Target Due Date:* ${task.dueDate || "Immediate"}\n` +
      `Status: *${task.status}*`;

    // 1. Notify Assigned Employee
    const emp = await getEmployeeChatId(tenantId, {
      name: task.assignedTo,
      email: task.assignedToEmail,
    });
    if (emp) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: emp.chatId,
        text: `🔔 *Task Notification for You*\n\n${text}\n\n_Use the Staff menu in Telegram to update progress._`,
        event: `TASK_${eventType}`,
        recipientName: emp.name,
        recipientRole: "EMPLOYEE",
      });
    }

    // 2. If task completed, notify Admin
    if (task.status === "Completed" || eventType === "ASSIGNED") {
      const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
      for (const adminChatId of adminChatIds) {
        if (!emp || emp.chatId !== adminChatId) {
          await dispatchToChat({
            token,
            tenantId,
            chatId: adminChatId,
            text,
            event: `TASK_${eventType}`,
            recipientName: "Administrator",
            recipientRole: "ADMIN",
          });
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ Task Telegram notification error:", err.message);
  }
}

// =========================================================================
// 4. LEAVE REQUEST & DECISION NOTIFICATIONS
// =========================================================================
export async function notifyLeaveEvent({ tenantId, leave, eventType = "SUBMITTED" }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;
    if (ctx.prefs.leaves === false) return;

    const { token, companyName } = ctx;

    if (eventType === "SUBMITTED") {
      const text =
        `🏖️ *New Leave Application Submitted*\n` +
        `_Business: ${companyName}_\n\n` +
        `👤 *Employee:* ${leave.employee} (${leave.role || "Staff"})\n` +
        `📋 *Leave Type:* ${leave.type}\n` +
        `🗓️ *Dates:* ${leave.from} to ${leave.to} (${leave.days} day${leave.days === 1 ? "" : "s"})\n` +
        `📝 *Reason:* ${leave.reason}\n` +
        `Status: *Pending Review*`;

      // Notify Admin(s)
      const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
      for (const adminChatId of adminChatIds) {
        await dispatchToChat({
          token,
          tenantId,
          chatId: adminChatId,
          text,
          event: "LEAVE_SUBMITTED",
          recipientName: "Administrator",
          recipientRole: "ADMIN",
        });
      }
    } else if (eventType === "APPROVED" || eventType === "REJECTED") {
      const isApproved = eventType === "APPROVED";
      const badge = isApproved ? "🟢 APPROVED" : "🔴 REJECTED";

      const text =
        `🏖️ *Leave Decision Notice*\n` +
        `_Business: ${companyName}_\n\n` +
        `Hello ${leave.employee}, your request for *${leave.type}* has been *${badge}*.\n\n` +
        `🗓️ *Duration:* ${leave.from} to ${leave.to} (${leave.days} days)\n` +
        (leave.rejectionReason ? `⚠️ *Reason:* ${leave.rejectionReason}\n` : "") +
        `_This record has been updated in your staff attendance profile._`;

      // Notify Employee on Telegram
      const emp = await getEmployeeChatId(tenantId, {
        name: leave.employee,
        email: leave.employeeEmail,
        employeeId: leave.employeeId,
      });
      if (emp) {
        await dispatchToChat({
          token,
          tenantId,
          chatId: emp.chatId,
          text,
          event: `LEAVE_${eventType}`,
          recipientName: emp.name,
          recipientRole: "EMPLOYEE",
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ Leave Telegram notification error:", err.message);
  }
}

// =========================================================================
// 5. INVENTORY & LOW-STOCK ALERTS
// =========================================================================
// In-memory debounce set to prevent spamming for the same item within 12 hours
const recentInventoryAlerts = new Map();

export async function notifyInventoryAlert({ tenantId, item, eventType = "LOW_STOCK" }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;
    if (ctx.prefs.inventory === false) return;

    const cacheKey = `${tenantId}_${item._id}_${eventType}`;
    const lastSent = recentInventoryAlerts.get(cacheKey);
    const twelveHours = 12 * 60 * 60 * 1000;
    if (lastSent && Date.now() - lastSent < twelveHours) {
      return; // Deduplicated
    }

    const { token, companyName } = ctx;
    const isOut = item.quantity <= 0 || item.stockQuantity <= 0;
    const badge = isOut ? "🚨 OUT OF STOCK" : "⚠️ LOW STOCK ALERT";

    const text =
      `${badge}\n` +
      `_Business: ${companyName}_\n\n` +
      `📦 *Item Name:* ${item.name || item.productName}\n` +
      `🏷️ *SKU:* \`${item.sku || "N/A"}\`\n` +
      `📊 *Current Stock:* ${item.quantity ?? item.stockQuantity ?? 0}\n` +
      `⚠️ *Threshold Limit:* ${item.minStockThreshold || 5}\n` +
      (item.supplier ? `🏭 *Supplier:* ${item.supplier}\n` : "") +
      `_Action recommended: Place a purchase order to replenish stock._`;

    const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
    for (const adminChatId of adminChatIds) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: adminChatId,
        text,
        event: `INVENTORY_${eventType}`,
        recipientName: "Administrator",
        recipientRole: "ADMIN",
      });
    }

    recentInventoryAlerts.set(cacheKey, Date.now());
  } catch (err) {
    console.warn("⚠️ Inventory Telegram alert error:", err.message);
  }
}

// =========================================================================
// 6. PURCHASE ORDER NOTIFICATIONS
// =========================================================================
export async function notifyPurchaseOrderEvent({ tenantId, po, eventType = "CREATED" }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;
    if (ctx.prefs.purchaseOrders === false) return;

    const { token, companyName } = ctx;

    const text =
      `📦 *Purchase Order ${eventType === "CREATED" ? "Generated" : "Updated"}*\n` +
      `_Business: ${companyName}_\n\n` +
      `📄 *PO #:* \`${po.poNumber}\`\n` +
      `🏭 *Supplier:* ${po.supplier}\n` +
      `💰 *Total Amount:* ₹${Number(po.amount || 0).toLocaleString("en-IN")}\n` +
      `📅 *Expected Date:* ${po.expectedDate || "TBD"}\n` +
      `Status: *${po.status}*`;

    const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
    for (const adminChatId of adminChatIds) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: adminChatId,
        text,
        event: `PO_${eventType}`,
        recipientName: "Administrator",
        recipientRole: "ADMIN",
      });
    }
  } catch (err) {
    console.warn("⚠️ PO Telegram notification error:", err.message);
  }
}

// =========================================================================
// 7. DAILY BUSINESS SUMMARY DISPATCHER
// =========================================================================
export async function notifyDailyBusinessSummary({ tenantId }) {
  try {
    const ctx = await getTenantTelegramContext(tenantId);
    if (!ctx) return;

    const { token, companyName, tenant } = ctx;
    const adminChatIds = await getTenantAdminChatIds(tenantId, ctx.adminChatId);
    if (adminChatIds.length === 0) return;

    // Use dynamic summary generator from telegramBot.service
    const { getSummaryData } = await import("./telegramBot.service.js");
    const { text, replyMarkup } = await getSummaryData(tenantId, companyName);

    const morningMessage =
      `☀️ *Good Morning! Here is your Daily Business Executive Report:*\n\n` + text;

    for (const adminChatId of adminChatIds) {
      await dispatchToChat({
        token,
        tenantId,
        chatId: adminChatId,
        text: morningMessage,
        replyMarkup,
        event: "DAILY_SUMMARY",
        recipientName: "Administrator",
        recipientRole: "ADMIN",
      });
    }

    // Mark last sent timestamp on tenant
    tenant.telegramConfig.lastDailySummarySent = new Date();
    await tenant.save();
  } catch (err) {
    console.warn("⚠️ Daily summary Telegram dispatch error:", err.message);
  }
}
