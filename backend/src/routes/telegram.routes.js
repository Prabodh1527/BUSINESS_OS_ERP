import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import TelegramLog from "../models/telegramLog.model.js";
import {
  verifyTelegramBotToken,
  startTelegramBotPolling,
  stopTelegramBotPolling,
  sendTelegramMessage,
  handleTelegramUpdate,
  generateUserLinkToken,
  unlinkTelegramAccount,
} from "../services/telegramBot.service.js";
import { notifyDailyBusinessSummary } from "../services/telegramNotifier.service.js";
import { recordAuditLog } from "../utils/auditLogger.js";

const router = express.Router();

/**
 * Public Webhook endpoint for Telegram (if user or deployment uses webhook mode)
 * POST /api/telegram/webhook/:tenantId
 */
router.post("/webhook/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await Tenant.findOne({ _id: tenantId });
    const botToken = tenant?.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken || !tenant?.telegramConfig?.connected) {
      return res.status(200).json({ ok: true, message: "Bot not configured or active" });
    }

    // Process update asynchronously
    handleTelegramUpdate(botToken, tenantId, req.body).catch((err) =>
      console.error("Webhook processing error:", err)
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(200).json({ ok: false, error: error.message });
  }
});

// Guard all configuration and authenticated routes
router.use(protect, attachTenantDB);

/**
 * GET /api/telegram/status
 * Get connection status and bot username
 */
