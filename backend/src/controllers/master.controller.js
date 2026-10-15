import Master from "../models/Master.js";

export const DEFAULT_MASTERS = [
  // Services
  { type: "Services", name: "Haircut & Styling", details: "₹500 • 30 mins professional cut and styling", value: { price: 500, duration: 30 } },
  { type: "Services", name: "Hair Spa & Conditioning", details: "₹1500 • 60 mins deep nourishment spa", value: { price: 1500, duration: 60 } },
  { type: "Services", name: "Beard Grooming & Shape", details: "₹350 • 20 mins luxury grooming", value: { price: 350, duration: 20 } },
  { type: "Services", name: "Facial & Skin Therapy", details: "₹1200 • 45 mins revitalizing facial", value: { price: 1200, duration: 45 } },
  { type: "Services", name: "Consultation & Audit", details: "₹1000 • 45 mins personalized assessment", value: { price: 1000, duration: 45 } },

  // Product Category
  { type: "Product Category", name: "Hair Care", details: "Shampoos, conditioners, hair serums, tonics" },
  { type: "Product Category", name: "Skin Care", details: "Moisturizers, sunscreens, cleansers, serums" },
  { type: "Product Category", name: "Styling & Tools", details: "Pomades, waxes, scissors, professional dryers" },
  { type: "Product Category", name: "Retail Supplies", details: "Retail resale kits, packaged packs" },
  { type: "Product Category", name: "General Supplies", details: "General salon & shop utility items" },

  // Expense Category
  { type: "Expense Category", name: "Staff & Payroll", details: "Salaries, bonuses, overtime, staff perks" },
  { type: "Expense Category", name: "Rent & Space", details: "Premises lease, building maintenance, parking" },
  { type: "Expense Category", name: "Utilities & Bills", details: "Electricity, water, gas, high-speed broadband" },
  { type: "Expense Category", name: "Inventory & Supplies", details: "Stock reorders, chemical purchases, raw consumables" },
  { type: "Expense Category", name: "Marketing & Ads", details: "Google, Meta ads, local flyers, influencer promotions" },
  { type: "Expense Category", name: "Maintenance & Repairs", details: "Equipment servicing, interior touch-ups, plumbing" },
  { type: "Expense Category", name: "Software & Tech", details: "POS software, cloud subscriptions, domain hosting" },
  { type: "Expense Category", name: "General Operations", details: "Miscellaneous operational office supplies" },

  // Employee Role
  { type: "Employee Role", name: "Store Manager", details: "Overall store operations and team oversight" },
  { type: "Employee Role", name: "Senior Specialist", details: "Lead expert with 5+ yrs domain experience" },
  { type: "Employee Role", name: "Staff Stylist", details: "Core frontline service execution specialist" },
  { type: "Employee Role", name: "Frontdesk / Receptionist", details: "Client greeting, billing checkout, phone bookings" },
  { type: "Employee Role", name: "Inventory Supervisor", details: "Stock receipt, audit, reorder dispatch" },

  // Departments
  { type: "Departments", name: "Operations", details: "Daily workflow, store hygiene, service delivery" },
  { type: "Departments", name: "Customer Service", details: "Front-desk, customer support, booking desk" },
  { type: "Departments", name: "Inventory & Logistics", details: "Stock storage, supply intake, warehouse handling" },
  { type: "Departments", name: "Finance & Accounts", details: "Billing, payouts, vendor payments, GST reconciliation" },
  { type: "Departments", name: "Marketing & Growth", details: "Client acquisition, social media, loyalty campaigns" },

  // Payment Method
  { type: "Payment Method", name: "UPI / QR Code", details: "Instant zero-fee payment via BHIM/PhonePe/GPay" },
  { type: "Payment Method", name: "Credit / Debit Card", details: "POS swipe terminal Visa, Mastercard, RuPay" },
  { type: "Payment Method", name: "Cash", details: "Direct physical currency receipt" },
  { type: "Payment Method", name: "Net Banking / NEFT", details: "Bank transfer directly to corporate account" },
  { type: "Payment Method", name: "Online Payment Gateway", details: "Razorpay / Stripe customer portal links" },

  // Appointment Status
  { type: "Appointment Status", name: "Scheduled", details: "Initial booking confirmed on calendar" },
  { type: "Appointment Status", name: "Confirmed", details: "Client acknowledged via WhatsApp or Call" },
  { type: "Appointment Status", name: "In Progress", details: "Client currently in store receiving service" },
  { type: "Appointment Status", name: "Completed", details: "Service concluded and settled" },
  { type: "Appointment Status", name: "Cancelled", details: "Rescheduled or cancelled prior to appointment" },

  // Leave Type
  { type: "Leave Type", name: "Casual Leave", details: "Personal short-notice planned time off" },
  { type: "Leave Type", name: "Sick Leave", details: "Medical indisposition or doctor visits" },
  { type: "Leave Type", name: "Paid Privilege Leave", details: "Earned annual accrued vacation leave" },
  { type: "Leave Type", name: "Maternity / Paternity", details: "Parental family care leave" },
  { type: "Leave Type", name: "Compensatory Off", details: "Off granted for working on public holidays or weekends" },

  // Tax
  { type: "Tax", name: "GST 0% (Exempted)", details: "Essential unprocessed goods with zero tax", value: 0 },
  { type: "Tax", name: "GST 5% (Concessional)", details: "Basic goods & low-slab services", value: 5 },
  { type: "Tax", name: "GST 12% (Standard Low)", details: "Processed supplies and standard items", value: 12 },
  { type: "Tax", name: "GST 18% (Standard Services)", details: "Standard GST rate for commercial salon & tech services", value: 18 },
  { type: "Tax", name: "GST 28% (Luxury Goods)", details: "High-end luxury salon & electronic products", value: 28 },

  // Supplier Category
  { type: "Supplier Category", name: "Direct Manufacturer", details: "Direct brand sourcing at factory rate" },
  { type: "Supplier Category", name: "Authorized Wholesaler", details: "Regional FMCG wholesale distributor" },
  { type: "Supplier Category", name: "Equipment Vendor", details: "Apparatus, salon chairs, electrical appliances" },
  { type: "Supplier Category", name: "Local Packaging Supplier", details: "Bags, boxes, labels, receipt papers" },

  // Units of Measurement
  { type: "Units of Measurement", name: "Pieces (pcs)", details: "Individual discrete unit" },
  { type: "Units of Measurement", name: "Boxes (box)", details: "Packaged multi-unit wholesale container" },
  { type: "Units of Measurement", name: "Kilograms (kg)", details: "Metric weight measurement" },
  { type: "Units of Measurement", name: "Liters (ltr)", details: "Metric fluid measurement" },
  { type: "Units of Measurement", name: "Sessions (session)", details: "Timed service interaction" },

  // Customer Segment
  { type: "Customer Segment", name: "Regular Client", details: "Standard repeat customer" },
  { type: "Customer Segment", name: "VIP Elite", details: "High-value loyal member with priority booking" },
  { type: "Customer Segment", name: "Walk-in", details: "First time ad-hoc walk-in visitor" },
  { type: "Customer Segment", name: "Corporate Partner", details: "Corporate contracted client account" },

  // Task Priority
  { type: "Task Priority", name: "Low", details: "Routine maintenance with flexible timeline" },
  { type: "Task Priority", name: "Medium", details: "Standard daily operational duty" },
  { type: "Task Priority", name: "High", details: "Time-sensitive task required within 24h" },
  { type: "Task Priority", name: "Urgent", details: "Critical task requiring immediate team execution" },

  // Birthday & Anniversary Wishes
  {
    type: "Birthday & Anniversary Wishes",
    name: "Employee Birthday Greeting",
    details: "Wishing you a very Happy Birthday! May your day be filled with happiness and the year ahead with great achievements. With best wishes from the team at Business OS.",
    value: {
      message: "Wishing you a very Happy Birthday! May your day be filled with happiness and the year ahead with great achievements. With best wishes from the team at Business OS.",
      channel: "Email",
      photoUrl: "",
    },
  },
  {
    type: "Birthday & Anniversary Wishes",
    name: "Work Anniversary Appreciation",
    details: "Happy Work Anniversary! Thank you for your continued dedication, positivity, and exceptional contributions to our team. Cheers to another year of success!",
    value: {
      message: "Happy Work Anniversary! Thank you for your continued dedication, positivity, and exceptional contributions to our team. Cheers to another year of success!",
      channel: "Email",
      photoUrl: "",
    },
  },
];

