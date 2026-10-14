import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Tenant from "../models/Tenant.js";
import {
  verifyTelegramBotToken,
  startTelegramBotPolling,
  stopTelegramBotPolling,
  sendTelegramMessage,
  handleTelegramUpdate,
} from "../services/telegramBot.service.js";
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

// Guard configuration routes with authentication
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

    // Update tenant configuration
    tenant.telegramConfig = {
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

export default router;