router.get("/status", async (req, res) => {
  try {
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN || "";

    const storedConfig = tenant?.telegramConfig || {};
    const effectiveToken = storedConfig.botToken || envBotToken;

    let botDetails = null;
    let isLive = false;

    if (effectiveToken) {
      const verify = await verifyTelegramBotToken(effectiveToken);
      if (verify.valid) {
        botDetails = verify.bot;
        isLive = true;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        connected: Boolean(storedConfig.connected && isLive),
        botUsername: storedConfig.botUsername || botDetails?.username || "",
        botName: botDetails?.firstName || "",
        connectedAt: storedConfig.connectedAt || null,
        hasEnvToken: Boolean(envBotToken),
        maskedToken: effectiveToken ? `${effectiveToken.slice(0, 7)}...${effectiveToken.slice(-5)}` : "",
        adminChatId: storedConfig.adminChatId || "",
        notificationPreferences: storedConfig.notificationPreferences || {
          appointments: true,
          invoices: true,
          tasks: true,
          leaves: true,
          inventory: true,
          purchaseOrders: true,
          dailySummary: true,
          dailySummaryTime: "09:00",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/telegram/test
 * Test the Telegram Bot token validity
 */
router.post("/test", async (req, res) => {
  try {
    const token = req.body.botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Bot Token is required to test the connection.",
      });
    }

    const verification = await verifyTelegramBotToken(token);

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: `Verification Failed: ${verification.error}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully reached Telegram Bot @${verification.bot.username} (${verification.bot.firstName})!`,
      bot: verification.bot,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/telegram/connect
 * Connect and activate Telegram Bot for tenant
 */
router.post("/connect", async (req, res) => {
  try {
    const rawToken = req.body.botToken?.trim();
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    const token = rawToken || envToken;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid Telegram Bot Token obtained from @BotFather.",
      });
    }

    // Verify token with Telegram
    const verification = await verifyTelegramBotToken(token);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: `Could not connect: ${verification.error}`,
      });
    }

    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant record not found." });
    }

    // Update tenant configuration while preserving existing preferences
    tenant.telegramConfig = {
      ...(tenant.telegramConfig || {}),
      botToken: token,
      botUsername: verification.bot.username,
      connected: true,
      connectedAt: new Date(),
    };
    await tenant.save();

    // Start live long-polling for real-time messages
    startTelegramBotPolling(token, tenant._id.toString());

    recordAuditLog({
      tenantId: tenant._id.toString(),
      user: req.user,
      action: "CONNECT_TELEGRAM_BOT",
      module: "INTEGRATIONS",
      details: `Connected Telegram Bot @${verification.bot.username}`,
    });

    return res.status(200).json({
      success: true,
      message: `Telegram Bot @${verification.bot.username} connected and running!`,
      data: {
        connected: true,
        botUsername: verification.bot.username,
        botName: verification.bot.firstName,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/telegram/disconnect
 * Disconnect and deactivate Telegram Bot
 */
router.post("/disconnect", async (req, res) => {
  try {
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant record not found." });
    }

    const currentToken = tenant.telegramConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (currentToken) {
      stopTelegramBotPolling(currentToken);
    }

    tenant.telegramConfig.connected = false;
    tenant.telegramConfig.connectedAt = null;
    await tenant.save();

    recordAuditLog({
      tenantId: tenant._id.toString(),
      user: req.user,
      action: "DISCONNECT_TELEGRAM_BOT",
      module: "INTEGRATIONS",
      details: "Disconnected Telegram Bot integration",
    });

    return res.status(200).json({
      success: true,
      message: "Telegram Bot disconnected successfully.",
      data: { connected: false },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/telegram/preferences
 * Get tenant notification preferences
 */
router.get("/preferences", async (req, res) => {
  try {
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    const config = tenant?.telegramConfig || {};

    return res.status(200).json({
      success: true,
      data: {
        adminChatId: config.adminChatId || "",
        notificationPreferences: config.notificationPreferences || {
          appointments: true,
          invoices: true,
          tasks: true,
          leaves: true,
          inventory: true,
          purchaseOrders: true,
          dailySummary: true,
          dailySummaryTime: "09:00",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/telegram/preferences
 * Update tenant notification preferences
 */
router.put("/preferences", async (req, res) => {
  try {
    const { notificationPreferences, adminChatId } = req.body;
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant record not found." });
    }

    if (!tenant.telegramConfig) {
      tenant.telegramConfig = {};
    }

    if (adminChatId !== undefined) {
      tenant.telegramConfig.adminChatId = adminChatId.trim();
    }

    if (notificationPreferences && typeof notificationPreferences === "object") {
      tenant.telegramConfig.notificationPreferences = {
        ...tenant.telegramConfig.notificationPreferences,
        ...notificationPreferences,
      };
    }

    await tenant.save();

    recordAuditLog({
      tenantId: tenant._id.toString(),
      user: req.user,
      action: "UPDATE_TELEGRAM_PREFERENCES",
      module: "INTEGRATIONS",
      details: "Updated Telegram notification preferences",
    });

    return res.status(200).json({
      success: true,
      message: "Notification preferences saved successfully!",
      data: {
        adminChatId: tenant.telegramConfig.adminChatId,
        notificationPreferences: tenant.telegramConfig.notificationPreferences,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/telegram/link-token
 * Generate single-use linking token for current user
 */
router.post("/link-token", async (req, res) => {
  try {
    const result = await generateUserLinkToken(req.user._id);

    return res.status(200).json({
      success: true,
      data: result,
      message: `Linking code generated: ${result.code}. Valid for 15 minutes.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/telegram/account
 * Get current user's Telegram link status
 */
router.get("/account", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        linked: Boolean(user.telegramLinked && user.telegramChatId),
        telegramUsername: user.telegramUsername || "",
        telegramChatId: user.telegramChatId || "",
        telegramLinkedAt: user.telegramLinkedAt || null,
        pendingToken: user.telegramLinkTokenExpires > new Date() ? user.telegramLinkToken : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/telegram/unlink
 * Unlink current user's Telegram account
 */
router.post("/unlink", async (req, res) => {
  try {
    await unlinkTelegramAccount(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Your Telegram account has been unlinked successfully.",
      data: { linked: false },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/telegram/logs
 * Retrieve recent Telegram delivery audit logs
 */
router.get("/logs", async (req, res) => {
  try {
    const logs = await TelegramLog.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .limit(25);

    return res.status(200).json({
      success: true,
      logs,
      data: logs,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/telegram/send-summary-now
 * Manually trigger daily executive summary delivery to admin
 */
router.post("/send-summary-now", async (req, res) => {
  try {
    await notifyDailyBusinessSummary({ tenantId: req.tenantId });

    return res.status(200).json({
      success: true,
      message: "Daily Executive Summary dispatched to authorized administrator(s)!",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
