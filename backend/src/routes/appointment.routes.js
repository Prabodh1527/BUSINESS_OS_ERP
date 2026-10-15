import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Appointment from "../models/appointment.model.js";
import Tenant from "../models/Tenant.js";
import Notification from "../models/notification.model.js";
import { sendAppointmentEmail } from "../utils/email.js";
import { getEmployeeIdentity, isEmployeeUser } from "../utils/employeeIdentity.js";
import { notifyAppointmentEvent } from "../services/telegramNotifier.service.js";

const router = express.Router();

// Guard all appointment routes
router.use(protect, attachTenantDB);

// ==========================================
// 1. GET ALL APPOINTMENTS & METRICS
// GET /api/appointments
// ==========================================
router.get("/", async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (isEmployeeUser(req)) {
      const identity = await getEmployeeIdentity(req);
      if (identity) {
        filter.employee = { $in: [identity.name, identity.employeeId, identity.email].filter(Boolean) };
      }
    }

    const appointments = await Appointment.find(filter).sort({ createdAt: -1 });

    const todayStr = new Date().toISOString().slice(0, 10);

    let todayCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;
    let todayRevenue = 0;

    appointments.forEach((apt) => {
      const isToday = apt.date && apt.date.startsWith(todayStr);

      if (isToday) {
        todayCount++;
        if (apt.paymentStatus === "PAID") {
          todayRevenue += Number(apt.amount || 0);
        }
      }

      if (apt.status === "COMPLETED") {
        completedCount++;
      } else if (apt.status === "SCHEDULED" || apt.status === "CONFIRMED") {
        upcomingCount++;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        todayCount,
        upcomingCount,
        completedCount,
        todayRevenue,
      },
      appointments,
      data: appointments,
    });
  } catch (error) {
    console.error("❌ Error fetching appointments:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 1B. GET BOOKING SERVICES FOR TENANT
// GET /api/appointments/services
// ==========================================
router.get("/services", async (req, res) => {
  try {
    const tenant = (await Tenant.findById(req.tenantId)) || (await Tenant.findOne({ ownerId: req.user?._id }));
    const defaultServices = [
      { name: "Executive Consultation", duration: 45, price: 1500, description: "One-on-one session with our senior specialist." },
      { name: "Standard Service Appointment", duration: 30, price: 800, description: "Full comprehensive business service session." },
      { name: "Quick Follow-up / Review", duration: 20, price: 500, description: "Status check and operational assessment." },
    ];
    const services = tenant?.bookingServices?.length > 0 ? tenant.bookingServices : defaultServices;
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 1C. UPDATE BOOKING SERVICES FOR TENANT
// PUT /api/appointments/services
// ==========================================
router.put("/services", async (req, res) => {
  try {
    const { services } = req.body;
    if (!Array.isArray(services)) {
      return res.status(400).json({ success: false, message: "Services must be an array." });
    }
    const tenant = (await Tenant.findById(req.tenantId)) || (await Tenant.findOne({ ownerId: req.user?._id }));
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found." });

    tenant.bookingServices = services;
    await tenant.save();

    return res.status(200).json({
      success: true,
      message: "Booking services updated successfully!",
      data: tenant.bookingServices,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. GET SINGLE APPOINTMENT
// GET /api/appointments/:id
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    return res.status(200).json({
      success: true,
      appointment,
      data: appointment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. CREATE APPOINTMENT
// POST /api/appointments
// ==========================================
router.post("/", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employees cannot create appointments." });
    }
    const {
      customer,
      service,
      employee,
      date,
      time,
      duration = 30,
      amount = 0,
      paymentStatus = "PENDING",
      status = "SCHEDULED",
      notes = "",
    } = req.body;

    const customerObj =
      typeof customer === "string" ? { name: customer } : customer;

    if (!customerObj?.name || !service || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "Customer name, service, date, and time are required.",
      });
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const appointmentId = `APT-${randomSuffix}`;

    const newAppointment = await Appointment.create({
      tenantId: req.tenantId,
      userId: req.user?._id,
      appointmentId,
      customer: customerObj,
      service,
      employee: employee || "Unassigned",
      date,
      time,
      duration: Number(duration) || 30,
      amount: Number(amount) || 0,
      paymentStatus: paymentStatus.toUpperCase(),
      status: status.toUpperCase(),
      notes,
    });

    // Create system notification
    Notification.create({
      tenantId: req.tenantId,
      title: "New Appointment Booked",
      message: `${customerObj.name} booked ${service} on ${date} at ${time}.`,
      type: "Appointment",
      link: "/appointments",
    }).catch(() => {});

    // Send confirmation email to customer (if email exists)
    sendAppointmentEmail(newAppointment, "CONFIRMED").catch(() => {});

    // Send Telegram notifications
    notifyAppointmentEvent({
      tenantId: req.tenantId,
      appointment: newAppointment,
      eventType: "CREATED",
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully!",
      appointment: newAppointment,
      data: newAppointment,
    });
  } catch (error) {
    console.error("❌ Error booking appointment:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. UPDATE APPOINTMENT (STATUS / DETAILS)
// PATCH /api/appointments/:id & PUT /api/appointments/:id
// ==========================================
const handleUpdateAppointment = async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      const identity = await getEmployeeIdentity(req);
      const changes = {};
      if (req.body.status !== undefined) {
        const allowedStatuses = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"];
        if (!allowedStatuses.includes(String(req.body.status).toUpperCase())) {
          return res.status(400).json({ success: false, message: "Invalid appointment status." });
        }
        changes.status = String(req.body.status).toUpperCase();
      }
      if (req.body.notes !== undefined) changes.notes = String(req.body.notes);
      const updated = await Appointment.findOneAndUpdate(
        {
          _id: req.params.id,
          tenantId: req.tenantId,
          employee: { $in: [identity.name, identity.employeeId, identity.email].filter(Boolean) },
        },
        { $set: changes },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(404).json({ success: false, message: "Assigned appointment not found." });
      }
      return res.status(200).json({ success: true, message: "Appointment updated successfully", appointment: updated, data: updated });
    }
    const updated = await Appointment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (req.body.status) {
      sendAppointmentEmail(updated, updated.status).catch(() => {});
    }

    // Trigger Telegram notification
    const eventType = req.body.status || (req.body.date || req.body.time ? "RESCHEDULED" : "UPDATED");
    notifyAppointmentEvent({
      tenantId: req.tenantId,
      appointment: updated,
      eventType,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Appointment updated successfully",
      appointment: updated,
      data: updated,
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

router.patch("/:id", handleUpdateAppointment);
router.put("/:id", handleUpdateAppointment);

// ==========================================
// 5. CANCEL / DELETE APPOINTMENT
// DELETE /api/appointments/:id
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employees cannot delete appointments." });
    }
    const deleted = await Appointment.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    notifyAppointmentEvent({
      tenantId: req.tenantId,
      appointment: deleted,
      eventType: "CANCELLED",
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;