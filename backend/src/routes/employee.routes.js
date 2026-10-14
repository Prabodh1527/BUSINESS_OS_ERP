import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";

import Employee from "../models/employee.model.js";
import ArchivedEmployee from "../models/archivedEmployee.model.js";
import User from "../models/User.js";
import Payroll from "../models/payroll.model.js";
import Attendance from "../models/attendance.model.js";
import AttendanceCorrection from "../models/attendanceCorrection.model.js";
import Leave from "../models/leave.model.js";
import Appointment from "../models/appointment.model.js";
import Task from "../models/task.model.js";
import { getEmployeeIdentity, isEmployeeUser } from "../utils/employeeIdentity.js";

const router = express.Router();

// Guard all routes
router.use(protect, attachTenantDB);

// ==========================================
// EMPLOYEE SELF-PROFILE
// ==========================================
router.get("/me", async (req, res) => {
  try {
    if (!isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employee access only." });
    }

    const identity = await getEmployeeIdentity(req);
    if (!identity?.employee) {
      return res.status(404).json({ success: false, message: "Employee profile not found." });
    }

    return res.status(200).json({ success: true, employee: identity.employee, data: identity.employee });
  } catch (error) {
    console.error("❌ Fetch Employee Profile Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/me", async (req, res) => {
  try {
    if (!isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Employee access only." });
    }

    const identity = await getEmployeeIdentity(req);
    if (!identity?.employee?._id) {
      return res.status(404).json({ success: false, message: "Employee profile not found." });
    }

    const updateFields = {};
    const allowed = [
      "phone",
      "dob",
      "gender",
      "address",
      "city",
      "state",
      "postalCode",
      "emergencyName",
      "emergencyPhone",
      "emergencyRelationship",
      "bankName",
      "bankAccount",
      "bankIfsc",
      "avatar",
      "themePreference",
      "notificationsEnabled",
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    const updated = await Employee.findOneAndUpdate(
      { _id: identity.employee._id, tenantId: req.tenantId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    // Also sync phone or name to User model if present
    if (identity.employee.email) {
      const userUpdates = {};
      if (req.body.phone) userUpdates.phone = req.body.phone;
      if (Object.keys(userUpdates).length > 0) {
        await User.updateOne({ email: identity.employee.email, tenantId: req.tenantId }, { $set: userUpdates });
      }
    }

    return res.status(200).json({ success: true, employee: updated, data: updated });
  } catch (error) {
    console.error("❌ Update Employee Profile Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// ARCHIVE MANAGEMENT (SETTINGS SECTION)
// Must be defined BEFORE /:id
// ==========================================

// GET /api/employees/archived
router.get("/archived", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Owner access only." });
    }

    const archives = await ArchivedEmployee.find({ tenantId: req.tenantId }).sort({ archivedAt: -1 });

    const formatted = archives.map((doc) => ({
      _id: doc._id,
      employeeId: doc.employeeId,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      role: doc.role,
      department: doc.department,
      salary: doc.salary,
      joinDate: doc.joinDate,
      archivedAt: doc.archivedAt,
      archivedBy: doc.archivedBy,
      reason: doc.reason,
      payrollCount: doc.payrollRecords?.length || 0,
      attendanceCount: doc.attendanceRecords?.length || 0,
      leaveCount: doc.leaveRecords?.length || 0,
      appointmentCount: doc.appointments?.length || 0,
      taskCount: doc.tasks?.length || 0,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      archivedEmployees: formatted,
      data: formatted,
    });
  } catch (error) {
    console.error("❌ Fetch Archived Employees Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/employees/archived/:id
router.get("/archived/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Owner access only." });
    }

    const archive = await ArchivedEmployee.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!archive) {
      return res.status(404).json({ success: false, message: "Archived employee record not found." });
    }

    return res.status(200).json({
      success: true,
      archivedEmployee: archive,
      data: archive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/employees/archived/:id/restore
router.post("/archived/:id/restore", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Owner access only." });
    }

    const archive = await ArchivedEmployee.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!archive) {
      return res.status(404).json({ success: false, message: "Archived record not found." });
    }

    // Check if an active employee with same employeeId already exists
    const existing = await Employee.findOne({
      tenantId: req.tenantId,
      $or: [
        ...(archive.employeeId ? [{ employeeId: archive.employeeId }] : []),
        ...(archive.email ? [{ email: archive.email }] : []),
      ],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An active employee already exists with this employee ID or email.",
      });
    }

    // Re-create Employee in active collection
    const restoredEmployee = await Employee.create({
      tenantId: req.tenantId,
      employeeId: archive.employeeId || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      name: archive.name,
      email: archive.email,
      phone: archive.phone,
      role: archive.role,
      department: archive.department,
      salary: archive.salary,
      joinDate: archive.joinDate || new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
    });

    // Optionally delete from archive collection
    await ArchivedEmployee.findByIdAndDelete(archive._id);

    return res.status(200).json({
      success: true,
      message: `Employee ${archive.name} has been restored to the active workforce directory.`,
      employee: restoredEmployee,
      data: restoredEmployee,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/employees/archived/:id (Permanent Purge)
router.delete("/archived/:id", async (req, res) => {
  try {
    if (isEmployeeUser(req)) {
      return res.status(403).json({ success: false, message: "Owner access only." });
    }

    const purged = await ArchivedEmployee.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!purged) {
      return res.status(404).json({ success: false, message: "Archived record not found." });
    }

    return res.status(200).json({
      success: true,
      message: `Archived record for ${purged.name} has been permanently purged from history.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 1. GET ALL ACTIVE EMPLOYEES & STATS
// GET /api/employees
// ==========================================
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find({
      tenantId: req.tenantId,
    }).sort({ createdAt: -1 });

    let activeCount = 0;
    let onLeaveCount = 0;
    let totalPayroll = 0;

    employees.forEach((emp) => {
      const status = (emp.status || "").toUpperCase();

      if (status === "ACTIVE") {
        activeCount++;
      }

      if (status === "ON_LEAVE" || status === "ON LEAVE") {
        onLeaveCount++;
      }

      totalPayroll += Number(emp.salary || 0);
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalEmployees: employees.length,
        activeCount,
        onLeaveCount,
        totalPayroll,
      },
      employees,
      data: employees,
    });
  } catch (error) {
    console.error("❌ Fetch Employees Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// 2. GET SINGLE ACTIVE EMPLOYEE
// GET /api/employees/:id
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    return res.status(200).json({
      success: true,
      employee,
      data: employee,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// 3. CREATE EMPLOYEE
// POST /api/employees
// ==========================================
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role = "Staff",
      department = "Operations",
      salary = 0,
      status = "ACTIVE",
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Employee name is required.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Employee email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingEmp = await Employee.findOne({
      tenantId: req.tenantId,
      email: normalizedEmail,
    });

    if (existingEmp) {
      return res.status(400).json({
        success: false,
        message: "An active employee with this email already exists.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A login account already exists with this email. Please use a different employee email.",
      });
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const employeeId = `EMP-${randomSuffix}`;

    const tempPassword = `Pass@${crypto.randomBytes(3).toString("hex")}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newEmployee = await Employee.create({
      tenantId: req.tenantId,
      employeeId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || "",
      role: role?.trim() || "Staff",
      department: department?.trim() || "Operations",
      salary: Number(salary) || 0,
      joinDate: new Date().toISOString().slice(0, 10),
      status: status.toUpperCase(),
    });

    try {
      await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "EMPLOYEE",
        tenantId: req.tenantId,
        tenantDbName: undefined,
        employeeId,
        jobTitle: role?.trim() || "Staff",
        department: department?.trim() || "Operations",
        phone: phone?.trim() || "",
        joinDate: newEmployee.joinDate,
        salary: String(Number(salary) || 0),
      });
    } catch (userError) {
      await Employee.deleteOne({ _id: newEmployee._id });
      console.error("❌ Employee Portal User Creation Error:", userError);
      return res.status(500).json({
        success: false,
        message: "Employee was not created because the portal login account could not be created.",
      });
    }

    // Send Login Credentials
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(201).json({
        success: true,
        message: "Employee registered successfully, but email credentials could not be sent because SMTP is not configured.",
        employee: newEmployee,
        data: newEmployee,
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const portalUrl = process.env.CLIENT_URL || "http://localhost:5173";

      await transporter.sendMail({
        from: `"Business OS" <${process.env.SMTP_USER}>`,
        to: normalizedEmail,
        subject: "Your Employee Portal Login Credentials",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 12px;">
            <div style="background: #4f46e5; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h2 style="margin: 0;">Welcome to Business OS</h2>
            </div>
            <p>Hello <strong>${name.trim()}</strong>,</p>
            <p>Your employee portal profile has been created.</p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${employeeId}</p>
              <p style="margin: 5px 0;"><strong>Portal Email:</strong> ${normalizedEmail}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #4f46e5;">${tempPassword}</code></p>
            </div>
            <p><a href="${portalUrl}/login?role=employee" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Login to Portal</a></p>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("❌ Employee Email Error:", mailError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Employee registered successfully and login credentials were sent by email.",
      employee: newEmployee,
      data: newEmployee,
    });
  } catch (error) {
    console.error("❌ Add Employee Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create employee." });
  }
});

// ==========================================
// 4. CASCADE DELETE & OFFBOARD EMPLOYEE
// DELETE /api/employees/:id
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const empFilter = {
      tenantId: req.tenantId,
      $or: [
        ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
        ...(employee.email ? [{ employeeEmail: employee.email }, { email: employee.email }] : []),
        ...(employee.name ? [{ employee: employee.name }, { employeeName: employee.name }] : []),
      ],
    };

    // 1. Gather all historical records across modules before removing
    const [payrolls, attendances, corrections, leaves, appointments, tasks] = await Promise.all([
      Payroll.find({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.email ? [{ employeeEmail: employee.email }] : []),
          ...(employee.name ? [{ employee: employee.name }] : []),
        ],
      }),
      Attendance.find({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.name ? [{ employeeName: employee.name }] : []),
        ],
      }),
      AttendanceCorrection.find({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.email ? [{ employeeEmail: employee.email }] : []),
          ...(employee.name ? [{ employeeName: employee.name }] : []),
        ],
      }),
      Leave.find({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.email ? [{ employeeEmail: employee.email }] : []),
          ...(employee.name ? [{ employee: employee.name }] : []),
        ],
      }),
      Appointment.find({
        tenantId: req.tenantId,
        $or: [
          { staffId: employee._id },
          ...(employee.name ? [{ staff: employee.name }] : []),
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
        ],
      }),
      Task.find({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ assignedTo: employee.employeeId }] : []),
          ...(employee.name ? [{ assignedTo: employee.name }] : []),
          ...(employee.email ? [{ assignedToEmail: employee.email }] : []),
        ],
      }),
    ]);

    // 2. Archive everything into the dedicated ArchivedEmployee model
    const archivedDoc = await ArchivedEmployee.create({
      tenantId: req.tenantId,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      department: employee.department,
      salary: employee.salary,
      joinDate: employee.joinDate,
      archivedAt: new Date(),
      archivedBy: req.user?.name || req.user?.email || "Owner",
      reason: req.body?.reason || "Employee deleted and offboarded from active operations",
      profileSnapshot: employee.toObject(),
      payrollRecords: payrolls.map((p) => p.toObject()),
      attendanceRecords: attendances.map((a) => a.toObject()),
      leaveRecords: leaves.map((l) => l.toObject()),
      appointments: appointments.map((a) => a.toObject()),
      tasks: tasks.map((t) => t.toObject()),
    });

    // 3. Cascade delete from all active operational clusters
    await Promise.all([
      // Delete from active Employee collection
      Employee.deleteOne({ _id: employee._id, tenantId: req.tenantId }),

      // Remove employee login account so they can no longer access the portal
      employee.email ? User.deleteOne({ email: employee.email, tenantId: req.tenantId }) : Promise.resolve(),

      // Remove from active Payroll so payslips no longer show in payroll runs
      Payroll.deleteMany({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.email ? [{ employeeEmail: employee.email }] : []),
          ...(employee.name ? [{ employee: employee.name }] : []),
        ],
      }),

      // Remove from active Attendance & corrections
      Attendance.deleteMany({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.name ? [{ employeeName: employee.name }] : []),
        ],
      }),
      AttendanceCorrection.deleteMany({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.email ? [{ employeeEmail: employee.email }] : []),
          ...(employee.name ? [{ employeeName: employee.name }] : []),
        ],
      }),

      // Remove from active Leaves
      Leave.deleteMany({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
          ...(employee.email ? [{ employeeEmail: employee.email }] : []),
          ...(employee.name ? [{ employee: employee.name }] : []),
        ],
      }),

      // Remove / unassign from active Appointments
      Appointment.deleteMany({
        tenantId: req.tenantId,
        $or: [
          { staffId: employee._id },
          ...(employee.name ? [{ staff: employee.name }] : []),
          ...(employee.employeeId ? [{ employeeId: employee.employeeId }] : []),
        ],
      }),

      // Remove / unassign from active Tasks
      Task.deleteMany({
        tenantId: req.tenantId,
        $or: [
          ...(employee.employeeId ? [{ assignedTo: employee.employeeId }] : []),
          ...(employee.name ? [{ assignedTo: employee.name }] : []),
          ...(employee.email ? [{ assignedToEmail: employee.email }] : []),
        ],
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Employee ${employee.name} offboarded and removed from all active clusters. All historical records archived in Settings.`,
      archivedId: archivedDoc._id,
      archivedCounts: {
        payroll: payrolls.length,
        attendance: attendances.length,
        corrections: corrections.length,
        leaves: leaves.length,
        appointments: appointments.length,
        tasks: tasks.length,
      },
    });
  } catch (error) {
    console.error("❌ Cascade Delete Employee Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5. UPDATE EMPLOYEE
// PATCH /api/employees/:id
// ==========================================
router.patch("/:id", async (req, res) => {
  try {
    const updated = await Employee.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.tenantId,
      },
      {
        $set: req.body,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully.",
      employee: updated,
      data: updated,
    });
  } catch (error) {
    console.error("❌ Update Employee Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
