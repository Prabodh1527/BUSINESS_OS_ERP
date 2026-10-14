import Tenant from "../models/Tenant.js";
import Appointment from "../models/appointment.model.js";
import { notifyDailyBusinessSummary, notifyAppointmentEvent } from "./telegramNotifier.service.js";

// Set of appointment IDs that have already received reminders today to prevent duplicates
const remindedAppointmentsToday = new Set();
let lastResetDate = new Date().toISOString().slice(0, 10);

/**
 * Check and dispatch scheduled Telegram automation
 */
export async function runTelegramScheduledChecks() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Reset daily cache at midnight
    if (todayStr !== lastResetDate) {
      remindedAppointmentsToday.clear();
      lastResetDate = todayStr;
    }

    // Format current time as "HH:MM" (e.g. "09:00")
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;

    const tenants = await Tenant.find({
      $or: [
        { "telegramConfig.connected": true },
        ...(process.env.TELEGRAM_BOT_TOKEN ? [{ status: "ACTIVE" }] : []),
      ],
    });

    for (const tenant of tenants) {
      const config = tenant.telegramConfig || {};
      const prefs = config.notificationPreferences || {};

      // ── 1. Daily Business Summary Check ──
      if (prefs.dailySummary !== false) {
        const targetTime = prefs.dailySummaryTime || "09:00";
        const lastSentDate = config.lastDailySummarySent
          ? new Date(config.lastDailySummarySent).toISOString().slice(0, 10)
          : null;

        // Check if current time matches scheduled time and hasn't been sent today
        if (currentTimeStr === targetTime && lastSentDate !== todayStr) {
          notifyDailyBusinessSummary({ tenantId: tenant._id.toString() }).catch((err) =>
            console.warn(`Daily summary failed for tenant ${tenant._id}:`, err.message)
          );
        }
      }

      // ── 2. Today's Appointment Reminders ──
      if (prefs.appointments !== false) {
        const appointmentsToday = await Appointment.find({
          tenantId: tenant._id.toString(),
          date: { $regex: `^${todayStr}` },
          status: { $in: ["CONFIRMED", "SCHEDULED"] },
        });

        for (const apt of appointmentsToday) {
          const reminderKey = `${apt._id}_${todayStr}`;
          if (!remindedAppointmentsToday.has(reminderKey)) {
            remindedAppointmentsToday.add(reminderKey);

            notifyAppointmentEvent({
              tenantId: tenant._id.toString(),
              appointment: apt,
              eventType: "REMINDER",
            }).catch((err) =>
              console.warn(`Appointment reminder failed for apt ${apt.appointmentId}:`, err.message)
            );
          }
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ Telegram scheduled check error:", error.message);
  }
}

/**
 * Initialize background cron worker (runs every 60 seconds)
 */
export function startTelegramScheduler() {
  // Run initial check after 10 seconds of startup
  setTimeout(() => runTelegramScheduledChecks(), 10000);

  // Interval check every 60 seconds
  setInterval(() => {
    runTelegramScheduledChecks();
  }, 60000);

  console.log("⏰ Telegram background scheduler started (Daily summaries & Appointment reminders)");
}
