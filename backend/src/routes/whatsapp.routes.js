import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Tenant from "../models/Tenant.js";
import Invoice from "../models/invoice.model.js";
import Appointment from "../models/appointment.model.js";
import {
  verifyWhatsAppCredentials,
  sendWhatsAppMessage,
  generateWhatsAppDeepLink,
  formatInvoiceWhatsAppText,
  formatAppointmentWhatsAppText,
  handleIncomingWhatsAppMessage,
  sanitizePhoneNumber,
} from "../services/whatsapp.service.js";
import { recordAuditLog } from "../utils/auditLogger.js";

const router = express.Router();

// ==========================================
// 1. PUBLIC META WEBHOOK ENDPOINTS
// ==========================================

/**
 * Meta Webhook Handshake Verification
 * GET /api/whatsapp/webhook/:tenantId
 */
router.get("/webhook/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const tenant = await Tenant.findById(tenantId);
    const expectedToken = tenant?.whatsappConfig?.webhookVerifyToken || "business_os_wa_verify_token";

    if (mode === "subscribe" && token === expectedToken) {
      console.log(`✅ WhatsApp Meta Webhook verified for tenant: ${tenantId}`);
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Verification token mismatch");
  } catch (error) {
    return res.status(500).send("Server error");
  }
});

/**
 * Meta Webhook Incoming Message Receiver
 * POST /api/whatsapp/webhook/:tenantId
 */
router.post("/webhook/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    handleIncomingWhatsAppMessage(tenantId, req.body).catch((err) =>
      console.error("WhatsApp webhook error:", err)
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: false });
  }
});

// Guard all configuration and authenticated endpoints
router.use(protect, attachTenantDB);

// ==========================================
// 2. STATUS & CREDENTIAL MANAGEMENT
// ==========================================

/**
 * GET /api/whatsapp/status
 */
