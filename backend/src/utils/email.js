import nodemailer from "nodemailer";

/**
 * Creates and returns a nodemailer transporter configured with environment credentials.
 * Returns null if SMTP configuration is absent, preventing crashes.
 */
export const createTransporter = () => {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 465;
  const isSecure = port === 465 || !process.env.SMTP_PORT;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

/**
 * Generic email dispatcher with robust error handling and logging.
 */
export const sendSystemEmail = async ({ to, subject, html, attachments = [] }) => {
  if (!to || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false;
  }
  try {
    const transporter = createTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
      from: `"Business OS" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    console.error(`❌ Email delivery failed to [${to}]:`, error.message);
    return false;
  }
};

/**
 * Template: Appointment Booking / Status Email
 */
export const sendAppointmentEmail = async (appointment, type = "CONFIRMED") => {
  const recipient = appointment.customer?.email;
  if (!recipient) return;

  const titleMap = {
    CONFIRMED: "Appointment Confirmation",
    SCHEDULED: "Appointment Scheduled",
    COMPLETED: "Appointment Completed",
    CANCELLED: "Appointment Cancellation Notice",
  };
  const title = titleMap[type] || "Appointment Update";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; padding: 30px; color: #f8fafc;">
      <div style="max-width: 540px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px;">
        <div style="border-bottom: 1px solid #1f2937; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 22px;">Business OS</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">${title}</p>
        </div>
        <p style="color: #e2e8f0; font-size: 15px; margin-bottom: 16px;">
          Dear <strong>${appointment.customer?.name || "Valued Client"}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
          ${
            type === "CANCELLED"
              ? `Your appointment <strong>#${appointment.appointmentId}</strong> has been cancelled.`
              : `Your session for <strong>${appointment.service}</strong> has been updated in our system.`
          }
        </p>
        <table style="width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; margin-bottom: 20px; font-size: 13px; color: #e2e8f0;">
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8; border-bottom: 1px solid #334155;">Appointment ID</td>
            <td style="padding: 10px 14px; font-family: monospace; font-weight: bold; text-align: right; border-bottom: 1px solid #334155; color: #818cf8;">${appointment.appointmentId}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8; border-bottom: 1px solid #334155;">Service</td>
            <td style="padding: 10px 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">${appointment.service}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8; border-bottom: 1px solid #334155;">Date & Time</td>
            <td style="padding: 10px 14px; text-align: right; border-bottom: 1px solid #334155;">${appointment.date} at ${appointment.time}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8; border-bottom: 1px solid #334155;">Specialist</td>
            <td style="padding: 10px 14px; text-align: right; border-bottom: 1px solid #334155;">${appointment.employee || "Assigned Specialist"}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8;">Status</td>
            <td style="padding: 10px 14px; text-align: right; font-weight: bold; color: ${type === 'CANCELLED' ? '#f43f5e' : '#10b981'};">${appointment.status}</td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
          Thank you for choosing us. If you have questions, please reply directly to this email.
        </p>
      </div>
    </div>
  `;

  await sendSystemEmail({
    to: recipient,
    subject: `[${appointment.appointmentId}] ${title} - ${appointment.service}`,
    html,
  });
};

/**
 * Template: Task Assigned to Employee
 */
export const sendTaskAssignmentEmail = async (task, employeeEmail) => {
  if (!employeeEmail) return;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; padding: 30px; color: #f8fafc;">
      <div style="max-width: 540px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px;">
        <div style="border-bottom: 1px solid #1f2937; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 22px;">Business OS</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">New Work Assignment</p>
        </div>
        <p style="color: #e2e8f0; font-size: 15px; margin-bottom: 12px;">
          Hello <strong>${task.assignedTo || "Team Member"}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
          A new task has been assigned to you in Business OS:
        </p>
        <div style="background: #1e293b; border-left: 4px solid #6366f1; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 16px;">${task.title}</h3>
          <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.4;">${task.description || "No additional description provided."}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e2e8f0; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; color: #94a3b8;">Priority Level:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: ${task.priority === 'High' || task.priority === 'Urgent' ? '#f43f5e' : '#f59e0b'};">${task.priority}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #94a3b8;">Target Due Date:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #e2e8f0;">${task.dueDate || "Immediate"}</td>
          </tr>
        </table>
        <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
          Log into your Staff Portal to update progress and complete this task.
        </p>
      </div>
    </div>
  `;

  await sendSystemEmail({
    to: employeeEmail,
    subject: `[Task Assigned] ${task.title} (${task.priority} Priority)`,
    html,
  });
};

/**
 * Template: Leave Status Decision Email (Approved / Rejected)
 */
export const sendLeaveDecisionEmail = async (leave) => {
  const recipient = leave.employeeEmail;
  if (!recipient) return;

  const isApproved = leave.status === "Approved";
  const badgeColor = isApproved ? "#10b981" : "#ef4444";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; padding: 30px; color: #f8fafc;">
      <div style="max-width: 540px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px;">
        <div style="border-bottom: 1px solid #1f2937; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 22px;">Business OS</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Leave Request Status Update</p>
        </div>
        <p style="color: #e2e8f0; font-size: 15px; margin-bottom: 14px;">
          Dear <strong>${leave.employee}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
          Your request for <strong>${leave.type}</strong> has been reviewed by management.
        </p>
        <div style="background: #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #94a3b8; font-size: 13px;">Decision Status:</span>
            <span style="color: ${badgeColor}; font-weight: bold; font-size: 14px; text-transform: uppercase;">${leave.status}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #94a3b8; font-size: 13px;">Requested Duration:</span>
            <span style="color: #e2e8f0; font-size: 13px;">${leave.from} to ${leave.to} (${leave.days} day${leave.days === 1 ? '' : 's'})</span>
          </div>
          ${
            leave.rejectionReason
              ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #334155;">
                  <span style="color: #f87171; font-size: 12px; font-weight: 600;">Reason:</span>
                  <p style="margin: 4px 0 0 0; color: #e2e8f0; font-size: 13px;">${leave.rejectionReason}</p>
                </div>`
              : ""
          }
        </div>
        <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
          This record is synchronized with your monthly attendance and payroll statement.
        </p>
      </div>
    </div>
  `;

  await sendSystemEmail({
    to: recipient,
    subject: `Leave Request ${leave.status}: ${leave.from} to ${leave.to}`,
    html,
  });
};

/**
 * Template: Birthday & Work Anniversary Celebration Email with Dynamic Photo Banner
 */
export const sendCelebrationEmail = async ({
  to,
  employeeName,
  companyName = "Business OS",
  occasion = "BIRTHDAY",
  message,
  photoUrl,
}) => {
  if (!to) return false;
  const isBday = String(occasion || "").toUpperCase().includes("BIRTHDAY");
  const title = isBday ? "Happy Birthday! 🎂🎉" : "Happy Work Anniversary! 🏆✨";
  const banner = photoUrl?.trim() || (isBday
    ? "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80"
    : "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80");
  
  const greeting = message?.trim() || (isBday
    ? `Wishing you a very Happy Birthday, ${employeeName}! May your special day be filled with happiness, success, and wonderful memories.`
    : `Happy Work Anniversary, ${employeeName}! Thank you for your dedication, excellence, and valuable contributions to ${companyName}.`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; padding: 32px 16px; color: #f8fafc;">
      <div style="max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        ${banner ? `
          <div style="width: 100%; height: 220px; overflow: hidden; background: #1e1b4b; position: relative;">
            <img src="${banner}" alt="Celebration" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        ` : ''}
        <div style="padding: 32px 28px; text-align: center;">
          <span style="display: inline-block; padding: 6px 14px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px; color: #a5b4fc; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
            ${isBday ? 'Birthday Celebration' : 'Milestone Anniversary'}
          </span>
          <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0 0 12px 0; line-height: 1.25;">
            ${title}
          </h1>
          <p style="color: #cbd5e1; font-size: 16px; font-weight: 600; margin: 0 0 20px 0;">
            Dear <span style="color: #818cf8;">${employeeName}</span>,
          </p>
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 14px; padding: 22px; margin-bottom: 24px; text-align: left;">
            <p style="color: #e2e8f0; font-size: 14px; line-height: 1.65; margin: 0; white-space: pre-line;">
              ${greeting}
            </p>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 6px 0;">
            Warmest regards and best wishes,
          </p>
          <p style="color: #ffffff; font-size: 15px; font-weight: 700; margin: 0;">
            Team ${companyName}
          </p>
        </div>
        <div style="background: #0f172a; border-top: 1px solid #1f2937; padding: 14px; text-align: center;">
          <p style="color: #64748b; font-size: 11px; margin: 0;">
            Sent automatically by Business OS Enterprise Workspace
          </p>
        </div>
      </div>
    </div>
  `;

  return await sendSystemEmail({
    to,
    subject: `${title} - Warm wishes from ${companyName}`,
    html,
  });
};
