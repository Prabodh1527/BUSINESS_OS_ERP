import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    emergencyName: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyPhone: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      default: "Staff",
    },
    department: {
      type: String,
      default: "Operations",
    },
    salary: {
      type: Number,
      default: 0,
    },
    joinDate: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "TERMINATED", "INACTIVE"],
      default: "ACTIVE",
    },
    dob: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    postalCode: {
      type: String,
      default: "",
    },
    emergencyRelationship: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    bankAccount: {
      type: String,
      default: "",
    },
    bankIfsc: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    themePreference: {
      type: String,
      default: "dark",
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
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

employeeSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });

const Employee =
  mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

export default Employee;