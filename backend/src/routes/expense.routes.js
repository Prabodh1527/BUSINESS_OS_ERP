import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Expense from "../models/expense.model.js";

const router = express.Router();

router.use(protect, attachTenantDB);

// GET /api/expenses
router.get("/", async (req, res) => {
  try {
    const expenses = await Expense.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // "YYYY-MM"

    let totalExpenses = 0;
    let thisMonthTotal = 0;
    const categorySet = new Set();

    expenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      totalExpenses += amt;
      if (exp.date && exp.date.startsWith(currentMonthPrefix)) {
        thisMonthTotal += amt;
      }
      if (exp.category) {
        categorySet.add(exp.category);
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        thisMonthTotal: Math.round(thisMonthTotal * 100) / 100,
        categoriesCount: categorySet.size,
      },
      expenses,
      data: expenses,
    });
  } catch (error) {
    console.error("❌ Get Expenses Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/expenses/:id
router.get("/:id", async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }
    return res.status(200).json({ success: true, expense, data: expense });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/expenses
router.post("/", async (req, res) => {
  try {
    const { title, category, amount, date, status, paymentMethod, notes, receiptUrl } = req.body;

    if (!title || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Title and amount are required.",
      });
    }

    const newExpense = await Expense.create({
      tenantId: req.tenantId,
      userId: req.user?._id,
      title: title.trim(),
      category: category?.trim() || "General",
      amount: Number(amount) || 0,
      date: date || new Date().toISOString().slice(0, 10),
      status: status || "Paid",
      paymentMethod: paymentMethod || "UPI",
      notes: notes || "",
      receiptUrl: receiptUrl || "",
    });

    return res.status(201).json({
      success: true,
      message: "Expense recorded successfully!",
      expense: newExpense,
      data: newExpense,
    });
  } catch (error) {
    console.error("❌ Create Expense Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/expenses/:id & PUT /api/expenses/:id
const handleUpdateExpense = async (req, res) => {
  try {
    const updated = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      expense: updated,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

router.patch("/:id", handleUpdateExpense);
router.put("/:id", handleUpdateExpense);

// DELETE /api/expenses/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
