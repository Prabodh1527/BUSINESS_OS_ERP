import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Attendance from "../models/attendance.model.js";
import AttendanceCorrection from "../models/attendanceCorrection.model.js";
import Employee from "../models/employee.model.js";
import Leave from "../models/leave.model.js";
import { getEmployeeIdentity, isEmployeeUser } from "../utils/employeeIdentity.js";
import { recordAuditLog } from "../utils/auditLogger.js";

const router = express.Router();
router.use(protect, attachTenantDB);

// GET /api/attendance/corrections
router.get("/corrections", async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (isEmployeeUser(req)) {
      const identity = await getEmployeeIdentity(req);
      filter.$or = [
        ...(identity.employeeId ? [{ employeeId: identity.employeeId }] : []),
        ...(identity.email ? [{ employeeEmail: identity.email }] : []),
        ...(identity.name ? [{ employeeName: identity.name }] : []),
      ];
    }
    const corrections = await AttendanceCorrection.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, corrections, data: corrections });
  } catch (error) {
    console.error("❌ Fetch Attendance Corrections Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/attendance/corrections
router.post("/corrections", async (req, res) => {
  try {
    if (!isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employee access only." });
    }
    const identity = await getEmployeeIdentity(req);
    const { date, checkIn, checkOut, reason } = req.body;
    if (!date || !checkIn || !checkOut || !reason?.trim()) {
      return res.status(400).json({ success: false, message: "Date, both punch times, and a reason are required." });
    }
    const correction = await AttendanceCorrection.create({
      tenantId: req.tenantId,
      employeeId: identity.employeeId || "",
      employeeEmail: identity.email || "",
      employeeName: identity.name || req.user?.name || "Staff",
      date,
      checkIn,
      checkOut,
      reason: reason.trim(),
    });
    return res.status(201).json({ success: true, correction, data: correction });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/attendance/corrections/:id
router.patch("/corrections/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employees cannot review attendance corrections." });
    }
    if (!["Approved", "Rejected"].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: "A valid correction status is required." });
    }
    const correction = await AttendanceCorrection.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, status: "Pending" },
      { $set: { status: req.body.status } },
      { new: true, runValidators: true }
    );
    if (!correction) {
      return res.status(404).json({ success: false, message: "Pending attendance correction not found." });
    }
    if (req.body.status === "Approved") {
      const matchQuery = {
        tenantId: req.tenantId,
        date: correction.date,
        ...(correction.employeeId ? { employeeId: correction.employeeId } : { employeeName: correction.employeeName }),
      };
      await Attendance.findOneAndUpdate(
        matchQuery,
        {
          $set: {
            employeeId: correction.employeeId,
            employeeName: correction.employeeName,
            date: correction.date,
            checkIn: correction.checkIn,
            checkOut: correction.checkOut,
            status: "Present",
            notes: `Attendance correction approved: ${correction.reason}`,
          },
          $push: {
            auditTrail: {
              modifiedBy: req.user?.name || "Owner",
              modifiedAt: new Date(),
              reason: `Approved correction request: ${correction.reason}`,
              previousStatus: "Absent/Pending",
              newStatus: "Present",
            },
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }
    return res.status(200).json({ success: true, correction, data: correction });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/attendance/summary (monthly summary for an employee or all employees)
router.get("/summary", async (req, res) => {
  try {
    const { month, year, employeeId } = req.query;
    const now = new Date();
    const targetYear = Number(year) || now.getFullYear();
    const targetMonth = month ? Number(month) : (now.getMonth() + 1);

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const filter = {
      tenantId: req.tenantId,
      date: { $gte: startDate, $lte: endDate },
    };

    if (isEmployeeUser(req)) {
      const identity = await getEmployeeIdentity(req);
      filter.$or = [
        ...(identity.employeeId ? [{ employeeId: identity.employeeId }] : []),
        ...(identity.name ? [{ employeeName: identity.name }] : []),
      ];
    } else if (employeeId) {
      filter.employeeId = employeeId;
    }

    const records = await Attendance.find(filter);

    let present = 0, late = 0, halfDay = 0, absent = 0, onLeave = 0, totalHours = 0;
    records.forEach(r => {
      if (r.status === "Present") present++;
      else if (r.status === "Late") late++;
      else if (r.status === "Half Day") halfDay++;
      else if (r.status === "Absent") absent++;
      else if (r.status === "On Leave") onLeave++;
      totalHours += Number(r.hours || 0);
    });

    const totalDaysRecorded = records.length;
    return res.status(200).json({
      success: true,
      summary: {
        year: targetYear,
        month: targetMonth,
        startDate,
        endDate,
        totalDaysRecorded,
        present,
        late,
        halfDay,
        absent,
        onLeave,
        totalHours: Math.round(totalHours * 10) / 10,
        paidDaysEquivalent: present + late + (halfDay * 0.5) + onLeave,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance/weekly (aggregated daily stats for the current/selected week)
router.get("/weekly", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const now = new Date();
    // Determine start of current week (Monday)
    const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekData = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = weekDays[i];

      const records = await Attendance.find({
        tenantId,
        date: dateStr,
      });

      let present = 0;
      let late = 0;
      let absent = 0;

      records.forEach((r) => {
        if (r.status === "Present") present++;
        else if (r.status === "Late") late++;
        else if (r.status === "Absent") absent++;
        else if (r.status === "Half Day") present++;
      });

      weekData.push({
        day: dayLabel,
        date: dateStr,
        present,
        late,
        absent,
      });
    }

    return res.status(200).json({
      success: true,
      weekly: weekData,
      data: weekData,
    });
  } catch (error) {
    console.error("❌ Attendance Weekly Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance (main list with date/employee filter)
router.get("/", async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.date) filter.date = req.query.date;
    if (req.query.status) filter.status = req.query.status;

    if (isEmployeeUser(req)) {
      const identity = await getEmployeeIdentity(req);
      filter.$or = [
        ...(identity.employeeId ? [{ employeeId: identity.employeeId }] : []),
        ...(identity.name ? [{ employeeName: identity.name }] : []),
      ];
    } else if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    const records = await Attendance.find(filter).sort({ date: -1, createdAt: -1 });

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayRecords = records.filter((r) => r.date === todayStr);

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;

    todayRecords.forEach((r) => {
      if (r.status === "Present") presentCount++;
      else if (r.status === "Late") lateCount++;
      else if (r.status === "Absent") absentCount++;
      else if (r.status === "Half Day") halfDayCount++;
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalRecords: records.length,
        todayTotal: todayRecords.length,
        presentCount,
        lateCount,
        absentCount,
        halfDayCount,
      },
      attendance: records,
      data: records,
    });
  } catch (error) {
    console.error("❌ Get Attendance Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/attendance/clock-in
router.post("/clock-in", async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const { employeeId, employeeName, role } = req.body;
    const name = identity?.name || employeeName || req.user?.name || "Staff Member";
    const resolvedEmployeeId = identity?.employeeId || employeeId || req.user?._id?.toString() || "";
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let record = await Attendance.findOne({
      tenantId: req.tenantId,
      date: todayStr,
      ...(resolvedEmployeeId ? { employeeId: resolvedEmployeeId } : { employeeName: name }),
    });

    if (record) {
      return res.status(200).json({
        success: true,
        message: "Already clocked in today",
        attendance: record,
        data: record,
      });
    }

    record = await Attendance.create({
      tenantId: req.tenantId,
      employeeId: resolvedEmployeeId,
      employeeName: name,
      role: identity?.role || role || req.user?.role || "Staff",
      date: todayStr,
      checkIn: timeStr,
      checkOut: "-",
      status: "Present",
    });

    recordAuditLog({
      tenantId: req.tenantId,
      user: req.user,
      action: "CLOCK_IN",
      module: "ATTENDANCE",
      targetId: record._id.toString(),
      details: `${name} clocked in at ${timeStr}`,
    });


    return res.status(201).json({
      success: true,
      message: `Clocked in at ${timeStr}`,
      attendance: record,
      data: record,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/attendance/clock-out
router.post("/clock-out", async (req, res) => {
  try {
    const identity = await getEmployeeIdentity(req);
    const name = identity?.name || req.body.employeeName || req.user?.name;
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const record = await Attendance.findOne({
      tenantId: req.tenantId,
      date: todayStr,
      ...(identity?.employeeId ? { employeeId: identity.employeeId } : { employeeName: name }),
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No clock-in record found for today",
      });
    }

    record.checkOut = timeStr;
    const checkIn = new Date(`1970-01-01 ${record.checkIn}`);
    const checkOut = new Date(`1970-01-01 ${timeStr}`);
    const elapsedMs = checkOut - checkIn;
    if (!Number.isNaN(elapsedMs) && elapsedMs >= 0) {
      record.hours = Math.round((elapsedMs / 3600000) * 100) / 100;
    }
    await record.save();

    recordAuditLog({
      tenantId: req.tenantId,
      user: req.user,
      action: "CLOCK_OUT",
      module: "ATTENDANCE",
      targetId: record._id.toString(),
      details: `${name} clocked out at ${timeStr} (${record.hours} hours logged)`,
    });


    return res.status(200).json({
      success: true,
      message: `Clocked out at ${timeStr}`,
      attendance: record,
      data: record,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/attendance (owner manual mark)
router.post("/", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Use the clock-in action to record attendance." });
    }
    const { employeeId = "", employeeName, role, date, checkIn, checkOut, status, notes, reason } = req.body;

    if (!employeeName) {
      return res.status(400).json({ success: false, message: "Employee name is required" });
    }

    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Prevent conflicting duplicate attendance records for the same employee and date
    const existing = await Attendance.findOne({
      tenantId: req.tenantId,
      date: targetDate,
      ...(employeeId ? { employeeId } : { employeeName }),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Attendance record already exists for ${employeeName} on ${targetDate}. Please update the existing record instead.`,
      });
    }

    let calculatedHours = 0;
    if (checkIn && checkOut && checkOut !== "-") {
      const inTime = new Date(`1970-01-01 ${checkIn}`);
      const outTime = new Date(`1970-01-01 ${checkOut}`);
      if (!isNaN(outTime - inTime) && outTime > inTime) {
        calculatedHours = Math.round(((outTime - inTime) / 3600000) * 100) / 100;
      }
    }

    const newRecord = await Attendance.create({
      tenantId: req.tenantId,
      employeeId,
      employeeName,
      role: role || "Staff",
      date: targetDate,
      checkIn: checkIn || "09:00 AM",
      checkOut: checkOut || "-",
      hours: calculatedHours,
      status: status || "Present",
      notes: notes || "",
      auditTrail: [{
        modifiedBy: req.user?.name || "Owner",
        modifiedAt: new Date(),
        reason: reason || "Initial manual attendance record",
        newStatus: status || "Present",
      }],
    });

    return res.status(201).json({
      success: true,
      message: "Attendance recorded successfully",
      attendance: newRecord,
      data: newRecord,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/attendance/:id (manual correction with audit trail)
router.patch("/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employees cannot edit attendance records directly." });
    }
    const current = await Attendance.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!current) return res.status(404).json({ success: false, message: "Attendance record not found" });

    const { status, checkIn, checkOut, notes, reason } = req.body;
    const auditReason = reason?.trim() || "Manual correction by management";

    const updateObj = {};
    if (status) updateObj.status = status;
    if (checkIn) updateObj.checkIn = checkIn;
    if (checkOut) updateObj.checkOut = checkOut;
    if (notes !== undefined) updateObj.notes = notes;

    if (checkIn || checkOut) {
      const finalIn = checkIn || current.checkIn;
      const finalOut = checkOut || current.checkOut;
      if (finalIn && finalOut && finalOut !== "-") {
        const inTime = new Date(`1970-01-01 ${finalIn}`);
        const outTime = new Date(`1970-01-01 ${finalOut}`);
        if (!isNaN(outTime - inTime) && outTime > inTime) {
          updateObj.hours = Math.round(((outTime - inTime) / 3600000) * 100) / 100;
        }
      }
    }

    const updated = await Attendance.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: updateObj,
        $push: {
          auditTrail: {
            modifiedBy: req.user?.name || "Owner",
            modifiedAt: new Date(),
            reason: auditReason,
            previousStatus: current.status,
            newStatus: status || current.status,
          },
        },
      },
      { new: true }
    );

    return res.status(200).json({ success: true, message: "Attendance updated with audit entry", attendance: updated, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/attendance/:id (delete attendance punch record)
router.delete("/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employees cannot delete attendance records." });
    }
    const deleted = await Attendance.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    recordAuditLog({
      tenantId: req.tenantId,
      user: req.user,
      action: "DELETE_ATTENDANCE",
      module: "ATTENDANCE",
      targetId: req.params.id,
      details: `Deleted attendance record for ${deleted.employeeName || deleted.employeeId} on ${deleted.date}`,
    });

    return res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
