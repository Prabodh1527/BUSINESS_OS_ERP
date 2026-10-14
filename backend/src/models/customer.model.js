import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    company: {
      type: String,
      default: "",
    },
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "VIP"],
      default: "ACTIVE",
    },
    telegramChatId: {
      type: String,
      default: "",
      index: true,
    },
    telegramUsername: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

customerSchema.index({ tenantId: 1, email: 1 });

const Customer =
  mongoose.models.Customer || mongoose.model("Customer", customerSchema);

export default Customer;