router.get("/status", async (req, res) => {
  try {
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    const envToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

    const storedConfig = tenant?.whatsappConfig || {};
    const effectiveToken = storedConfig.accessToken || envToken;
    const effectivePhoneId = storedConfig.phoneNumberId || envPhoneId;

    let accountDetails = null;
    let isLive = false;

    if (effectiveToken && effectivePhoneId) {
      const verify = await verifyWhatsAppCredentials({
        phoneNumberId: effectivePhoneId,
        accessToken: effectiveToken,
      });
      if (verify.valid) {
        accountDetails = verify.data;
        isLive = true;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        connected: Boolean(storedConfig.connected && isLive),
        phoneNumberId: effectivePhoneId,
        businessPhoneNumber: storedConfig.businessPhoneNumber || accountDetails?.displayPhoneNumber || "",
        verifiedName: accountDetails?.verifiedName || "",
        connectedAt: storedConfig.connectedAt || null,
        hasEnvConfig: Boolean(envToken && envPhoneId),
        maskedToken: effectiveToken ? `${effectiveToken.slice(0, 7)}...${effectiveToken.slice(-5)}` : "",
        webhookVerifyToken: storedConfig.webhookVerifyToken || "business_os_wa_verify_token",
        notificationPreferences: storedConfig.notificationPreferences || {
          appointments: true,
          invoices: true,
          tasks: true,
          inventory: true,
          dailySummary: true,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/whatsapp/test
 */
router.post("/test", async (req, res) => {
  try {
    const { phoneNumberId, accessToken } = req.body;
    const targetPhoneId = phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const targetToken = accessToken?.trim() || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!targetPhoneId || !targetToken) {
      return res.status(400).json({
        success: false,
        message: "Phone Number ID and Access Token are required.",
      });
    }

    const verification = await verifyWhatsAppCredentials({
      phoneNumberId: targetPhoneId,
      accessToken: targetToken,
    });

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: `Validation Failed: ${verification.error}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verified! Account: ${verification.data.verifiedName} (${verification.data.displayPhoneNumber})`,
      account: verification.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/whatsapp/connect
 */
router.post("/connect", async (req, res) => {
  try {
    const { phoneNumberId, accessToken, businessPhoneNumber, businessAccountId } = req.body;
    const targetPhoneId = phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const targetToken = accessToken?.trim() || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!targetPhoneId || !targetToken) {
      return res.status(400).json({
        success: false,
        message: "Phone Number ID and Access Token from Meta Developer Console are required.",
      });
    }

    // Verify with Meta
    const verification = await verifyWhatsAppCredentials({
      phoneNumberId: targetPhoneId,
      accessToken: targetToken,
    });

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

    const existingPrefs = tenant.whatsappConfig?.notificationPreferences || {};
    tenant.whatsappConfig = {
      phoneNumberId: targetPhoneId,
      accessToken: targetToken,
      businessPhoneNumber: businessPhoneNumber || verification.data.displayPhoneNumber || "",
      businessAccountId: businessAccountId || "",
      connected: true,
      connectedAt: new Date(),
      webhookVerifyToken: tenant.whatsappConfig?.webhookVerifyToken || "business_os_wa_verify_token",
      notificationPreferences: {
        appointments: existingPrefs.appointments !== false,
        invoices: existingPrefs.invoices !== false,
        tasks: existingPrefs.tasks !== false,
        inventory: existingPrefs.inventory !== false,
        dailySummary: existingPrefs.dailySummary !== false,
      },
    };
    tenant.markModified("whatsappConfig");
    await tenant.save();

    recordAuditLog({
      tenantId: tenant._id.toString(),
      user: req.user,
      action: "CONNECT_WHATSAPP_API",
      module: "INTEGRATIONS",
      details: `Connected WhatsApp Business Account (${verification.data.verifiedName})`,
    });

    return res.status(200).json({
      success: true,
      message: `WhatsApp Business connected successfully! (${verification.data.verifiedName})`,
      data: {
        connected: true,
        verifiedName: verification.data.verifiedName,
        displayPhoneNumber: verification.data.displayPhoneNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/whatsapp/disconnect
 */
router.post("/disconnect", async (req, res) => {
  try {
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    if (tenant.whatsappConfig) {
      tenant.whatsappConfig.connected = false;
      tenant.whatsappConfig.connectedAt = null;
      await tenant.save();
    }

    recordAuditLog({
      tenantId: tenant._id.toString(),
      user: req.user,
      action: "DISCONNECT_WHATSAPP_API",
      module: "INTEGRATIONS",
      details: "Disconnected WhatsApp Business integration",
    });

    return res.status(200).json({
      success: true,
      message: "WhatsApp Business API disconnected.",
      data: { connected: false },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/whatsapp/preferences
 */
router.put("/preferences", async (req, res) => {
  try {
    const { notificationPreferences } = req.body;
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    if (!tenant.whatsappConfig) tenant.whatsappConfig = {};
    if (notificationPreferences) {
      tenant.whatsappConfig.notificationPreferences = {
        ...(tenant.whatsappConfig.notificationPreferences || {}),
        ...notificationPreferences,
      };
      tenant.markModified("whatsappConfig");
      await tenant.save();
    }

    return res.status(200).json({
      success: true,
      message: "WhatsApp notification preferences updated!",
      data: tenant.whatsappConfig.notificationPreferences,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. TESTING & 1-CLICK DISPATCH
// ==========================================

/**
 * POST /api/whatsapp/send-test
 * Dispatches an instant test message to any WhatsApp number
 */
router.post("/send-test", async (req, res) => {
  try {
    const { recipientPhone, message } = req.body;
    if (!recipientPhone) {
      return res.status(400).json({ success: false, message: "Recipient phone number is required." });
    }

    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    const config = tenant?.whatsappConfig || {};
    const token = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp API is not connected. Configure credentials first.",
      });
    }

    const text = message || `Hello! This is a test message from ${tenant?.companyName || "Business OS"} WhatsApp integration. Everything is operational!`;
    const result = await sendWhatsAppMessage({
      phoneNumberId: phoneId,
      accessToken: token,
      to: recipientPhone,
      text,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    return res.status(200).json({
      success: true,
      message: `Test WhatsApp message delivered to ${recipientPhone}!`,
      messageId: result.messageId,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/whatsapp/share-link
 * Generates instant 100% free "wa.me" deep links for Invoices or Appointments
 */
router.get("/share-link", async (req, res) => {
  try {
    const { type, id, phone } = req.query;
    const tenant = (await Tenant.findOne({ _id: req.tenantId })) || (await Tenant.findOne({ ownerId: req.user?._id }));
    const companyName = tenant?.companyName || "Business OS";

    let message = "";
    let targetPhone = phone || "";

    if (type === "invoice" && id) {
      const inv = await Invoice.findOne({ _id: id, tenantId: req.tenantId });
      if (inv) {
        targetPhone = targetPhone || inv.customer?.phone || "";
        message = formatInvoiceWhatsAppText(inv, companyName);
      }
    } else if (type === "appointment" && id) {
      const apt = await Appointment.findOne({ _id: id, tenantId: req.tenantId });
      if (apt) {
        targetPhone = targetPhone || apt.customer?.phone || "";
        message = formatAppointmentWhatsAppText(apt, companyName);
      }
    } else {
      message = `Hello! Contacting ${companyName} regarding our services.`;
    }

    const link = generateWhatsAppDeepLink({ phone: targetPhone, message });
    return res.status(200).json({ success: true, url: link, text: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
