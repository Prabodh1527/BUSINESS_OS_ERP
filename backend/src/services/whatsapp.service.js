/**
 * WhatsApp Business Automation Service for Business OS
 * Supports:
 * 1. Meta's Official WhatsApp Cloud API (Free Tier: 1,000 free monthly conversations)
 * 2. Instant 100% Free 1-Click WhatsApp Direct Dispatch ("wa.me" deep links with pre-filled templates)
 * 3. Incoming webhook auto-responder for client greetings & inquiries
 * Zero external paid dependencies.
 */

import Tenant from "../models/Tenant.js";
import Appointment from "../models/appointment.model.js";
import Invoice from "../models/invoice.model.js";

const META_GRAPH_BASE = "https://graph.facebook.com/v20.0";

/**
 * Standardize and sanitize phone number for WhatsApp
 * Strips non-digits, adds default India 91 prefix if 10-digit number
 */
export function sanitizePhoneNumber(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`; // Default to +91 for standard 10-digit mobile numbers
  }
  return cleaned;
}

/**
 * Verify WhatsApp credentials with Meta Graph API
 */
export async function verifyWhatsAppCredentials({ phoneNumberId, accessToken }) {
  try {
    const url = `${META_GRAPH_BASE}/${phoneNumberId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (data.id && (data.verified_name || data.display_phone_number)) {
      return {
        valid: true,
        data: {
          id: data.id,
          verifiedName: data.verified_name || "WhatsApp Business Account",
          displayPhoneNumber: data.display_phone_number || "",
          qualityRating: data.quality_rating || "GREEN",
        },
      };
    }

    if (data.error) {
      return {
        valid: false,
        error: data.error.message || "Meta API credential validation failed.",
      };
    }

    return { valid: false, error: "Invalid credentials or Phone Number ID." };
  } catch (err) {
    return {
      valid: false,
      error: err.message || "Failed to reach Meta WhatsApp Graph API.",
    };
  }
}

/**
 * Send official WhatsApp message via Meta Cloud API
 * Supports both freeform text (within 24h window) and official pre-approved templates (like 'hello_world')
 */
