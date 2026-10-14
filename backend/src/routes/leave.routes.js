import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Leave from "../models/leave.model.js";
import LeavePolicy from "../models/LeavePolicy.js";
import Attendance from "../models/attendance.model.js";
import Notification from "../models/notification.model.js";
import { sendLeaveDecisionEmail } from "../utils/email.js";
import { getEmployeeIdentity, isEmployeeUser } from "../utils/employeeIdentity.js";
import { notifyLeaveEvent } from "../services/telegramNotifier.service.js";

const router = express.Router();
router.use(protect, attachTenantDB);

const DEFAULT_LEAVE_TYPES = [
  { type: "Casual Leave",    entitledPerYear: 12, accrualType: "monthly", isPaid: true,  maxCarryForward: 0, enabled: true },
  { type: "Sick Leave",      entitledPerYear: 12, accrualType: "monthly", isPaid: true,  maxCarryForward: 0, enabled: true },
  { type: "Paid Vacation",   entitledPerYear: 15, accrualType: "yearly",  isPaid: true,  maxCarryForward: 5, enabled: true },
  { type: "Emergency Leave", entitledPerYear: 3,  accrualType: "yearly",  isPaid: false, maxCarryForward: 0, enabled: true },
  { type: "Unpaid Leave",    entitledPerYear: 0,  accrualType: "none",    isPaid: false, maxCarryForward: 0, enabled: true },
];

