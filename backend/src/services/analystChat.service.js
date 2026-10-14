/**
 * Generates natural language analysis reasoning across all business modules
 * using verifiable metrics, cross-module correlations, and structured markdown.
 */
export function generateAnalystResponse(question, { metrics, health, insights, predictions, recommendations }) {
  const q = question.toLowerCase();

  // 0. Executive Morning Briefing
  if (
    q.includes("briefing") ||
    q.includes("morning") ||
    q.includes("daily brief") ||
    q.includes("executive brief")
  ) {
    const cancelRate = metrics.totalAppointments > 0 ? Math.round((metrics.cancelledAppointments / metrics.totalAppointments) * 100) : 0;
    return `### 🌅 Executive Morning Briefing
**Good morning! Here is your 60-second executive operational briefing:**

#### 💰 1. Financial Snapshot
* **Total Collections:** **₹${metrics.totalRevenue.toLocaleString("en-IN")}** (${metrics.paidInvoicesCount} settled invoices).
* **Outstanding Cash:** **₹${metrics.pendingRevenue.toLocaleString("en-IN")}** across ${metrics.pendingInvoicesCount} open accounts (${metrics.overdueInvoicesCount} overdue).
* **Net Margin:** **${metrics.profitMargin}%** (Net profit: ₹${metrics.netProfit.toLocaleString("en-IN")}).

#### 📅 2. Operations & Schedule
* **Upcoming Bookings:** **${metrics.upcomingAppointments} sessions** on the calendar.
* **Cancellation Ratio:** ${cancelRate}% (${metrics.cancelledAppointments} cancellations).

#### 📦 3. Stock & Supply Chain
* **Inventory Health:** **${metrics.totalProducts} SKUs** active (Asset valuation: ₹${metrics.totalStockValue.toLocaleString("en-IN")}).
* ${metrics.lowStockCount > 0 ? `⚠️ **Attention:** **${metrics.lowStockCount} items** need reordering.` : "✅ Physical catalog stock is healthy."}

#### 👥 4. Team & Workforce
* **Active Headcount:** **${metrics.totalEmployees} employees**.
* **Late Shifts Tracked:** ${metrics.latePunches} delayed punches recorded.

#### 🎯 Top Strategic Priority for Today:
${recommendations[0]?.title || "Expedite recovery of pending invoices to optimize operating liquidity."}

*You can click the speaker icon to listen to this briefing, or ask any follow-up question below!*`;
  }

  // 1. Revenue / Sales / Income / Financials
  if (
    q.includes("revenue") ||
    q.includes("sale") ||
    q.includes("income") ||
    q.includes("profit") ||
    q.includes("earning") ||
    q.includes("financial")
  ) {
    const isDecline = q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("less") || q.includes("why");
    const formattedRev = `₹${metrics.totalRevenue.toLocaleString("en-IN")}`;
    const formattedPending = `₹${metrics.pendingRevenue.toLocaleString("en-IN")}`;
    const formattedProfit = `₹${metrics.netProfit.toLocaleString("en-IN")}`;
    const formattedExpenses = `₹${metrics.totalExpenses.toLocaleString("en-IN")}`;

    return `### 📊 Revenue & Financial Analysis

**Current Financial Position:**
* **Total Collected Revenue:** **${formattedRev}** across **${metrics.paidInvoicesCount}** settled invoices (out of ${metrics.totalInvoices} total).
* **Outstanding / Pending Receivables:** **${formattedPending}** across ${metrics.pendingInvoicesCount} open accounts (${metrics.overdueInvoicesCount} currently overdue).
* **Operating Expenses:** **${formattedExpenses}**
* **Net Profit Realized:** **${formattedProfit}** (approx. ${metrics.profitMargin}% margin).

${
  isDecline
    ? `**Key Drivers Influencing Revenue Fluctuations:**
1. **Uncollected Receivables:** You have **${formattedPending}** tied up in unpaid customer invoices. Revenue is only recognized as collected upon receipt.
2. **Catalog Velocity:** ${metrics.outOfStockCount > 0 ? `There are **${metrics.outOfStockCount} out-of-stock items**, which directly suppresses sales volume.` : "Physical stock is stable."}
3. **Appointment Utilization:** ${metrics.totalAppointments} total appointments recorded (${metrics.cancelledAppointments} cancellations).

**Recommended Immediate Action:**
* Expedite recovery of the **${metrics.overdueInvoicesCount} overdue invoices** by sharing UPI payment links directly with clients.`
    : `**Month-over-Month Observation:**
* Current Month Collections: **₹${metrics.currentMonthRevenue.toLocaleString("en-IN")}**
* Previous Month Collections: **₹${metrics.previousMonthRevenue.toLocaleString("en-IN")}** (${metrics.revenueGrowthRate >= 0 ? "+" : ""}${metrics.revenueGrowthRate}% change)

**Next Step:** Focus on collecting the **${formattedPending}** in pending invoices to maximize operating liquidity.`
}`;
  }

  // 2. Inventory / Products / Stock
  if (
    q.includes("inventory") ||
    q.includes("product") ||
    q.includes("stock") ||
    q.includes("underperform") ||
    q.includes("slow") ||
    q.includes("sku")
  ) {
    const lowStockList = metrics.lowStockItems.length > 0
      ? metrics.lowStockItems.map((i) => `* **${i.name}** (SKU: \`${i.sku}\`): Current stock: ${i.currentStock} units (Reorder limit: ${i.reorderPoint})`).join("\n")
      : "No items currently below safety reorder threshold.";

    const outList = metrics.outOfStockItems.length > 0
      ? metrics.outOfStockItems.map((i) => `* **${i.name}** (SKU: \`${i.sku}\`)`).join("\n")
      : "No items are completely out of stock.";

    return `### 📦 Inventory & Catalog Performance

**Overview:**
* **Total Tracked SKUs:** **${metrics.totalProducts}**
* **Total Inventory Asset Value:** **₹${metrics.totalStockValue.toLocaleString("en-IN")}**
* **Low Stock Alerts:** **${metrics.lowStockCount} items**
* **Out of Stock:** **${metrics.outOfStockCount} items**

**Critical Attention Items:**
${metrics.outOfStockCount > 0 ? `**Out of Stock (Zero Units):**\n${outList}\n` : ""}
**Approaching Reorder Limit:**
${lowStockList}

**Top Selling Products:**
${metrics.topProducts.length > 0 ? metrics.topProducts.map(([p, qty]) => `* **${p}**: ${qty} units billed`).join("\n") : "* No physical product transactions recorded yet."}

**Strategic Recommendation:**
Generate replenishment purchase orders for low-stock SKUs immediately to avoid appointment or order fulfillment disruptions.`;
  }

  // 3. Expenses / Cost / Overhead
  if (
    q.includes("expense") ||
    q.includes("cost") ||
    q.includes("overhead") ||
    q.includes("spending") ||
    q.includes("biggest")
  ) {
    const catList = Object.entries(metrics.expenseCategories).length > 0
      ? Object.entries(metrics.expenseCategories)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => `* **${cat}:** ₹${amt.toLocaleString("en-IN")}`)
          .join("\n")
      : "* General Operating Expenses: ₹" + metrics.totalExpenses.toLocaleString("en-IN");

    return `### 💸 Expenditure & Cost Breakdown

**Operating Summary:**
* **Total Recorded Expenses:** **₹${metrics.totalExpenses.toLocaleString("en-IN")}**
* **Total Payroll Disbursed:** **₹${metrics.totalPayrollDisbursed.toLocaleString("en-IN")}**
* **Combined Operating Outflow:** **₹${(metrics.totalExpenses + metrics.totalPayrollDisbursed).toLocaleString("en-IN")}**

**Expense Categories (Highest to Lowest):**
${catList}

**Impact on Cash Flow:**
Your total expenditures consume approximately **${metrics.totalRevenue > 0 ? Math.round(((metrics.totalExpenses + metrics.totalPayrollDisbursed) / metrics.totalRevenue) * 100) : "100+"}%** of collected revenue, resulting in a net profit of **₹${metrics.netProfit.toLocaleString("en-IN")}**.

**Action Item:**
Review the highest expense category above to negotiate bulk vendor terms or identify discretionary cost reductions.`;
  }

  // 4. Employee Attendance / Staff / Payroll
  if (
    q.includes("employee") ||
    q.includes("staff") ||
    q.includes("attendance") ||
    q.includes("payroll") ||
    q.includes("salary")
  ) {
    return `### 👥 Workforce & Attendance Impact

**Headcount & Payroll:**
* **Active Employees:** **${metrics.totalEmployees} team members**
* **Total Disbursed Payroll:** **₹${metrics.totalPayrollDisbursed.toLocaleString("en-IN")}**
* **Total Shift Punches Tracked:** **${metrics.totalShiftsRecorded} records**

**Punctuality & Discipline:**
* **Delayed Clock-ins (Late):** **${metrics.latePunches}**
* **Recorded Absences:** **${metrics.absences}**

**Impact on Operations:**
* Employee payroll constitutes a major operational commitment. With **${metrics.latePunches} delayed shifts**, appointment scheduling can experience start delays if staff are not on shift before customer arrival.
* Any unexcused absence is synchronized with the HR payroll engine to calculate accurate Loss of Pay (LOP) deductions automatically.

**Recommendation:**
Keep shift schedules aligned with peak booking periods and review unresolved attendance correction requests under Staff Management.`;
  }

  // 5. Priorities / What to do / Action
  if (
    q.includes("priorit") ||
    q.includes("focus") ||
    q.includes("what should i do") ||
    q.includes("this week") ||
    q.includes("recommend")
  ) {
    const recs = recommendations.slice(0, 3).map((r, i) =>
      `**${i + 1}. [${r.priority.toUpperCase()} PRIORITY] ${r.title}**
* **Why:** ${r.problem}
* **Action:** ${r.suggestedAction}
* **Expected Outcome:** ${r.expectedBenefit}`
    ).join("\n\n");

    return `### 🎯 High-Impact Action Priorities for This Week

${recs}

**How to Measure Success:**
Review the **Business Health Score** and **Invoices Dashboard** at the end of the week to verify balance recovery and inventory restock status.`;
  }

  // 6. Customers / CRM
  if (
    q.includes("customer") ||
    q.includes("client") ||
    q.includes("retention") ||
    q.includes("churn")
  ) {
    return `### 🤝 Customer & Client Directory Analysis

* **Total Registered Customers:** **${metrics.totalCustomers}**
* **Active Status Clients:** **${metrics.activeCustomersCount}**
* **VIP Clients:** **${metrics.vipCustomersCount}**
* **Total Invoices Issued:** **${metrics.totalInvoices}**

**Customer Engagement Findings:**
* Your business has a base of **${metrics.totalCustomers} customers**.
${metrics.vipCustomersCount > 0 ? `* You have **${metrics.vipCustomersCount} VIP clients** contributing consistent patronage.` : "* No VIP tier tiers designated yet; consider tagging frequent patrons as VIP in the CRM to incentivize repeat business."}
* Current average revenue per client is approximately **₹${metrics.totalCustomers > 0 ? Math.round(metrics.totalRevenue / metrics.totalCustomers).toLocaleString("en-IN") : "0"}**.

**Recommendation:**
Engage inactive customers through WhatsApp/Email service reminders or loyalty packages.`;
  }

  // 7. Appointments / Bookings
  if (
    q.includes("appointment") ||
    q.includes("booking") ||
    q.includes("schedule") ||
    q.includes("calendar")
  ) {
    const cancelRate = metrics.totalAppointments > 0 ? Math.round((metrics.cancelledAppointments / metrics.totalAppointments) * 100) : 0;
    return `### 📅 Appointment Scheduling & Capacity Analysis

* **Total Bookings Recorded:** **${metrics.totalAppointments}**
* **Completed Sessions:** **${metrics.completedAppointments}**
* **Upcoming Scheduled Slots:** **${metrics.upcomingAppointments}**
* **Cancellations / No-shows:** **${metrics.cancelledAppointments} (${cancelRate}%)**
* **Appointment Revenue Generated:** **₹${metrics.appointmentRevenue.toLocaleString("en-IN")}**

**Operational Assessment:**
* **Capacity Utilization:** You currently have **${metrics.upcomingAppointments} upcoming sessions** lined up on your calendar.
* **Cancellation Impact:** With **${metrics.cancelledAppointments} cancellations**, automated email reminders can reclaim abandoned booking slots.

**Recommendation:**
Use the Calendar view in the Appointments module to confirm upcoming bookings 24 hours in advance.`;
  }

  // General comprehensive overview
  return `### 💼 Executive Business Performance Summary

Here is the real-time operational status of your Business OS workspace:

* **Revenue:** **₹${metrics.totalRevenue.toLocaleString("en-IN")}** collected (${metrics.paidInvoicesCount} paid invoices); **₹${metrics.pendingRevenue.toLocaleString("en-IN")}** outstanding (${metrics.overdueInvoicesCount} overdue).
* **Expenses & Profit:** **₹${metrics.totalExpenses.toLocaleString("en-IN")}** expenses, **₹${metrics.totalPayrollDisbursed.toLocaleString("en-IN")}** payroll. Net profit is **₹${metrics.netProfit.toLocaleString("en-IN")}** (${metrics.profitMargin}% margin).
* **Inventory:** **${metrics.totalProducts} SKUs** tracked (**₹${metrics.totalStockValue.toLocaleString("en-IN")}** value); **${metrics.lowStockCount} items** at low stock, **${metrics.outOfStockCount} items** out of stock.
* **Workforce & CRM:** **${metrics.totalEmployees} employees**, **${metrics.totalCustomers} customers**, and **${metrics.totalAppointments} appointments**.
* **Composite Health Score:** **${health.score}/100 (${health.status})**.

**Suggested Focus Area:**
${recommendations[0]?.title || "Focus on collecting pending receivables and replenishing low inventory."}

What specific area would you like to drill into further (e.g., *Revenue breakdown*, *Stock risks*, *Operating expenses*, or *Priorities*)?`;
}
