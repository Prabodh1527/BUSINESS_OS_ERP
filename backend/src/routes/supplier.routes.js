import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { attachTenantDB } from "../middleware/tenant.middleware.js";
import Supplier from "../models/supplier.model.js";

const router = express.Router();

router.use(protect, attachTenantDB);

// GET /api/suppliers
router.get("/", async (req, res) => {
  try {
    const suppliers = await Supplier.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });

    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter((s) => s.status === "Active").length;

    return res.status(200).json({
      success: true,
      stats: {
        totalSuppliers,
        activeSuppliers,
      },
      suppliers,
      data: suppliers,
    });
  } catch (error) {
    console.error("❌ Get Suppliers Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/suppliers/:id
router.get("/:id", async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }
    return res.status(200).json({ success: true, supplier, data: supplier });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/suppliers
router.post("/", async (req, res) => {
  try {
    const { name, category, phone, email, address, status, notes } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Supplier name is required" });
    }

    const newSupplier = await Supplier.create({
      tenantId: req.tenantId,
      name: name.trim(),
      category: category?.trim() || "General",
      phone: phone?.trim() || "",
      email: email?.trim() || "",
      address: address?.trim() || "",
      status: status || "Active",
      notes: notes || "",
    });

    return res.status(201).json({
      success: true,
      message: "Supplier added successfully!",
      supplier: newSupplier,
      data: newSupplier,
    });
  } catch (error) {
    console.error("❌ Create Supplier Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /:id or PATCH /:id
const handleUpdateSupplier = async (req, res) => {
  try {
    const updated = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      supplier: updated,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

router.patch("/:id", handleUpdateSupplier);
router.put("/:id", handleUpdateSupplier);

// DELETE /api/suppliers/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Supplier.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
