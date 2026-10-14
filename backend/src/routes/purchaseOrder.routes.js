import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import PurchaseOrder from "../models/purchaseOrder.model.js";
import { notifyPurchaseOrderEvent } from "../services/telegramNotifier.service.js";

const router = express.Router();

router.use(protect, attachTenantDB);

// GET /api/purchase-orders
router.get("/", async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });

    let pendingCount = 0;
    let receivedCount = 0;
    let processingCount = 0;
    let totalSpend = 0;

    orders.forEach((po) => {
      const amt = Number(po.amount || 0);
      totalSpend += amt;
      if (po.status === "Pending") pendingCount++;
      else if (po.status === "Received") receivedCount++;
      else if (po.status === "Processing") processingCount++;
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalOrders: orders.length,
        pendingCount,
        receivedCount,
        processingCount,
        totalSpend,
      },
      orders,
      data: orders,
    });
  } catch (error) {
    console.error("❌ Get Purchase Orders Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /:id
router.get("/:id", async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!po) {
      return res.status(404).json({ success: false, message: "Purchase Order not found" });
    }
    return res.status(200).json({ success: true, order: po, data: po });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /
router.post("/", async (req, res) => {
  try {
    const { supplier, items, itemsDescription, amount, expectedDate, notes, status } = req.body;

    if (!supplier) {
      return res.status(400).json({ success: false, message: "Supplier is required" });
    }

    const count = await PurchaseOrder.countDocuments({ tenantId: req.tenantId });
    const poNumber = `PO-${1001 + count}`;

    const newPO = await PurchaseOrder.create({
      tenantId: req.tenantId,
      poNumber,
      supplier,
      items: items || [],
      itemsDescription: itemsDescription || (Array.isArray(items) ? items.map((i) => i.name).join(", ") : ""),
      amount: Number(amount || 0),
      date: new Date().toISOString().slice(0, 10),
      expectedDate: expectedDate || "",
      notes: notes || "",
      status: status || "Pending",
    });

    notifyPurchaseOrderEvent({
      tenantId: req.tenantId,
      po: newPO,
      eventType: "CREATED",
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "Purchase Order created successfully!",
      order: newPO,
      data: newPO,
    });
  } catch (error) {
    console.error("❌ Create PO Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /:id
router.patch("/:id", async (req, res) => {
  try {
    const updated = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Purchase Order not found" });
    }

    notifyPurchaseOrderEvent({
      tenantId: req.tenantId,
      po: updated,
      eventType: "STATUS_CHANGED",
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Purchase Order updated successfully",
      order: updated,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await PurchaseOrder.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Purchase Order not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Purchase Order deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
