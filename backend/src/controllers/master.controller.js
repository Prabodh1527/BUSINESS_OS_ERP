import Master from "../models/Master.js";

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