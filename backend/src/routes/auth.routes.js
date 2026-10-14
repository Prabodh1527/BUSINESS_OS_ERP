import mongoose from "mongoose";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import { createTransporter } from "../utils/email.js";

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "business_os_super_secret_key_2026";

// ==========================================
// MIDDLEWARE TO AUTHENTICATE JWT TOKEN
// ==========================================

const authenticateToken = (req, res, next) => {
  const authHeader =
    req.headers.authorization || req.headers.Authorization;

  const token =
    authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required.",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    req.user = user;
    next();
  });
};

// ==========================================
// HELPER: GENERATE TENANT DATABASE NAME
// ==========================================

const generateTenantDbName = (identifier) => {
  if (!identifier) {
    return `tenant_${Date.now()}`;
  }

  const sanitized = identifier
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `tenant_${sanitized || "business"}_${Date.now()}`;
};

// ==========================================
// 1. REGISTER OWNER / WORKSPACE
// POST /api/auth/register
// ==========================================

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, and password are required.",
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const normalizedRole =
      role?.toUpperCase() || "OWNER";

    // Only owners create new workspaces.
    if (normalizedRole !== "OWNER") {
      return res.status(400).json({
        success: false,
        message:
          "Only OWNER accounts can create a new workspace.",
      });
    }

    // Check existing account
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    // Generate isolated tenant database name
    const tenantDbName =
      generateTenantDbName(name);

    // ------------------------------------------
    // CREATE USER FIRST
    // ------------------------------------------

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "OWNER",
      tenantDbName,
    });

    // ------------------------------------------
    // CREATE TENANT
    // ------------------------------------------

    const tenant = await Tenant.create({
      companyName: `${name.trim()}'s Workspace`,
      businessType: "Other",
      ownerId: newUser._id,
      dbName: tenantDbName,
      status: "ACTIVE",
      onboardingCompleted: false,
    });

    // ------------------------------------------
    // LINK USER TO TENANT
    // ------------------------------------------

    newUser.tenantId = tenant._id;
    newUser.tenantDbName = tenant.dbName;

    await newUser.save({
      validateModifiedOnly: true,
    });

    // ------------------------------------------
    // GENERATE JWT
    // ------------------------------------------

    const token = jwt.sign(
      {
        userId: newUser._id,
        id: newUser._id,
        _id: newUser._id,

        email: newUser.email,

        role: newUser.role,

        tenantId: tenant._id.toString(),
        companyId: tenant._id.toString(),

        tenantDbName: tenant.dbName,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.status(201).json({
      success: true,

      message:
        "Workspace created successfully!",

      token,

      tenant: {
        _id: tenant._id,
        companyName: tenant.companyName,
        businessType: tenant.businessType,
        onboardingCompleted:
          tenant.onboardingCompleted,
        dbName: tenant.dbName,
      },

      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,

        tenantId: tenant._id,
        tenantDbName: tenant.dbName,

        onboardingCompleted:
          tenant.onboardingCompleted,

        companyName:
          tenant.companyName,

        token,
      },
    });
  } catch (error) {
    console.error(
      "Registration Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Server error during registration.",
    });
  }
});

