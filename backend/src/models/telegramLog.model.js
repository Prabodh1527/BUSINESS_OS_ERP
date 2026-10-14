import mongoose from "mongoose";

const telegramLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    recipientChatId: {
      type: String,
      default: "",
    },
    recipientName: {
      type: String,
      default: "",
    },
    recipientRole: {
      type: String,
      default: "ADMIN",
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      default: "SENT",
    },
    messageSnippet: {
      type: String,
      default: "",
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

telegramLogSchema.index({ tenantId: 1, createdAt: -1 });

const TelegramLog =
  mongoose.models.TelegramLog || mongoose.model("TelegramLog", telegramLogSchema);

export default TelegramLog;
