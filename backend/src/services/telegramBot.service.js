/**
 * Telegram Bot Service for Business OS
 * Uses the free Telegram Bot HTTP API with long-polling (or manual webhook/updates).
 * No external paid dependencies.
 */

import Tenant from "../models/Tenant.js";
import Invoice from "../models/invoice.model.js";
import Appointment from "../models/appointment.model.js";
import Task from "../models/task.model.js";
import Inventory from "../models/inventory.model.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

// Track active polling loops per bot token: { [botToken]: { timer: timeoutId, running: boolean, offset: number, tenantId: string } }
const activePollingBots = new Map();

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

/**
 * Get formatted Main Menu UI
 */
function getMainMenu(companyName) {
  const text =
    `👋 *Welcome to ${companyName || "Business OS"} Assistant!*\n\n` +
    `I am your official business operations bot. Select an option below to manage operations directly from Telegram:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📊 Business Summary", callback_data: "menu_summary" },
        { text: "📅 Appointments", callback_data: "menu_appointments" },
      ],
      [
        { text: "🧾 Recent Invoices", callback_data: "menu_invoices" },
        { text: "📦 Inventory & Stock", callback_data: "menu_inventory" },
      ],
      [
        { text: "✅ Tasks & Operations", callback_data: "menu_tasks" },
        { text: "❓ Help & Commands", callback_data: "menu_help" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Fetch dynamic business summary for a tenant
 */
async function getSummaryData(tenantId, companyName) {
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
    `Use the buttons below to explore detailed records:`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "📅 View Today's Appointments", callback_data: "menu_appointments" },
        { text: "🧾 View Invoices", callback_data: "menu_invoices" },
      ],
      [
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Fetch appointments submenu
 */
async function getAppointmentsData(tenantId) {
  const appointments = await Appointment.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(5);

  let text = `📅 *Upcoming & Recent Appointments*\n\n`;

  if (!appointments || appointments.length === 0) {
    text += `_No appointment records found._\n`;
  } else {
    appointments.forEach((apt, idx) => {
      const statusIcon =
        apt.status === "CONFIRMED"
          ? "🟢"
          : apt.status === "COMPLETED"
          ? "✅"
          : apt.status === "CANCELLED"
          ? "❌"
          : "🟡";
      text +=
        `${idx + 1}. *${apt.customer?.name || "Client"}* — ${apt.service}\n` +
        `   🗓️ ${apt.date} at ${apt.time} | Specialist: ${apt.employee || "Unassigned"}\n` +
        `   Status: ${statusIcon} ${apt.status} | Payment: ${apt.paymentStatus}\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "menu_appointments" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Fetch invoices submenu
 */
async function getInvoicesData(tenantId) {
  const invoices = await Invoice.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(5);

  let text = `🧾 *Recent Tax Invoices & Billing*\n\n`;

  if (!invoices || invoices.length === 0) {
    text += `_No invoices found in your tenant records._\n`;
  } else {
    invoices.forEach((inv, idx) => {
      const statusIcon =
        inv.status === "PAID" ? "✅" : inv.status === "PARTIAL" ? "🔵" : "🔴";
      text +=
        `${idx + 1}. *#${inv.invoiceNumber}* - ${inv.customer?.name || "Customer"}\n` +
        `   Grand Total: ₹${Number(inv.grandTotal || 0).toLocaleString("en-IN")}\n` +
        `   Balance Due: ₹${Number(inv.balanceDue || 0).toLocaleString("en-IN")}\n` +
        `   Status: ${statusIcon} ${inv.status}\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "menu_invoices" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Fetch inventory submenu
 */
async function getInventoryData(tenantId) {
  const items = await Inventory.find({ tenantId })
    .sort({ quantity: 1 })
    .limit(6);

  let text = `📦 *Inventory & Low Stock Alerts*\n\n`;

  if (!items || items.length === 0) {
    text += `_No inventory items recorded yet._\n`;
  } else {
    items.forEach((item, idx) => {
      const isLow = Number(item.quantity || 0) <= 5;
      const indicator = isLow ? "⚠️" : "📦";
      text +=
        `${idx + 1}. ${indicator} *${item.name}* (SKU: \`${item.sku || "N/A"}\`)\n` +
        `   In Stock: *${item.quantity ?? 0}* units | Price: ₹${item.price || item.unitPrice || 0}\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "menu_inventory" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Fetch tasks submenu
 */
async function getTasksData(tenantId) {
  const tasks = await Task.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(5);

  let text = `✅ *Active Team Tasks*\n\n`;

  if (!tasks || tasks.length === 0) {
    text += `_No active tasks found._\n`;
  } else {
    tasks.forEach((t, idx) => {
      const icon =
        t.status === "Completed"
          ? "✅"
          : t.status === "In Progress"
          ? "⏳"
          : "📌";
      text +=
        `${idx + 1}. ${icon} *${t.title}*\n` +
        `   Assigned to: ${t.assignedTo || "Unassigned"} | Priority: ${t.priority}\n` +
        `   Due Date: ${t.dueDate || "N/A"} | Status: ${t.status}\n\n`;
    });
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "menu_tasks" },
        { text: "🔙 Main Menu", callback_data: "menu_main" },
      ],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Help submenu
 */
function getHelpData() {
  const text =
    `❓ *Business OS Telegram Bot Help*\n\n` +
    `You can interact with this bot using quick buttons or direct text commands:\n\n` +
    `• */start* or *Hi* / *Hello* — Open the interactive main menu\n` +
    `• */summary* — View quick revenue, appointments, and task status\n` +
    `• */appointments* — Check upcoming client appointments\n` +
    `• */invoices* — Inspect recent billing and payment status\n` +
    `• */inventory* — Inspect stock counts and low-inventory warnings\n` +
    `• */tasks* — See active work orders and team tasks\n` +
    `• */help* — Show this guide\n\n` +
    `_Powered securely by your Business OS instance._`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "🔙 Back to Main Menu", callback_data: "menu_main" }],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Unknown message fallback response
 */
function getUnknownResponse(companyName) {
  const text =
    `🤖 *I didn't quite catch that.*\n\n` +
    `I can help you navigate *${companyName || "Business OS"}* operations with the options below. Please choose an item:`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "🏠 Open Main Menu", callback_data: "menu_main" }],
      [{ text: "❓ View Help & Commands", callback_data: "menu_help" }],
    ],
  };

  return { text, replyMarkup };
}

/**
 * Handle incoming Telegram Update (webhook or polling)
 */
export async function handleTelegramUpdate(botToken, tenantId, update) {
  try {
    const tenant = await Tenant.findOne({ _id: tenantId });
    const companyName = tenant?.companyName || "Business OS";

    // ── Handle Inline Button Clicks (Callback Queries) ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const callbackId = cq.id;
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      const action = cq.data;

      await answerCallbackQuery(botToken, callbackId);

      if (!chatId || !messageId) return;

      if (action === "menu_main") {
        const { text, replyMarkup } = getMainMenu(companyName);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      } else if (action === "menu_summary") {
        const { text, replyMarkup } = await getSummaryData(tenantId, companyName);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      } else if (action === "menu_appointments") {
        const { text, replyMarkup } = await getAppointmentsData(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      } else if (action === "menu_invoices") {
        const { text, replyMarkup } = await getInvoicesData(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      } else if (action === "menu_inventory") {
        const { text, replyMarkup } = await getInventoryData(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      } else if (action === "menu_tasks") {
        const { text, replyMarkup } = await getTasksData(tenantId);
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      } else if (action === "menu_help") {
        const { text, replyMarkup } = getHelpData();
        await editTelegramMessage(botToken, chatId, messageId, text, replyMarkup);
      }
      return;
    }

    // ── Handle Incoming Direct Messages ──
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const rawText = msg.text.trim();
      const lower = rawText.toLowerCase();

      if (!chatId) return;

      // Greeting or /start triggers Main Menu
      if (
        lower === "/start" ||
        lower === "hi" ||
        lower === "hello" ||
        lower === "hey" ||
        lower === "menu" ||
        lower.startsWith("/menu")
      ) {
        const { text, replyMarkup } = getMainMenu(companyName);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      // Quick slash command triggers
      if (lower === "/summary") {
        const { text, replyMarkup } = await getSummaryData(tenantId, companyName);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/appointments") {
        const { text, replyMarkup } = await getAppointmentsData(tenantId);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/invoices") {
        const { text, replyMarkup } = await getInvoicesData(tenantId);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/inventory") {
        const { text, replyMarkup } = await getInventoryData(tenantId);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/tasks") {
        const { text, replyMarkup } = await getTasksData(tenantId);
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      if (lower === "/help" || lower === "help") {
        const { text, replyMarkup } = getHelpData();
        await sendTelegramMessage(botToken, chatId, text, replyMarkup);
        return;
      }

      // Graceful fallback for unrecognized text
      const { text, replyMarkup } = getUnknownResponse(companyName);
      await sendTelegramMessage(botToken, chatId, text, replyMarkup);
    }
  } catch (error) {
    console.error("❌ Error handling Telegram update:", error);
  }
}

/**
 * Long-polling runner for real-time bot updates without requiring public webhook URLs
 */
async function pollTelegramUpdates(botToken, tenantId) {
  const botState = activePollingBots.get(botToken);
  if (!botState || !botState.running) return;

  try {
    const payload = {
      offset: botState.offset,
      timeout: 20, // long-poll for up to 20 seconds
      allowed_updates: ["message", "callback_query"],
    };

    const data = await callTelegramApi(botToken, "getUpdates", payload);

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        botState.offset = update.update_id + 1;
        // Process update asynchronously
        handleTelegramUpdate(botToken, tenantId, update).catch((e) =>
          console.error("Update process error:", e)
        );
      }
    }
  } catch (err) {
    // Wait briefly before retrying on network error
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Continue polling loop if still marked active
  if (activePollingBots.get(botToken)?.running) {
    botState.timer = setTimeout(() => pollTelegramUpdates(botToken, tenantId), 500);
  }
}

/**
 * Start bot polling worker for a given token
 */
export function startTelegramBotPolling(botToken, tenantId) {
  if (!botToken) return;

  // Stop any existing polling for this token
  stopTelegramBotPolling(botToken);

  const state = {
    running: true,
    offset: 0,
    tenantId,
    timer: null,
  };
  activePollingBots.set(botToken, state);

  // Clear any existing webhook to enable getUpdates polling
  callTelegramApi(botToken, "deleteWebhook").then(() => {
    pollTelegramUpdates(botToken, tenantId);
    console.log(`🤖 Telegram Bot polling started for tenant: ${tenantId}`);
  }).catch((e) => {
    console.warn("⚠️ Failed to delete webhook before polling:", e.message);
    pollTelegramUpdates(botToken, tenantId);
  });
}

/**
 * Stop polling worker for a bot token
 */
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

/**
 * Initialize all connected bots across active tenants on server startup
 */
export async function initializeConnectedTelegramBots() {
  try {
    // Check environment variable bot token first
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
