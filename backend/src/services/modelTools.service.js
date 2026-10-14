import {
  getDetailedBusinessSnapshot,
  calculateBusinessHealth,
  generateEvidenceBackedInsights,
  generatePredictiveForecasts,
  generatePrioritizedRecommendations,
} from "./businessAnalyst.service.js";

/**
 * Registry of available backend analysis tools that the language model can execute.
 * Strict tenant isolation is enforced: req.tenantId is never supplied by the model.
 */
export const AVAILABLE_TOOLS = {
  get_revenue_and_invoices: {
    description: "Returns authoritative financial figures: total revenue, uncollected pending receivables, overdue invoices, and month-over-month comparisons.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return {
        totalRevenue: metrics.totalRevenue,
        currentMonthRevenue: metrics.currentMonthRevenue,
        previousMonthRevenue: metrics.previousMonthRevenue,
        revenueGrowthRate: `${metrics.revenueGrowthRate}%`,
        pendingReceivables: metrics.pendingRevenue,
        overdueInvoicesCount: metrics.overdueInvoicesCount,
        totalInvoices: metrics.totalInvoices,
        paidInvoices: metrics.paidInvoicesCount,
        pendingInvoices: metrics.pendingInvoicesCount,
      };
    },
  },

  get_inventory_and_stock: {
    description: "Returns catalog stock levels, low-stock alerts, out-of-stock items, and total inventory asset valuation.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return {
        totalProducts: metrics.totalProducts,
        totalStockValuation: metrics.totalStockValue,
        lowStockCount: metrics.lowStockCount,
        outOfStockCount: metrics.outOfStockCount,
        lowStockItems: metrics.lowStockItems,
        outOfStockItems: metrics.outOfStockItems,
        topSellingProducts: metrics.topProducts,
      };
    },
  },

  get_expenses_and_profitability: {
    description: "Returns operating expenses, category breakdown, payroll disbursements, net profit, and profit margin.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return {
        totalOperatingExpenses: metrics.totalExpenses,
        totalPayrollDisbursed: metrics.totalPayrollDisbursed,
        expenseCategoryBreakdown: metrics.expenseCategories,
        netProfit: metrics.netProfit,
        profitMargin: `${metrics.profitMargin}%`,
      };
    },
  },

  get_workforce_and_attendance: {
    description: "Returns employee headcount, punctuality statistics, delayed clock-ins, recorded absences, and leave indicators.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return {
        totalEmployees: metrics.totalEmployees,
        totalShiftsTracked: metrics.totalShiftsRecorded,
        lateClockIns: metrics.latePunches,
        absences: metrics.absences,
        totalPayrollDisbursed: metrics.totalPayrollDisbursed,
      };
    },
  },

  get_appointments_and_schedule: {
    description: "Returns booking volume, completed sessions, cancellation rates, upcoming scheduled slots, and appointment revenue.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return {
        totalAppointments: metrics.totalAppointments,
        completedAppointments: metrics.completedAppointments,
        cancelledAppointments: metrics.cancelledAppointments,
        cancellationRate: metrics.totalAppointments > 0 ? `${Math.round((metrics.cancelledAppointments / metrics.totalAppointments) * 100)}%` : "0%",
        upcomingAppointments: metrics.upcomingAppointments,
        appointmentRevenue: metrics.appointmentRevenue,
      };
    },
  },

  get_customers_and_retention: {
    description: "Returns customer count, active clients, VIP patrons, and client lifetime value metrics.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return {
        totalCustomers: metrics.totalCustomers,
        activeCustomers: metrics.activeCustomersCount,
        vipCustomers: metrics.vipCustomersCount,
        totalInvoicesIssued: metrics.totalInvoices,
      };
    },
  },

  get_business_health_score: {
    description: "Returns the deterministic composite health score (0-100) across 4 pillars: Financial, Inventory, Customers, Operations.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      const health = calculateBusinessHealth(metrics);
      return health;
    },
  },

  get_action_recommendations: {
    description: "Returns prioritized operational action plans with findings, suggested actions, expected benefits, and verification metrics.",
    execute: async (tenantId) => {
      const { metrics } = await getDetailedBusinessSnapshot(tenantId);
      return generatePrioritizedRecommendations(metrics);
    },
  },
};

/**
 * Determines which tools to call based on the user's natural language request.
 */
export function identifyRequiredTools(userQuery) {
  const q = userQuery.toLowerCase();
  const toolsToCall = new Set();

  if (q.includes("revenue") || q.includes("sale") || q.includes("income") || q.includes("invoice") || q.includes("bill") || q.includes("money") || q.includes("receivable") || q.includes("debt")) {
    toolsToCall.add("get_revenue_and_invoices");
  }
  if (q.includes("profit") || q.includes("margin") || q.includes("cost") || q.includes("expense") || q.includes("spend") || q.includes("overhead")) {
    toolsToCall.add("get_revenue_and_invoices");
    toolsToCall.add("get_expenses_and_profitability");
  }
  if (q.includes("product") || q.includes("inventory") || q.includes("stock") || q.includes("reorder") || q.includes("sku") || q.includes("item")) {
    toolsToCall.add("get_inventory_and_stock");
  }
  if (q.includes("employee") || q.includes("staff") || q.includes("attendance") || q.includes("late") || q.includes("absent") || q.includes("payroll") || q.includes("salary") || q.includes("worker")) {
    toolsToCall.add("get_workforce_and_attendance");
  }
  if (q.includes("appointment") || q.includes("booking") || q.includes("schedule") || q.includes("calendar") || q.includes("cancel")) {
    toolsToCall.add("get_appointments_and_schedule");
  }
  if (q.includes("customer") || q.includes("client") || q.includes("crm") || q.includes("retention") || q.includes("vip")) {
    toolsToCall.add("get_customers_and_retention");
  }
  if (q.includes("health") || q.includes("score") || q.includes("performance") || q.includes("overview") || q.includes("summary") || q.includes("briefing") || q.includes("morning") || q.includes("executive")) {
    toolsToCall.add("get_business_health_score");
    toolsToCall.add("get_revenue_and_invoices");
    toolsToCall.add("get_appointments_and_schedule");
    toolsToCall.add("get_inventory_and_stock");
    toolsToCall.add("get_workforce_and_attendance");
  }
  if (q.includes("priorit") || q.includes("recommend") || q.includes("what should") || q.includes("action") || q.includes("fix") || q.includes("improve")) {
    toolsToCall.add("get_action_recommendations");
    toolsToCall.add("get_revenue_and_invoices");
  }

  // If general or broad, pull health and revenue as foundation
  if (toolsToCall.size === 0) {
    toolsToCall.add("get_business_health_score");
    toolsToCall.add("get_revenue_and_invoices");
    toolsToCall.add("get_inventory_and_stock");
  }

  return Array.from(toolsToCall);
}

/**
 * Executes identified tools concurrently and safely formats the ground-truth data for model ingestion.
 */
export async function executeToolsForTenant(toolNames, tenantId) {
  const toolResults = {};
  await Promise.all(
    toolNames.map(async (toolName) => {
      const toolDef = AVAILABLE_TOOLS[toolName];
      if (toolDef) {
        try {
          toolResults[toolName] = await toolDef.execute(tenantId);
        } catch (err) {
          toolResults[toolName] = { error: err.message };
        }
      }
    })
  );
  return toolResults;
}
