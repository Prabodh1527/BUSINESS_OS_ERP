import "dotenv/config";

import express from "express";
import cors from "cors";
import dns from "node:dns";
import nodemailer from "nodemailer";

// Force Node.js to use Google & Cloudflare DNS for SRV lookup
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Database connection
import connectDB from "./config/db.js";
import { createTransporter } from "./utils/email.js";

// Import route handlers
import authRoutes from "./routes/auth.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import masterRoutes from "./routes/master.routes.js";
import tenantRoutes from "./routes/tenant.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";
import purchaseOrderRoutes from "./routes/purchaseOrder.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import taskRoutes from "./routes/task.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reportRoutes from "./routes/report.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import auditLogRoutes from "./routes/auditLog.routes.js";
import telegramRoutes from "./routes/telegram.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import publicBookingRoutes from "./routes/publicBooking.routes.js";
import { initializeConnectedTelegramBots } from "./services/telegramBot.service.js";
import { startTelegramScheduler } from "./services/telegramScheduler.service.js";

// Connect to Master MongoDB is handled in startServer()

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CORS
// ==========================================
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or any origin in production
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "x-tenant-id",
      "x-tenant-db",
    ],
  })
);
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// NODEMAILER VERIFY
// ==========================================
const startupTransporter = createTransporter();
if (startupTransporter) {
  startupTransporter.verify((error) => {
    if (error) {
      console.error("❌ Nodemailer Transporter Error:", error.message);
    } else {
      console.log("✅ SMTP Mailer is ready to send emails");
    }
  });
} else {
  console.warn("⚠️ SMTP credentials missing in server environment variables (SMTP_USER / SMTP_PASS)");
}

// ==========================================
// API ROUTES
// ==========================================
// Auth
app.use("/api/auth", authRoutes);

// Core Modules
app.use("/api/invoices", invoiceRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/masters", masterRoutes);
app.use("/masters", masterRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/tenant", tenantRoutes);

// Expenses & Procurement
app.use("/api/expenses", expenseRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);

// HR, Attendance, Leaves & Payroll
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/tasks", taskRoutes);

// Notifications, Reports & AI
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/telegram", telegramRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/whatsapp", whatsappRoutes);
app.use("/api/public/booking", publicBookingRoutes);
app.use("/public/booking", publicBookingRoutes);


// ==========================================
// HEALTH CHECK & DIAGNOSTICS
// ==========================================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Business OS Backend Server is running healthy!",
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    smtpUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***` : "none",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/health/test-email", async (req, res) => {
  try {
    const to = req.body.to || process.env.SMTP_USER;
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({
        success: false,
        message: "SMTP_USER or SMTP_PASS is missing in server environment variables.",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Business OS Test" <${process.env.SMTP_USER}>`,
      to,
      subject: "Business OS - Live Deployment Mail Test",
      html: "<p>If you received this email, email delivery on your deployed cloud server is 100% operational!</p>",
    });

    return res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${to}`,
    });
  } catch (error) {
    console.error("❌ Live SMTP test failure:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to deliver email through Gmail SMTP",
    });
  }
});


// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("❌ Global Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ==========================================
// START SERVER (Ensures MongoDB is connected before services boot)
// ==========================================
const startServer = async () => {
  try {
    // 1. Connect to MongoDB first
    await connectDB();

    // 2. Start HTTP Listener
    app.listen(PORT, async () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      // 3. Initialize background services only after DB is live
      try {
        await initializeConnectedTelegramBots();
      } catch (err) {
        console.warn("⚠️ Failed to start Telegram bots on launch:", err.message);
      }

      startTelegramScheduler();
    });
  } catch (error) {
    console.error("❌ Fatal MongoDB connection error on launch:", error.message);
    process.exit(1);
  }
};

startServer();