// ==========================================
// 2. LOGIN ROUTE
// POST /api/auth/login
// ==========================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
      role,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide both email and password.",
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    // ------------------------------------------
    // ROLE CHECK
    // ------------------------------------------

    if (
      role &&
      user.role?.toUpperCase() !==
        role.toUpperCase()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This account does not have access to this portal.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "Password record missing for this account.",
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    // ------------------------------------------
    // LOAD TENANT
    // ------------------------------------------

    let tenant = null;

    if (user.tenantId) {
      tenant = await Tenant.findById(
        user.tenantId
      );
    }

    // ------------------------------------------
    // BACKWARD COMPATIBILITY FOR OLD USERS
    // ------------------------------------------

    if (!tenant && user.role === "OWNER") {
      tenant = await Tenant.findOne({
        ownerId: user._id,
      });

      if (tenant) {
        user.tenantId = tenant._id;
        user.tenantDbName = tenant.dbName;

        await user.save({
          validateModifiedOnly: true,
        });
      }
    }

    // ------------------------------------------
    // TENANT MUST EXIST
    // ------------------------------------------

    if (!tenant) {
      return res.status(403).json({
        success: false,
        message:
          "Business workspace not found. Please contact your administrator.",
      });
    }

    // ------------------------------------------
    // TENANT STATUS
    // ------------------------------------------

    if (tenant.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message:
          "Your business workspace is currently suspended.",
      });
    }

    // ------------------------------------------
    // GENERATE JWT
    // ------------------------------------------

    const token = jwt.sign(
      {
        userId: user._id,
        id: user._id,
        _id: user._id,

        email: user.email,

        role: user.role,

        tenantId:
          tenant._id.toString(),

        companyId:
          tenant._id.toString(),

        tenantDbName:
          tenant.dbName,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      success: true,

      message:
        "Logged in successfully!",

      token,

      tenantDbName:
        tenant.dbName,

      tenant: {
        _id: tenant._id,
        companyName:
          tenant.companyName,
        businessType:
          tenant.businessType,
        onboardingCompleted:
          tenant.onboardingCompleted,
      },

      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,

        tenantId: tenant._id,

        tenantDbName:
          tenant.dbName,

        companyName:
          tenant.companyName,

        businessType:
          tenant.businessType,

        onboardingCompleted:
          tenant.onboardingCompleted,

        token,
      },
    });
  } catch (error) {
    console.error(
      "Login Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Server error during login.",
    });
  }
});

// ==========================================
// 3. FORGOT PASSWORD
// POST /api/auth/forgot-password
// ==========================================

router.post(
  "/forgot-password",
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message:
            "Email address is required.",
        });
      }

      const normalizedEmail =
        email.toLowerCase().trim();

      const user =
        await User.findOne({
          email: normalizedEmail,
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "No account registered with this email address.",
        });
      }

      const otp = Math.floor(
        100000 +
          Math.random() * 900000
      ).toString();

      user.resetOtp = otp;

      user.resetOtpExpire =
        Date.now() +
        10 * 60 * 1000;

      await user.save({
        validateModifiedOnly: true,
      });

      // ------------------------------------------
      // SEND EMAIL
      // ------------------------------------------
      const transporter = createTransporter();

      if (!transporter) {
        console.warn(`⚠️ SMTP not configured on server. Generated OTP for ${normalizedEmail}: ${otp}`);
        return res.status(500).json({
          success: false,
          message: "Email delivery service is not configured on this server. Please ensure SMTP_USER and SMTP_PASS are set in your hosting environment variables (e.g. Render Dashboard).",
          debugOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
        });
      }

      const mailOptions = {
        from: `Business OS <${process.env.SMTP_USER}>`,
        to: normalizedEmail,
        subject: "Password Reset OTP - Business OS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #4f46e5; margin-top: 0;">
              Password Reset Request
            </h2>
            <p style="color: #334155;">
              Use the following OTP code to reset your password.
              This code will expire in 10 minutes.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <span style="font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">
                ${otp}
              </span>
            </div>
            <p style="color: #64748b; font-size: 13px;">
              If you didn't request this password reset,
              please ignore this email.
            </p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset OTP sent to ${normalizedEmail}`);
      } catch (mailErr) {
        console.error("❌ Email delivery failed:", mailErr.message);
        return res.status(500).json({
          success: false,
          message: `Email delivery failed: ${mailErr.message}. Verify that SMTP_USER and Gmail App Password are valid in hosting environment variables.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Password reset OTP has been sent to your email address.",
        otp: process.env.NODE_ENV === "development" ? otp : undefined,
      });
    } catch (error) {
      console.error(
        "Forgot Password Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Server error while sending OTP.",
      });
    }
  }
);

// ==========================================
// 4. VERIFY OTP & RESET PASSWORD
// POST /api/auth/reset-password
// ==========================================

