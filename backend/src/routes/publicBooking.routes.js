import express from "express";
import Tenant from "../models/Tenant.js";
import Appointment from "../models/appointment.model.js";
import Customer from "../models/customer.model.js";
import Employee from "../models/employee.model.js";
import Notification from "../models/notification.model.js";
import { sendAppointmentEmail } from "../utils/email.js";
import { notifyAppointmentEvent } from "../services/telegramNotifier.service.js";

const router = express.Router();

// Helper to find tenant by ID or name slug
async function findTenantBySlugOrId(identifier) {
  if (!identifier) return null;
  // If valid MongoDB ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
    const t = await Tenant.findById(identifier);
    if (t) return t;
  }

  // Try matching companyName case-insensitively with dashes replaced by spaces
  const nameQuery = identifier.replace(/-/g, " ");
  return await Tenant.findOne({
    companyName: { $regex: new RegExp(`^${nameQuery}$`, "i") },
  });
}

/**
 * GET /api/public/booking/:slug
 * Fetch public booking info for a business
 */
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    let tenant = await findTenantBySlugOrId(slug);

    // Fallback: If slug is "default", grab the primary tenant
    if (!tenant && (slug === "default" || slug === "demo")) {
      tenant = await Tenant.findOne();
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Business profile not found. Please check your booking link.",
      });
    }

    // Fetch active team members
    const employees = await Employee.find({
      tenantId: tenant._id.toString(),
      status: "Active",
    }).select("name position employeeId");

    // Standard business services
    const defaultServices = [
      { id: "s1", name: "Executive Consultation", duration: 45, price: 1500, description: "One-on-one session with our senior specialist." },
      { id: "s2", name: "Standard Service Appointment", duration: 30, price: 800, description: "Full comprehensive business service session." },
      { id: "s3", name: "Quick Follow-up / Review", duration: 20, price: 500, description: "Status check and operational assessment." },
    ];

    const timeSlots = [
      "09:30 AM",
      "10:30 AM",
      "11:30 AM",
      "12:30 PM",
      "02:00 PM",
      "03:00 PM",
      "04:00 PM",
      "05:00 PM",
      "06:00 PM",
    ];

    return res.status(200).json({
      success: true,
      data: {
        tenantId: tenant._id.toString(),
        companyName: tenant.companyName || "Business OS Portal",
        businessType: tenant.businessType || "Professional Services",
        description: tenant.description || "Schedule your appointment online instantly with our team.",
        businessEmail: tenant.businessEmail || "",
        businessPhone: tenant.businessPhone || "",
        address: [tenant.address, tenant.city, tenant.state].filter(Boolean).join(", "),
        services: defaultServices,
        specialists: employees.map((e) => ({ name: e.name, position: e.position || "Specialist" })),
        timeSlots,
      },
    });
  } catch (error) {
    console.error("Public booking fetch error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/public/booking/:slug
 * Create an appointment from the public booking portal
 */
router.post("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    let tenant = await findTenantBySlugOrId(slug);

    if (!tenant && (slug === "default" || slug === "demo")) {
      tenant = await Tenant.findOne();
    }

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Business not found." });
    }

    const tenantId = tenant._id.toString();
    const {
      customerName,
      customerPhone,
      customerEmail = "",
      service,
      employee = "Unassigned",
      date,
      time,
      notes = "",
      amount = 0,
    } = req.body;

    if (!customerName || !customerPhone || !service || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone number, service, date, and time are required.",
      });
    }

    // 1. Create or upsert customer in CRM
    let customer = await Customer.findOne({
      tenantId,
      $or: [{ phone: customerPhone }, ...(customerEmail ? [{ email: customerEmail.toLowerCase() }] : [])],
    });

    if (!customer) {
      customer = await Customer.create({
        tenantId,
        name: customerName,
        phone: customerPhone,
        email: customerEmail ? customerEmail.toLowerCase() : "",
        notes: `Created via Public Booking Portal for ${service}`,
      }).catch(() => null);
    }

    // 2. Generate Reference ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const appointmentId = `APT-PUB-${randomSuffix}`;

    // 3. Create Appointment
    const appointment = await Appointment.create({
      tenantId,
      appointmentId,
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
      },
      service,
      employee: employee || "Assigned Team Specialist",
      date,
      time,
      duration: 30,
      amount: Number(amount) || 0,
      paymentStatus: "PENDING",
      status: "CONFIRMED",
      notes: notes ? `Public Booking: ${notes}` : "Booked via Public Web Portal",
    });

    // 4. In-App Notification for Business Staff
    Notification.create({
      tenantId,
      title: "New Online Client Booking",
      message: `${customerName} booked ${service} on ${date} at ${time}.`,
      type: "Appointment",
      link: "/appointments",
    }).catch(() => {});

    // 5. Send Email to Customer
    if (customerEmail) {
      sendAppointmentEmail(appointment, "CONFIRMED").catch(() => {});
    }

    // 6. Send Telegram & WhatsApp Notifications Automatically
    notifyAppointmentEvent({
      tenantId,
      appointment,
      eventType: "CONFIRMED",
    }).catch((err) => console.warn("Telegram/WhatsApp dispatch warning:", err.message));

    return res.status(201).json({
      success: true,
      message: "Appointment confirmed successfully!",
      data: {
        appointmentId: appointment.appointmentId,
        service: appointment.service,
        date: appointment.date,
        time: appointment.time,
        specialist: appointment.employee,
        companyName: tenant.companyName,
      },
    });
  } catch (error) {
    console.error("Public booking submit error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
