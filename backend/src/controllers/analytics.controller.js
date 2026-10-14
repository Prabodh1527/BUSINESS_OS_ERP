// backend/src/controllers/analytics.controller.js
import Invoice from "../models/invoice.model.js";
import Customer from "../models/customer.model.js";
import Inventory from "../models/inventory.model.js";
import Appointment from "../models/appointment.model.js";

export const getDashboardAnalytics = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant context missing from request.",
      });
    }

    const [invoices, totalCustomers, inventoryItems, appointments] =
      await Promise.all([
        Invoice.find({ tenantId }).populate("customer", "name phone email").sort({ createdAt: -1 }),
        Customer.countDocuments({ tenantId }),
        Inventory.find({ tenantId }),
        Appointment.find({ tenantId }).populate("customerId", "name phone").populate("assignedEmployeeId", "name").sort({ date: -1 }),
      ]);

    let totalRevenue = 0;
    let pendingInvoicesAmount = 0;
    let pendingInvoicesCount = 0;
    let paidInvoicesCount = 0;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyRevenueMap = {};
    months.forEach((m) => (monthlyRevenueMap[m] = 0));

    // Revenue strictly tracked via official Invoices
    invoices.forEach((inv) => {
      const grandTotal = Number(inv.grandTotal || 0);
      const paid = Number(inv.amountPaid || 0);
      const balance =
        inv.balanceDue !== undefined ? Number(inv.balanceDue) : grandTotal - paid;

      if (inv.status === "PAID") {
        totalRevenue += paid > 0 ? paid : grandTotal;
        paidInvoicesCount++;
      } else if (inv.status === "PARTIAL") {
        totalRevenue += paid;
      }

      if (
        inv.status !== "PAID" &&
        inv.status !== "CANCELLED" &&
        inv.status !== "REFUNDED"
      ) {
        pendingInvoicesCount++;
        pendingInvoicesAmount += Math.max(0, balance);
      }

      // Monthly aggregation
      const invDate = inv.createdAt ? new Date(inv.createdAt) : new Date();
      const monthName = months[invDate.getMonth()];
      if (monthName && (inv.status === "PAID" || inv.status === "PARTIAL")) {
        monthlyRevenueMap[monthName] += paid > 0 ? paid : grandTotal;
      }
    });

    const monthlyRevenue = months.map((month) => ({
      month,
      revenue: Math.round(monthlyRevenueMap[month] * 100) / 100,
    }));

    // Inventory calculation
    let totalStockValue = 0;
    const lowStockItems = [];
    inventoryItems.forEach((item) => {
      const currentQty = Number(item.quantity ?? item.stockQuantity ?? 0);
      const price = Number(item.price ?? item.unitPrice ?? 0);
      const threshold = Number(
        item.minStockThreshold ?? item.lowStockLimit ?? item.reorderLevel ?? 5
      );
      totalStockValue += currentQty * price;

      if (currentQty <= threshold) {
        lowStockItems.push({
          _id: item._id,
          name: item.name,
          sku: item.sku,
          stock: currentQty,
          threshold,
        });
      }
    });

    // Dynamic Health Score (0-100)
    let healthScore = 40;
    if (totalRevenue > 0) healthScore += 25;
    if (paidInvoicesCount > 0) healthScore += 10;
    if (totalCustomers > 0) healthScore += 15;
    if (appointments.length > 0) healthScore += 10;
    if (lowStockItems.length > 0) healthScore = Math.max(20, healthScore - 10);
    healthScore = Math.min(100, healthScore);

    // Recent activity feed compiled from real database records
    const recentActivities = [];

    invoices.slice(0, 4).forEach((inv) => {
      recentActivities.push({
        type: "INVOICE",
        title: `Invoice #${inv.invoiceNumber || String(inv._id).slice(-6)} - ${inv.status}`,
        subtitle: `₹${Number(inv.grandTotal || 0).toLocaleString("en-IN")} • ${inv.customer?.name || "Client"}`,
        time: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "Recent",
        timestamp: inv.createdAt ? new Date(inv.createdAt).getTime() : 0,
        color: inv.status === "PAID" ? "text-emerald-400" : "text-amber-400",
      });
    });

    appointments.slice(0, 3).forEach((apt) => {
      recentActivities.push({
        type: "APPOINTMENT",
        title: `Booking: ${apt.serviceName || "Service"}`,
        subtitle: `${apt.customerId?.name || "Customer"} • ${apt.status || "Scheduled"}`,
        time: apt.date || "Upcoming",
        timestamp: apt.createdAt ? new Date(apt.createdAt).getTime() : 0,
        color: "text-indigo-400",
      });
    });

    lowStockItems.slice(0, 2).forEach((item) => {
      recentActivities.push({
        type: "INVENTORY",
        title: `Low Stock: ${item.name}`,
        subtitle: `${item.stock} left (safety limit: ${item.threshold})`,
        time: "Needs Restock",
        timestamp: Date.now() - 3600000,
        color: "text-rose-400",
      });
    });

    recentActivities.sort((a, b) => b.timestamp - a.timestamp);

    // Upcoming appointments
    const upcomingAppointments = appointments
      .filter((a) => a.status !== "CANCELLED" && a.status !== "COMPLETED")
      .slice(0, 4)
      .map((a) => ({
        _id: a._id,
        serviceName: a.serviceName || "Consultation",
        customerName: a.customerId?.name || "Client",
        date: a.date,
        time: a.startTime || a.time || "Scheduled",
        status: a.status || "CONFIRMED",
      }));

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue: Math.max(0, Math.round(totalRevenue * 100) / 100),
          pendingInvoicesAmount: Math.max(
            0,
            Math.round(pendingInvoicesAmount * 100) / 100
          ),
          pendingInvoicesCount,
          paidInvoicesCount,
          totalInvoices: invoices.length,
          totalCustomers,
          lowStockCount: lowStockItems.length,
          totalAppointments: appointments.length,
          totalStockValue: Math.round(totalStockValue * 100) / 100,
          totalProducts: inventoryItems.length,
          healthScore,
        },
        monthlyRevenue,
        recentActivities: recentActivities.slice(0, 6),
        upcomingAppointments,
        lowStockItems,
      },
    });
  } catch (error) {
    console.error("❌ Analytics Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch analytics.",
    });
  }
};