router.post(
  "/reset-password",
  async (req, res) => {
    try {
      const {
        email,
        otp,
        newPassword,
      } = req.body;

      if (
        !email ||
        !otp ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Email, OTP, and new password are required.",
        });
      }

      const normalizedEmail =
        email.toLowerCase().trim();

      const user =
        await User.findOne({
          email: normalizedEmail,

          resetOtp: otp,

          resetOtpExpire: {
            $gt: Date.now(),
          },
        }).select("+password");

      if (!user) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid or expired OTP code.",
        });
      }

      const salt =
        await bcrypt.genSalt(10);

      user.password =
        await bcrypt.hash(
          newPassword,
          salt
        );

      user.resetOtp = undefined;
      user.resetOtpExpire = undefined;

      await user.save({
        validateModifiedOnly: true,
      });

      return res.status(200).json({
        success: true,
        message:
          "Password reset successful! You can now log in with your new password.",
      });
    } catch (error) {
      console.error(
        "Reset Password Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Server error while resetting password.",
      });
    }
  }
);

// ==========================================
// 5. UPDATE PASSWORD
// PUT /api/auth/update-password
// ==========================================

router.put(
  "/update-password",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        currentPassword,
        newPassword,
      } = req.body;

      const userId =
        req.user.userId ||
        req.user.id ||
        req.user._id;

      if (
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Current password and new password are required.",
        });
      }

      const user =
        await User.findById(
          userId
        ).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      const isMatch =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message:
            "Incorrect current password.",
        });
      }

      const salt =
        await bcrypt.genSalt(10);

      user.password =
        await bcrypt.hash(
          newPassword,
          salt
        );

      await user.save({
        validateModifiedOnly: true,
      });

      return res.status(200).json({
        success: true,
        message:
          "Password updated successfully!",
      });
    } catch (error) {
      console.error(
        "Update Password Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Server error while updating password.",
      });
    }
  }
);

// ==========================================
// 6. CREATE EMPLOYEE
// POST /api/auth/create-employee
// ==========================================