// GET /api/leaves/policy
router.get("/policy", async (req, res) => {
  try {
    let policy = await LeavePolicy.findOne({ tenantId: req.tenantId });
    if (!policy) {
      policy = await LeavePolicy.create({
        tenantId: req.tenantId,
        leaveTypes: DEFAULT_LEAVE_TYPES,
        lopEnabled: true,
        notes: "Standard tenant leave and paid absence policy",
      });
    }
    return res.status(200).json({ success: true, policy, data: policy });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/leaves/policy
router.put("/policy", async (req, res) => {
  try {
    if (isEmployeeUser(req)) return res.status(403).json({ success: false, message: "Only business owners can update leave policies." });
    const policy = await LeavePolicy.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: { ...req.body, tenantId: req.tenantId } },
      { new: true, upsert: true, runValidators: true }
    );
    return res.status(200).json({ success: true, message: "Leave policy saved", policy, data: policy });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/leaves/balance/:employeeId
router.get("/balance/:employeeId", async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;
    const policy = await LeavePolicy.findOne({ tenantId: req.tenantId });
    const activeTypes = policy?.leaveTypes?.filter(t => t.enabled) || DEFAULT_LEAVE_TYPES;

    const leaves = await Leave.find({
      tenantId: req.tenantId,
      employeeId: req.params.employeeId,
      status: "Approved",
      from: { $gte: yearStart, $lte: yearEnd },
    });

    const used = {};
    leaves.forEach(l => {
      used[l.type] = (used[l.type] || 0) + Number(l.days || 0);
    });

    const balance = activeTypes.map(lt => ({
      type: lt.type,
      entitled: lt.entitledPerYear,
      used: used[lt.type] || 0,
      remaining: Math.max(0, lt.entitledPerYear - (used[lt.type] || 0)),
      isPaid: lt.isPaid,
    }));

    return res.status(200).json({ success: true, balance, data: balance });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/leaves
router.get("/", async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (isEmployeeUser(req)) {
      const identity = await getEmployeeIdentity(req);
      filter.$or = [
        ...(identity.employeeId ? [{ employeeId: identity.employeeId }] : []),
        ...(identity.email     ? [{ employeeEmail: identity.email }]   : []),
        ...(identity.name      ? [{ employee: identity.name }]         : []),
      ];
    } else if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    const leaves = await Leave.find(filter).sort({ createdAt: -1 });

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    leaves.forEach((l) => {
      if (l.status === "Pending") pendingCount++;
      else if (l.status === "Approved") approvedCount++;
      else if (l.status === "Rejected") rejectedCount++;
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalLeaves: leaves.length,
        pendingCount,
        approvedCount,
        rejectedCount,
      },
      leaves,
      data: leaves,
    });
  } catch (error) {
    console.error("❌ Get Leaves Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/leaves
router.post("/", async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const { employee, employeeId = "", employeeEmail = "", role, type, from, to, days, reason, isHalfDay } = req.body;

    const empName = identity?.name || employee || req.user?.name;
    const resolvedEmpId = identity?.employeeId || employeeId || req.user?._id?.toString() || "";
    if (!empName || !from || !to || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee, start date, end date, and reason are required.",
      });
    }

    // Check overlapping leaves
    const overlap = await Leave.findOne({
      tenantId: req.tenantId,
      status: { $in: ["Pending", "Approved"] },
      $or: [{ employeeId: resolvedEmpId }, { employee: empName }],
      $and: [{ from: { $lte: to } }, { to: { $gte: from } }],
    });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message: `You already have a leave application from ${overlap.from} to ${overlap.to} (${overlap.status}).`,
      });
    }

    // Determine paid vs unpaid from policy
    const policy = await LeavePolicy.findOne({ tenantId: req.tenantId });
    const targetTypeConfig = policy?.leaveTypes?.find(t => t.type === type);
    const isPaid = targetTypeConfig ? targetTypeConfig.isPaid : (type !== "Unpaid Leave" && type !== "Emergency Leave");

    const calculatedDays = isHalfDay ? 0.5 : (Number(days) || Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1));

    const newLeave = await Leave.create({
      tenantId: req.tenantId,
      employeeId: resolvedEmpId,
      employeeEmail: identity?.email || employeeEmail || req.user?.email || "",
      employee: empName,
      role: identity?.role || role || req.user?.role || "Staff",
      type: type || "Casual Leave",
      from,
      to,
      days: calculatedDays,
      reason,
      status: "Pending",
      isPaid,
    });

    // Trigger Telegram notification to Admin
    notifyLeaveEvent({
      tenantId: req.tenantId,
      leave: newLeave,
      eventType: "SUBMITTED",
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully!",
      leave: newLeave,
      data: newLeave,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/leaves/:id (approve / reject)
router.patch("/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employees cannot approve leave requests." });
    }
    const { status, rejectionReason } = req.body;
    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Valid status required" });
    }

    const updated = await Leave.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: {
          status,
          ...(rejectionReason ? { rejectionReason } : {}),
          approvedBy: req.user?.name || "Owner",
          approvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Leave record not found" });
    }

    // If approved, reflect in attendance as "On Leave" for dates if desired
    if (status === "Approved") {
      const curDate = new Date(updated.from);
      const toDate = new Date(updated.to);
      while (curDate <= toDate) {
        const dStr = curDate.toISOString().slice(0, 10);
        await Attendance.findOneAndUpdate(
          {
            tenantId: req.tenantId,
            date: dStr,
            ...(updated.employeeId ? { employeeId: updated.employeeId } : { employeeName: updated.employee }),
          },
          {
            $set: {
              employeeId: updated.employeeId,
              employeeName: updated.employee,
              role: updated.role,
              date: dStr,
              checkIn: "-",
              checkOut: "-",
              hours: 0,
              status: "On Leave",
              notes: `Approved leave: ${updated.type} (${updated.reason})`,
            },
          },
          { upsert: true }
        );
        curDate.setDate(curDate.getDate() + 1);
      }
    }

    // Trigger employee email and in-app notification
    sendLeaveDecisionEmail(updated).catch(() => {});
    Notification.create({
      tenantId: req.tenantId,
      title: `Leave Request ${updated.status}`,
      message: `Your leave request for ${updated.from} to ${updated.to} was ${updated.status.toLowerCase()} by ${req.user?.name || "Management"}.`,
      type: "Employee",
      recipientEmployeeId: updated.employeeId || "",
      recipientEmail: updated.employeeEmail || "",
      link: "/employee/leaves",
    }).catch(() => {});

    // Trigger Telegram notification to Employee
    notifyLeaveEvent({
      tenantId: req.tenantId,
      leave: updated,
      eventType: updated.status === "Approved" ? "APPROVED" : "REJECTED",
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Leave request ${updated.status}`,
      leave: updated,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/leaves/:id (cancel pending request)
router.delete("/:id", async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const deleted = await Leave.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...(identity
        ? {
            status: "Pending",
            $or: [
              ...(identity.employeeId ? [{ employeeId: identity.employeeId }] : []),
              ...(identity.email ? [{ employeeEmail: identity.email }] : []),
              ...(identity.name ? [{ employee: identity.name }] : []),
            ],
          }
        : {}),
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Pending leave record not found or cannot be cancelled." });
    }

    return res.status(200).json({ success: true, message: "Leave request cancelled successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
