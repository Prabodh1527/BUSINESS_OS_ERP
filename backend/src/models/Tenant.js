import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    businessType: {
      type: String,
      default: "Other",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    businessEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    businessPhone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    state: {
      type: String,
      default: "",
      trim: true,
    },

    country: {
      type: String,
      default: "India",
      trim: true,
    },

    postalCode: {
      type: String,
      default: "",
      trim: true,
    },

    website: {
      type: String,
      default: "",
      trim: true,
    },

    logo: {
      type: String,
      default: "",
      trim: true,
    },

    theme: {
      type: String,
      default: "Dark",
      trim: true,
    },

    brandColor: {
      type: String,
      default: "Indigo",
      trim: true,
    },

    compactLayout: {
      type: Boolean,
      default: false,
    },

    showAnimations: {
      type: Boolean,
      default: true,
    },

    aiConfig: {
      provider: {
        type: String,
        default: "gemini", // 'gemini' | 'ollama' | 'builtin'
      },
      modelName: {
        type: String,
        default: "gemini-1.5-flash",
      },
      apiKey: {
        type: String,
        default: "",
      },
      ollamaUrl: {
        type: String,
        default: "http://localhost:11434",
      },
    },

    telegramConfig: {
      botToken: {
        type: String,
        default: "",
        trim: true,
      },
      botUsername: {
        type: String,
        default: "",
        trim: true,
      },
      connected: {
        type: Boolean,
        default: false,
      },
      connectedAt: {
        type: Date,
        default: null,
      },
      adminChatId: {
        type: String,
        default: "",
        trim: true,
      },
      notificationPreferences: {
        appointments: { type: Boolean, default: true },
        invoices: { type: Boolean, default: true },
        tasks: { type: Boolean, default: true },
        leaves: { type: Boolean, default: true },
        inventory: { type: Boolean, default: true },
        purchaseOrders: { type: Boolean, default: true },
        dailySummary: { type: Boolean, default: true },
        dailySummaryTime: { type: String, default: "09:00" },
      },
      lastDailySummarySent: {
        type: Date,
        default: null,
      },
    },

    whatsappConfig: {
      phoneNumberId: {
        type: String,
        default: "",
        trim: true,
      },
      accessToken: {
        type: String,
        default: "",
        trim: true,
      },
      businessAccountId: {
        type: String,
        default: "",
        trim: true,
      },
      businessPhoneNumber: {
        type: String,
        default: "",
        trim: true,
      },
      connected: {
        type: Boolean,
        default: false,
      },
      connectedAt: {
        type: Date,
        default: null,
      },
      webhookVerifyToken: {
        type: String,
        default: "business_os_wa_verify_token",
      },
      notificationPreferences: {
        appointments: { type: Boolean, default: true },
        invoices: { type: Boolean, default: true },
        tasks: { type: Boolean, default: true },
        inventory: { type: Boolean, default: true },
        dailySummary: { type: Boolean, default: true },
      },
    },

    openTime: {

      type: String,
      default: "",
      trim: true,
    },

    closeTime: {
      type: String,
      default: "",
      trim: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    dbName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },

    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    onboardingCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Tenant =
  mongoose.models.Tenant ||
  mongoose.model("Tenant", tenantSchema);

export default Tenant;