// ==========================================
// GET MASTERS
// GET /api/masters
// GET /api/masters?type=Services
// ==========================================
export const getMasters = async (req, res) => {
  try {
    const filter = {
      tenantId: req.tenantId,
      isActive: true,
    };

    // Auto-seed if tenant has zero active master entries
    const existingCount = await Master.countDocuments(filter);
    if (existingCount === 0) {
      const seedData = DEFAULT_MASTERS.map((m) => ({
        ...m,
        tenantId: req.tenantId,
        isActive: true,
      }));
      await Master.insertMany(seedData, { ordered: false }).catch(() => {});
    }

    // Optional type filter
    if (req.query.type) {
      filter.type = req.query.type;
    }

    const masters = await Master.find(filter).sort({
      type: 1,
      name: 1,
    });

    return res.status(200).json({
      success: true,
      data: masters,
      masters,
    });
  } catch (error) {
    console.error("❌ Get Masters Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch master records.",
    });
  }
};

// ==========================================
// SEED DEFAULT MASTERS
// POST /api/masters/seed
// ==========================================
export const seedMasters = async (req, res) => {
  try {
    const operations = DEFAULT_MASTERS.map((item) => ({
      updateOne: {
        filter: { tenantId: req.tenantId, type: item.type, name: item.name },
        update: {
          $setOnInsert: {
            tenantId: req.tenantId,
            type: item.type,
            name: item.name,
            details: item.details,
            value: item.value,
            isActive: true,
          },
        },
        upsert: true,
      },
    }));

    await Master.bulkWrite(operations, { ordered: false });

    const masters = await Master.find({ tenantId: req.tenantId, isActive: true }).sort({
      type: 1,
      name: 1,
    });

    return res.status(200).json({
      success: true,
      message: "Standard master records seeded successfully.",
      data: masters,
      masters,
    });
  } catch (error) {
    console.error("❌ Seed Masters Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to seed standard masters.",
    });
  }
};