router.post(
  "/create-employee",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        name,
        email,
        designation,
        phone,
        salary,
        status,
      } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          success: false,
          message:
            "Name and Email are required.",
        });
      }

      const normalizedEmail =
        email.toLowerCase().trim();

      // Check duplicate account
      const existingEmployee =
        await User.findOne({
          email: normalizedEmail,
        });

      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message:
            "An account with this email already exists.",
        });
      }

      // ------------------------------------------
      // GET CREATOR
      // ------------------------------------------

      const creator =
        await User.findById(
          req.user.userId ||
            req.user.id ||
            req.user._id
        );

      if (!creator) {
        return res.status(404).json({
          success: false,
          message:
            "Creating user account not found.",
        });
      }

      // ------------------------------------------
      // GET TENANT
      // ------------------------------------------

      let tenant = null;

      if (creator.tenantId) {
        tenant =
          await Tenant.findById(
            creator.tenantId
          );
      }

      if (!tenant) {
        return res.status(403).json({
          success: false,
          message:
            "Business workspace not found.",
        });
      }

      if (tenant.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          message:
            "Business workspace is suspended.",
        });
      }

      // ------------------------------------------
      // GENERATE TEMP PASSWORD
      // ------------------------------------------

      const generatedPassword =
        `Emp#${crypto
          .randomBytes(3)
          .toString("hex")}`;

      const salt =
        await bcrypt.genSalt(10);

      const hashedPassword =
        await bcrypt.hash(
          generatedPassword,
          salt
        );

      // ------------------------------------------
      // CREATE EMPLOYEE
      // ------------------------------------------

      const newEmployee =
        await User.create({
          name: name.trim(),

          email: normalizedEmail,

          password:
            hashedPassword,

          role: "EMPLOYEE",

          phone,

          salary,

          status:
            status || "Active",

          tenantId:
            tenant._id,

          tenantDbName:
            tenant.dbName,
        });

      // ------------------------------------------
      // SEND EMAIL
      // ------------------------------------------

      const transporter = createTransporter();

      if (transporter) {

        const mailOptions = {
          from: `Business OS <${process.env.SMTP_USER}>`,

          to: normalizedEmail,

          subject:
            "Welcome to Business OS - Your Account Login Credentials",

          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">

              <h2 style="color: #4f46e5; margin-top: 0;">
                Welcome aboard, ${name}!
              </h2>

              <p style="color: #334155;">
                Your employee profile has been created
                in Business OS.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">

                <p style="margin: 0 0 8px 0; color: #475569;">
                  <strong>Login Portal:</strong>
                  <a href="http://localhost:5173/login" style="color: #4f46e5;">
                    Access Portal
                  </a>
                </p>

                <p style="margin: 0 0 8px 0; color: #475569;">
                  <strong>Email / Username:</strong>
                  ${normalizedEmail}
                </p>

                <p style="margin: 0; color: #475569;">
                  <strong>Temporary Password:</strong>
                  <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1e293b;">
                    ${generatedPassword}
                  </span>
                </p>

              </div>

              <p style="color: #64748b; font-size: 13px;">
                Please log in using these credentials.
              </p>

            </div>
          `,
        };

        await transporter.sendMail(
          mailOptions
        );

        console.log(
          `✅ Welcome email with credentials sent to ${normalizedEmail}`
        );
      } else {
        console.warn(
          `⚠️ SMTP not configured. Employee credentials for ${normalizedEmail}: ${generatedPassword}`
        );
      }

      return res.status(201).json({
        success: true,

        message:
          "Employee created and login credentials sent via email!",

        employee: {
          _id:
            newEmployee._id,

          name:
            newEmployee.name,

          email:
            newEmployee.email,

          designation:
            designation ||
            "Employee",

          phone,

          salary,

          status:
            newEmployee.status,

          tenantId:
            tenant._id,

          tenantDbName:
            tenant.dbName,
        },
      });
    } catch (error) {
      console.error(
        "Create Employee Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to create employee.",
      });
    }
  }
);
// ==========================================
// 7. DELETE ACCOUNT + WORKSPACE
// DELETE /api/auth/account
// ==========================================

router.delete(
  "/account",
  authenticateToken,
  async (req, res) => {
    try {
      // ------------------------------------------
      // GET CURRENT USER
      // ------------------------------------------

      const userId =
        req.user.userId ||
        req.user.id ||
        req.user._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User authentication required.",
        });
      }

      const user =
        await User.findById(userId).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      // ------------------------------------------
      // PASSWORD + CONFIRMATION
      // ------------------------------------------

      const {
        currentPassword,
        confirmation,
      } = req.body;

      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required.",
        });
      }

      if (confirmation !== "DELETE") {
        return res.status(400).json({
          success: false,
          message:
            'Please type "DELETE" to confirm account deletion.',
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!passwordMatches) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      // ------------------------------------------
      // OWNER ONLY
      // ------------------------------------------

      if (user.role?.toUpperCase() !== "OWNER") {
        return res.status(403).json({
          success: false,
          message:
            "Only the workspace owner can delete the workspace.",
        });
      }

      // ------------------------------------------
      // FIND TENANT
      // ------------------------------------------

      let tenant = null;

      if (user.tenantId) {
        tenant =
          await Tenant.findById(user.tenantId);
      }

      // Fallback for older accounts
      if (!tenant) {
        tenant =
          await Tenant.findOne({
            ownerId: user._id,
          });
      }

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message:
            "Business workspace not found.",
        });
      }

      // ------------------------------------------
      // DELETE TENANT DATABASE
      // ------------------------------------------

      if (tenant.dbName) {
        try {
          const tenantDb =
            mongoose.connection.useDb(
              tenant.dbName,
              {
                useCache: false,
              }
            );

          await tenantDb.dropDatabase();

          console.log(
            `✅ Tenant database deleted: ${tenant.dbName}`
          );
        } catch (dbError) {
          console.error(
            "Tenant database deletion error:",
            dbError
          );

          return res.status(500).json({
            success: false,
            message:
              "Workspace data could not be deleted. Your account was not removed.",
          });
        }
      }

      // ------------------------------------------
      // DELETE ALL USERS BELONGING TO TENANT
      // ------------------------------------------

      await User.deleteMany({
        tenantId: tenant._id,
      });

      console.log(
        `✅ Users deleted for tenant: ${tenant._id}`
      );

      // ------------------------------------------
      // DELETE TENANT RECORD
      // ------------------------------------------

      await Tenant.deleteOne({
        _id: tenant._id,
      });

      console.log(
        `✅ Tenant record deleted: ${tenant._id}`
      );

      // ------------------------------------------
      // RESPONSE
      // ------------------------------------------

      return res.status(200).json({
        success: true,
        message:
          "Your account and business workspace have been permanently deleted.",
      });

    } catch (error) {
      console.error(
        "Delete Account Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to delete account and workspace.",
      });
    }
  }
);

export default router;
