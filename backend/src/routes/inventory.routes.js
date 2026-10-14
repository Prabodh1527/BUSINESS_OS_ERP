import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { attachTenantDB } from '../middleware/tenant.middleware.js';
import Inventory from '../models/inventory.model.js';
import { notifyInventoryAlert } from '../services/telegramNotifier.service.js';

const router = express.Router();

// Guard all inventory routes with JWT authentication and tenant scoping
router.use(protect, attachTenantDB);

// ==========================================
// GET ALL INVENTORY ITEMS
// GET /api/inventory
// ==========================================
router.get('/', async (req, res) => {
  try {
    const items = await Inventory.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: items.length,
      inventory: items,
      data: items,
    });
  } catch (error) {
    console.error('❌ Error fetching inventory:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve inventory items.',
    });
  }
});

// ==========================================
// GET SINGLE INVENTORY ITEM BY ID
// GET /api/inventory/:id
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const item = await Inventory.findOne({ _id: req.params.id, tenantId: req.tenantId });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in workspace' });
    }

    return res.status(200).json({
      success: true,
      inventory: item,
      data: item,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// CREATE NEW INVENTORY ITEM
// POST /api/inventory
// ==========================================
router.post('/', async (req, res) => {
  try {
    const {
      sku,
      skuCode,
      name,
      productName,
      category,
      unitPrice,
      price,
      costPrice,
      taxRate,
      stockQuantity,
      stock,
      quantity,
      minStockThreshold,
      lowStockLimit,
      reorderLevel,
      supplier,
    } = req.body;

    const threshold = Number(minStockThreshold ?? lowStockLimit ?? reorderLevel ?? 5);
    const finalQuantity = Number(stockQuantity ?? stock ?? quantity ?? 0);

    const newItem = new Inventory({
      tenantId: req.tenantId,
      userId: req.user?._id || req.user?.id || null,
      sku: sku || skuCode || `SKU-${Date.now()}`,
      name: name || productName || 'New Product',
      category: category || 'General',
      price: Number(price ?? unitPrice ?? 0),
      unitPrice: Number(unitPrice ?? price ?? 0),
      costPrice: Number(costPrice ?? 0),
      taxRate: Number(taxRate ?? 18),
      quantity: finalQuantity,
      stockQuantity: finalQuantity,
      minStockThreshold: threshold,
      lowStockLimit: threshold,
      reorderLevel: threshold,
      supplier: supplier || '',
      status: finalQuantity === 0 ? 'OUT_OF_STOCK' : finalQuantity <= threshold ? 'LOW_STOCK' : 'IN_STOCK',
    });

    const savedItem = await newItem.save();

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      inventory: savedItem,
      data: savedItem,
    });
  } catch (error) {
    console.error('❌ Error saving inventory:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to save product.',
    });
  }
});

// ==========================================
// UPDATE INVENTORY ITEM
// PUT /api/inventory/:id
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Field alias fallbacks
    if (updateData.skuCode && !updateData.sku) updateData.sku = updateData.skuCode;
    if (updateData.productName && !updateData.name) updateData.name = updateData.productName;
    
    if (updateData.price !== undefined) updateData.unitPrice = updateData.price;
    if (updateData.unitPrice !== undefined) updateData.price = updateData.unitPrice;

    if (updateData.stock !== undefined || updateData.quantity !== undefined || updateData.stockQuantity !== undefined) {
      const q = Number(updateData.stock ?? updateData.quantity ?? updateData.stockQuantity);
      updateData.quantity = q;
      updateData.stockQuantity = q;
    }

    // Keep low stock thresholds synchronized
    const threshold = updateData.lowStockLimit ?? updateData.minStockThreshold ?? updateData.reorderLevel;
    if (threshold !== undefined) {
      const numThreshold = Number(threshold);
      updateData.minStockThreshold = numThreshold;
      updateData.lowStockLimit = numThreshold;
      updateData.reorderLevel = numThreshold;
    }

    // Recalculate stock status if quantity changed
    if (updateData.quantity !== undefined) {
      const currentQty = updateData.quantity;
      const currentThreshold = updateData.reorderLevel ?? 5;
      updateData.status = currentQty === 0 ? 'OUT_OF_STOCK' : currentQty <= currentThreshold ? 'LOW_STOCK' : 'IN_STOCK';
    }

    const updated = await Inventory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Item not found in workspace' });
    }

    if (updated.quantity <= (updated.minStockThreshold || 5)) {
      notifyInventoryAlert({
        tenantId: req.tenantId,
        item: updated,
        eventType: updated.quantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      inventory: updated,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// DELETE INVENTORY ITEM
// DELETE /api/inventory/:id
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Inventory.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Item not found in workspace' });
    }

    return res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;