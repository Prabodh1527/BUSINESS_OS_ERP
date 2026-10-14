import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Invoice from "../models/invoice.model.js";
import Inventory from "../models/inventory.model.js";
import Customer from "../models/customer.model.js";
import Employee from "../models/employee.model.js";
import Expense from "../models/expense.model.js";
import Appointment from "../models/appointment.model.js";
import Attendance from "../models/attendance.model.js";
import Payroll from "../models/payroll.model.js";

const router = express.Router();

router.use(protect, attachTenantDB);

// GET /api/reports/summary
router.get("/summary", async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [invoices, inventory, customers, employees, expenses, appointments, attendances, payrolls] =
      await Promise.all([
        Invoice.find({ tenantId }).populate("customer", "name phone email").sort({ createdAt: -1 }),
        Inventory.find({ tenantId }).sort({ quantity: 1 }),
        Customer.find({ tenantId }).sort({ createdAt: -1 }),
        Employee.find({ tenantId }),
        Expense.find({ tenantId }).sort({ date: -1 }),
        Appointment.find({ tenantId }).populate("customerId", "name phone").populate("assignedEmployeeId", "name").sort({ date: -1 }),
        Attendance.find({ tenantId }).sort({ date: -1 }).limit(200),
        Payroll.find({ tenantId }).sort({ createdAt: -1 }),
      ]);

    // 1. Revenue & Billing Analytics
    let totalRevenue = 0;
    let pendingRevenue = 0;
    let paidInvoicesCount = 0;
    const monthlyRevenueMap = {};
    const monthlyExpenseMap = {};
    const paymentMethods = { UPI: 0, CARD: 0, CASH: 0, BANK_TRANSFER: 0, OTHER: 0 };
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach((m) => {
      monthlyRevenueMap[m] = 0;
      monthlyExpenseMap[m] = 0;
    });

    // Customer spending map
    const customerSpendMap = {};

    // 7-day daily sales map
    const now = new Date();
    const last7DaysMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      last7DaysMap[dateStr] = { day: dayName, date: dateStr, sales: 0, count: 0 };
    }

    invoices.forEach((inv) => {
      const paid = Number(inv.amountPaid || 0);
      const grandTotal = Number(inv.grandTotal || 0);
      const balance = Number(inv.balanceDue || Math.max(0, grandTotal - paid));

      if (inv.status === "PAID") {
        totalRevenue += paid > 0 ? paid : grandTotal;
        paidInvoicesCount++;
      } else if (inv.status === "PARTIAL") {
        totalRevenue += paid;
        pendingRevenue += balance;
      } else if (inv.status !== "CANCELLED" && inv.status !== "REFUNDED") {
        pendingRevenue += balance;
      }

      // Monthly aggregation
      const invDate = inv.createdAt ? new Date(inv.createdAt) : new Date();
      const monthName = months[invDate.getMonth()];
      if (monthName && (inv.status === "PAID" || inv.status === "PARTIAL")) {
        monthlyRevenueMap[monthName] += paid > 0 ? paid : grandTotal;
      }

      // Last 7 days aggregation
      const dateKey = invDate.toISOString().split("T")[0];
      if (last7DaysMap[dateKey]) {
        last7DaysMap[dateKey].sales += paid > 0 ? paid : grandTotal;
        last7DaysMap[dateKey].count += 1;
      }

      // Payment method
      const method = (inv.paymentMethod || "").toUpperCase();
      if (paymentMethods[method] !== undefined) {
        paymentMethods[method] += paid > 0 ? paid : grandTotal;
      } else {
        paymentMethods.OTHER += paid > 0 ? paid : grandTotal;
      }

      // Customer spending
      const cName = inv.customer?.name || (typeof inv.customer === "string" ? inv.customer : "Walk-in Client");
      customerSpendMap[cName] = (customerSpendMap[cName] || 0) + (paid > 0 ? paid : grandTotal);
    });

    const monthlyRevenue = months.map((month) => ({
      month,
      revenue: Math.round(monthlyRevenueMap[month] * 100) / 100,
    }));

    const dailySales = Object.values(last7DaysMap);

    const topCustomers = Object.entries(customerSpendMap)
      .map(([name, totalSpent]) => ({ name, totalSpent: Math.round(totalSpent * 100) / 100 }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // 2. Inventory Analytics & Category Breakdown
    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const categoryStats = {};
    const criticalItems = [];

    inventory.forEach((item) => {
      const qty = Number(item.quantity ?? item.stockQuantity ?? 0);
      const price = Number(item.price ?? item.unitPrice ?? 0);
      const threshold = Number(item.minStockThreshold ?? item.lowStockLimit ?? item.reorderLevel ?? 5);

      totalStockValue += qty * price;
      const cat = item.category || "General";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { category: cat, totalCount: 0, inStock: 0, lowStock: 0, value: 0 };
      }
      categoryStats[cat].totalCount += 1;
      categoryStats[cat].value += qty * price;

      if (qty <= 0) {
        outOfStockCount++;
        categoryStats[cat].lowStock += 1;
        criticalItems.push({
          name: item.name,
          sku: item.sku || "--",
          category: cat,
          quantity: 0,
          threshold,
          status: "OUT_OF_STOCK",
        });
      } else if (qty <= threshold) {
        lowStockCount++;
        categoryStats[cat].lowStock += 1;
        criticalItems.push({
          name: item.name,
          sku: item.sku || "--",
          category: cat,
          quantity: qty,
          threshold,
          status: "LOW_STOCK",
        });
      } else {
        categoryStats[cat].inStock += 1;
      }
    });

    const categoryBreakdown = Object.values(categoryStats);

    // 3. Expenses Analytics
    let totalExpenses = 0;
    const expenseCategoryMap = {};
    expenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      totalExpenses += amt;
      const cat = exp.category || "General";
      expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + amt;

      const expDate = exp.date ? new Date(exp.date) : new Date(exp.createdAt || Date.now());
      const mName = months[expDate.getMonth()];
      if (mName) {
        monthlyExpenseMap[mName] += amt;
      }
    });

    const monthlyComparison = months.map((m) => {
      const rev = Math.round((monthlyRevenueMap[m] || 0) * 100) / 100;
      const exp = Math.round((monthlyExpenseMap[m] || 0) * 100) / 100;
      return {
        month: m,
        revenue: rev,
        expenses: exp,
        netProfit: Math.round((rev - exp) * 100) / 100,
      };
    });

    // 4. Employee & Attendance Analytics
    let totalPayroll = 0;
    const departmentMap = {};
    employees.forEach((emp) => {
      const sal = Number(emp.salary || emp.baseSalary || 0);
      totalPayroll += sal;
      const dept = emp.department || "Operations";
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;
    });

    // Attendance weekly distribution
    const weeklyAttendanceMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      weeklyAttendanceMap[dateStr] = { day: dayName, present: 0, late: 0, absent: 0 };
    }

    attendances.forEach((att) => {
      const dateKey = att.date ? String(att.date).slice(0, 10) : "";
      if (weeklyAttendanceMap[dateKey]) {
        const st = (att.status || "PRESENT").toUpperCase();
        if (st === "PRESENT") weeklyAttendanceMap[dateKey].present += 1;
        else if (st === "LATE") weeklyAttendanceMap[dateKey].late += 1;
        else if (st === "ABSENT") weeklyAttendanceMap[dateKey].absent += 1;
      }
    });

    const weeklyAttendance = Object.values(weeklyAttendanceMap);

    // 5. Appointments status
    let completedAppointments = 0;
    let cancelledAppointments = 0;
    let scheduledAppointments = 0;
    appointments.forEach((apt) => {
      const s = (apt.status || "").toUpperCase();
      if (s === "COMPLETED") completedAppointments++;
      else if (s === "CANCELLED") cancelledAppointments++;
      else scheduledAppointments++;
    });

    // 6. Net Profit
    const netProfit = Math.max(0, totalRevenue - totalExpenses);
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // Recent Invoices formatted
    const recentInvoices = invoices.slice(0, 10).map((inv) => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber || `INV-${String(inv._id).slice(-6)}`,
      customerName: inv.customer?.name || "Client",
      grandTotal: Number(inv.grandTotal || 0),
      amountPaid: Number(inv.amountPaid || 0),
      balanceDue: Number(inv.balanceDue || 0),
      status: inv.status || "PENDING",
      paymentMethod: inv.paymentMethod || "UPI",
      createdAt: inv.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        revenue: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          pendingRevenue: Math.round(pendingRevenue * 100) / 100,
          paidInvoicesCount,
          totalInvoices: invoices.length,
          monthlyRevenue,
          dailySales,
          paymentMethods,
          recentInvoices,
          topCustomers,
        },
        inventory: {
          totalProducts: inventory.length,
          totalStockValue: Math.round(totalStockValue * 100) / 100,
          lowStockCount,
          outOfStockCount,
          categoryBreakdown,
          criticalItems: criticalItems.slice(0, 10),
        },
        employees: {
          totalEmployees: employees.length,
          totalPayroll,
          activeCount: employees.filter((e) => (e.status || "").toUpperCase() === "ACTIVE").length,
          departmentBreakdown: departmentMap,
          weeklyAttendance,
        },
        customers: {
          totalCustomers: customers.length,
          activeCount: customers.filter((c) => (c.status || "").toUpperCase() === "ACTIVE").length,
          vipCount: customers.filter((c) => (c.status || "").toUpperCase() === "VIP").length,
        },
        expenses: {
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          categoryBreakdown: expenseCategoryMap,
        },
        financials: {
          netProfit: Math.round(netProfit * 100) / 100,
          profitMargin,
          monthlyComparison,
        },
        appointments: {
          totalAppointments: appointments.length,
          completedCount: completedAppointments,
          cancelledCount: cancelledAppointments,
          scheduledCount: scheduledAppointments,
        },
      },
    });
  } catch (error) {
    console.error("❌ Reports Summary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