export async function sendWhatsAppMessage({ phoneNumberId, accessToken, to, text, templateName, languageCode = "en_US" }) {
  const recipient = sanitizePhoneNumber(to);
  if (!recipient || !phoneNumberId || !accessToken || (!text && !templateName)) {
    return { success: false, error: "Missing required parameters for WhatsApp message." };
  }

  try {
    const url = `${META_GRAPH_BASE}/${phoneNumberId}/messages`;
    
    // Choose payload: template or freeform text
    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: true,
            body: text,
          },
        };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.messages && data.messages.length > 0) {
      return { success: true, messageId: data.messages[0].id, type: payload.type };
    }

    const errMsg = data.error?.error_user_msg || data.error?.message || "Failed to deliver WhatsApp message.";
    const errDetails = data.error?.error_data?.details || "";
    return {
      success: false,
      error: errDetails ? `${errMsg} (${errDetails})` : errMsg,
      rawError: data.error,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Generate 100% Free "wa.me" 1-Click WhatsApp Direct URL
 * (Opens WhatsApp on Mobile or Web with pre-formatted message - requires $0 and zero Meta API setup)
 */
export function generateWhatsAppDeepLink({ phone, message }) {
  const recipient = sanitizePhoneNumber(phone);
  const encoded = encodeURIComponent(message || "");
  if (recipient) {
    return `https://wa.me/${recipient}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Format standard WhatsApp message for an Invoice
 */
export function formatInvoiceWhatsAppText(invoice, companyName = "Business OS", eventType = "CREATED") {
  const isPaid = invoice.status === "PAID";
  const upiId = invoice.upiId || "merchant@upi";

  let title = `🧾 *Tax Invoice #${invoice.invoiceNumber}*`;
  if (eventType === "PAYMENT_RECEIVED") {
    title = `💵 *Payment Received - Invoice #${invoice.invoiceNumber}*`;
  } else if (eventType === "OVERDUE") {
    title = `⚠️ *Payment Reminder - Invoice #${invoice.invoiceNumber}*`;
  }

  return (
    `${title}\n` +
    `_From: ${companyName}_\n\n` +
    `Dear *${invoice.customer?.name || "Valued Client"}*,\n` +
    `Here are your latest invoice details:\n\n` +
    `💰 *Grand Total:* ₹${Number(invoice.grandTotal || 0).toLocaleString("en-IN")}\n` +
    `💵 *Amount Paid:* ₹${Number(invoice.amountPaid || 0).toLocaleString("en-IN")}\n` +
    `💳 *Balance Due:* ₹${Number(invoice.balanceDue || 0).toLocaleString("en-IN")}\n` +
    `📊 *Status:* ${isPaid ? "✅ PAID IN FULL" : "🔴 PAYMENT DUE"}\n` +
    `🗓️ *Due Date:* ${invoice.dueDate || "Due upon receipt"}\n\n` +
    (!isPaid
      ? `📲 *Quick UPI Payment:* Pay to UPI ID \`${upiId}\` or scan our counter QR code.\n\n`
      : "🎉 *Thank you for your payment!*\n\n") +
    `_Please reply to this message if you have any questions._`
  );
}

/**
 * Format standard WhatsApp message for an Appointment
 */
export function formatAppointmentWhatsAppText(appointment, companyName = "Business OS", type = "CONFIRMED") {
  const titles = {
    CONFIRMED: "Appointment Confirmation",
    SCHEDULED: "Appointment Scheduled",
    REMINDER: "Appointment Reminder",
    CANCELLED: "Appointment Notice",
  };
  const title = titles[type] || "Appointment Update";

  return (
    `📅 *${title}*\n` +
    `_With: ${companyName}_\n\n` +
    `Hello *${appointment.customer?.name || "Client"}*,\n` +
    `Your appointment has been recorded with our team:\n\n` +
    `📌 *Reference:* \`${appointment.appointmentId}\`\n` +
    `🛠️ *Service:* ${appointment.service}\n` +
    `🗓️ *Date:* ${appointment.date}\n` +
    `⏰ *Time:* ${appointment.time}\n` +
    `👨‍💼 *Staff Specialist:* ${appointment.employee || "Assigned Team Member"}\n` +
    `📊 *Status:* *${appointment.status}*\n\n` +
    `_Need to reschedule? Reply directly to this message or contact us._`
  );
}

/**
 * Handle incoming Meta Webhook events (incoming customer messages)
 */
export async function handleIncomingWhatsAppMessage(tenantId, payload) {
  try {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || !message.text?.body) return;

    const from = message.from; // Sender's phone number
    const textBody = message.text.body.trim().toLowerCase();

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return;

    const config = tenant.whatsappConfig || {};
    const token = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) return;

    // Greeting auto-responder
    if (
      textBody === "hi" ||
      textBody === "hello" ||
      textBody === "hey" ||
      textBody === "menu" ||
      textBody.startsWith("help")
    ) {
      const welcome =
        `👋 *Welcome to ${tenant.companyName || "Business OS"}!*\n\n` +
        `Thank you for reaching out to us on WhatsApp. How can we help you today?\n\n` +
        `1️⃣ *Appointments:* View or request an appointment\n` +
        `2️⃣ *Invoices:* Check your billing & payment receipts\n` +
        `3️⃣ *Working Hours:* ${tenant.openTime || "09:00"} - ${tenant.closeTime || "19:00"}\n` +
        `4️⃣ *Support:* Reply with your query to chat with our staff.\n\n` +
        `_A team member will be with you shortly!_`;

      await sendWhatsAppMessage({
        phoneNumberId: phoneId,
        accessToken: token,
        to: from,
        text: welcome,
      });
    }
  } catch (err) {
    console.warn("⚠️ WhatsApp incoming webhook error:", err.message);
  }
}
