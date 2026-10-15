import express from "express";

import { protect } from "../middleware/auth.middleware.js";

import {
  getMasters,
  createMaster,
  updateMaster,
  deleteMaster,
} from "../controllers/master.controller.js";

const router = express.Router();

// ==========================================
// PROTECT ALL MASTER ROUTES
// ==========================================
router.use(protect);

// ==========================================
// CLEAR ALL MASTERS (WIPE DATA)
// DELETE /api/masters/clear-all
// ==========================================
router.delete("/clear-all", async (req, res) => {
  try {
    const Master = (await import("../models/Master.js")).default;
    const result = await Master.deleteMany({ tenantId: req.tenantId });
    return res.status(200).json({
      success: true,
      message: "All master data removed.",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/clear-all", async (req, res) => {
  try {
    const Master = (await import("../models/Master.js")).default;
    const result = await Master.deleteMany({ tenantId: req.tenantId });
    return res.status(200).json({
      success: true,
      message: "All master data removed.",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// MASTER COLLECTION
// GET  /api/masters
// POST /api/masters
// ==========================================
router
  .route("/")
  .get(getMasters)
  .post(createMaster);

// ==========================================
// SINGLE MASTER
// PATCH  /api/masters/:id
// DELETE /api/masters/:id
// ==========================================
router
  .route("/:id")
  .patch(updateMaster)
  .delete(deleteMaster);

// ==========================================
// SEND CELEBRATION GREETING (EMAIL / WHATSAPP TEMPLATE)
// POST /api/masters/send-greeting
// ==========================================
router.post("/send-greeting", async (req, res) => {
  try {
    const { sendCelebrationEmail } = await import("../utils/email.js");
    const Employee = (await import("../models/employee.model.js")).default;
    const Tenant = (await import("../models/Tenant.js")).default;

    const {
      employeeId,
      email: targetEmail,
      employeeName: targetName,
      occasion = "BIRTHDAY",
      message = "",
      photoUrl = "",
    } = req.body;

    let recipientEmail = targetEmail;
    let recipientName = targetName;

    if (employeeId) {
      const emp = await Employee.findOne({
        _id: employeeId,
        tenantId: req.tenantId,
      });
      if (emp) {
        recipientEmail = recipientEmail || emp.email;
        recipientName = recipientName || emp.name;
      }
    }

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "Recipient employee email is required to send greeting.",
      });
    }

    let companyName = "Business OS";
    if (req.tenantId) {
      const tenant = await Tenant.findById(req.tenantId);
      if (tenant?.companyName) {
        companyName = tenant.companyName;
      }
    }

    const sent = await sendCelebrationEmail({
      to: recipientEmail,
      employeeName: recipientName || "Team Member",
      companyName,
      occasion,
      message,
      photoUrl,
    });

    if (!sent) {
      return res.status(500).json({
        success: false,
        message: "Failed to dispatch email. Please check SMTP configuration in environment.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Celebration greeting successfully delivered to ${recipientName} (${recipientEmail}).`,
    });
  } catch (error) {
    console.error("❌ Send Greeting Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send greeting.",
    });
  }
});

export default router;