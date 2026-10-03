const nodemailer = require("nodemailer");

/*
=========================================================
EMAIL SERVICE

Reads SMTP configuration from environment variables so
no credentials are hardcoded:

  EMAIL_HOST       e.g. smtp.gmail.com
  EMAIL_PORT       e.g. 587
  EMAIL_SECURE     "true" for port 465, otherwise "false"
  EMAIL_USER       the sending email address
  EMAIL_PASS       an app password (NOT your normal Gmail
                   password - Gmail requires a 16-char
                   "App Password" generated from
                   https://myaccount.google.com/apppasswords)
  EMAIL_FROM       optional, defaults to EMAIL_USER
  FRONTEND_URL     e.g. https://ecommerce-backend-1-a9y7.onrender.com
                   (used to build the reset-password link)

If these aren't set, email sending is skipped gracefully
and a warning is logged - the rest of the app keeps
working.
=========================================================
*/

let transporter = null;

const isEmailConfigured = () =>
    Boolean(
        process.env.EMAIL_HOST &&
        process.env.EMAIL_USER &&
        process.env.EMAIL_PASS
    );

const getTransporter = () => {

    if (transporter) {
        return transporter;
    }

    if (!isEmailConfigured()) {
        return null;
    }

    transporter = nodemailer.createTransport({

        host: process.env.EMAIL_HOST,

        port: Number(process.env.EMAIL_PORT) || 587,

        secure: process.env.EMAIL_SECURE === "true",

        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }

    });

    return transporter;

};

/*
=========================================================
SEND PASSWORD RESET EMAIL
=========================================================
*/

exports.sendPasswordResetEmail = async ({ to, name, resetUrl }) => {

    const transport = getTransporter();

    if (!transport) {

        console.warn(
            "EMAIL NOT CONFIGURED - set EMAIL_HOST/EMAIL_USER/EMAIL_PASS env vars. " +
            "Skipping password reset email. Reset URL was:",
            resetUrl
        );

        return { sent: false, reason: "not_configured" };

    }

    const fromAddress =
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #6C5CE7;">Password Reset Request</h2>
            <p>Hi ${name || "there"},</p>
            <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
            <p style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background: #6C5CE7; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Reset Password
                </a>
            </p>
            <p style="color: #888; font-size: 13px;">
                If you didn't request this, you can safely ignore this email - your password will remain unchanged.
            </p>
            <p style="color: #888; font-size: 13px;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetUrl}">${resetUrl}</a>
            </p>
        </div>
    `;

    try {

        await transport.sendMail({
            from: fromAddress,
            to,
            subject: "Reset your password",
            html
        });

        return { sent: true };

    } catch (error) {

        console.error("SEND PASSWORD RESET EMAIL ERROR:", error);

        return { sent: false, reason: "send_failed", error };

    }

};

exports.isEmailConfigured = isEmailConfigured;