// ==========================================
// CREATE MASTER
// POST /api/masters
// ==========================================
export const createMaster = async (req, res) => {
  try {
    const { type, name, details = "", value = null } = req.body;

    if (!type || !type.trim()) {
      return res.status(400).json({
        success: false,
        message: "Master type is required.",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Master name is required.",
      });
    }

    const normalizedType = type.trim();
    const normalizedName = name.trim();

    // Prevent duplicate active/inactive records
    const existingMaster = await Master.findOne({
      tenantId: req.tenantId,
      type: normalizedType,
      name: {
        $regex: `^${normalizedName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}$`,
        $options: "i",
      },
    });

    if (existingMaster) {
      // If an old inactive record exists, reactivate it
      if (!existingMaster.isActive) {
        existingMaster.isActive = true;
        existingMaster.details = details || "";
        existingMaster.value = value;

        await existingMaster.save();

        return res.status(200).json({
          success: true,
          message: "Master entry restored successfully.",
          data: existingMaster,
        });
      }

      return res.status(409).json({
        success: false,
        message: `"${normalizedName}" already exists under "${normalizedType}".`,
      });
    }

    const newMaster = await Master.create({
      tenantId: req.tenantId,
      type: normalizedType,
      name: normalizedName,
      details: details || "",
      value,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Master entry created successfully.",
      data: newMaster,
    });
  } catch (error) {
    console.error("❌ Create Master Error:", error);

    // Handle MongoDB duplicate-key errors safely
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This master entry already exists.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create master entry.",
    });
  }
};

// ==========================================
// UPDATE MASTER
// PATCH /api/masters/:id
// ==========================================
export const updateMaster = async (req, res) => {
  try {
    const { type, name, details, value, isActive } = req.body;

    const master = await Master.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Master entry not found.",
      });
    }

    const updatedType =
      typeof type === "string" && type.trim()
        ? type.trim()
        : master.type;

    const updatedName =
      typeof name === "string" && name.trim()
        ? name.trim()
        : master.name;

    // Check duplicate before updating
    const duplicate = await Master.findOne({
      _id: { $ne: master._id },
      tenantId: req.tenantId,
      type: updatedType,
      name: {
        $regex: `^${updatedName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}$`,
        $options: "i",
      },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `"${updatedName}" already exists under "${updatedType}".`,
      });
    }

    master.type = updatedType;
    master.name = updatedName;

    if (details !== undefined) {
      master.details = details;
    }

    if (value !== undefined) {
      master.value = value;
    }

    if (isActive !== undefined) {
      master.isActive = Boolean(isActive);
    }

    await master.save();

    return res.status(200).json({
      success: true,
      message: "Master entry updated successfully.",
      data: master,
    });
  } catch (error) {
    console.error("❌ Update Master Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This master entry already exists.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update master entry.",
    });
  }
};

// ==========================================
// DELETE / DEACTIVATE MASTER
// DELETE /api/masters/:id
// ==========================================
export const deleteMaster = async (req, res) => {
  try {
    const master = await Master.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.tenantId,
      },
      {
        $set: {
          isActive: false,
        },
      },
      {
        new: true,
      }
    );

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Master entry not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Master item removed successfully.",
      data: master,
    });
  } catch (error) {
    console.error("❌ Delete Master Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove master entry.",
    });
  }
};