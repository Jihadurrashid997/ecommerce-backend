const nodemailer = require("nodemailer");

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

const escapeHtml = value =>
    String(value || "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);

const getLogoUrl = () => {
    if (process.env.EMAIL_LOGO_URL) {
        return process.env.EMAIL_LOGO_URL;
    }

    const frontendUrl =
        process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
    return frontendUrl
        ? `${frontendUrl.replace(/\/+$/, "")}/brand/etop-loading-logo.png`
        : "";
};

const createEmailHtml = ({
    name,
    code,
    title,
    description,
    warning
}) => {
    const logoUrl = getLogoUrl();
    const brand = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="E Top" width="150" style="display:block;max-width:150px;height:auto;margin:0 auto 24px;">`
        : `<div style="margin-bottom:24px;color:#2563eb;font-size:30px;font-weight:800;">E Top</div>`;

    return `
        <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
            <div style="max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e5eaf2;border-radius:16px;text-align:center;">
                ${brand}
                <h1 style="margin:0 0 16px;color:#172554;font-size:24px;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 16px;text-align:left;">Hi ${escapeHtml(name || "there")},</p>
                <p style="margin:0 0 24px;text-align:left;">${escapeHtml(description)}</p>
                <div style="margin:28px 0;padding:18px;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-size:32px;font-weight:800;letter-spacing:8px;">${escapeHtml(code)}</div>
                <p style="margin:0;text-align:left;color:#64748b;font-size:13px;">This code expires in 10 minutes. ${escapeHtml(warning)}</p>
            </div>
            <p style="margin:16px auto 0;max-width:480px;text-align:center;color:#94a3b8;font-size:12px;">E Top · Share, connect, and shop</p>
        </div>
    `;
};

exports.isEmailConfigured = isEmailConfigured;

exports.sendVerificationEmail = async ({ to, name, code }) =>
    sendCodeEmail({
        to,
        name,
        code,
        subject: "Verify your E Top email",
        title: "Verify your email",
        description: "Use this code to verify your email address and finish creating your E Top account.",
        warning: "If you did not create an E Top account, you can ignore this email."
    });

exports.sendPasswordResetEmail = async ({ to, name, code }) =>
    sendCodeEmail({
        to,
        name,
        code,
        subject: "Your E Top password reset code",
        title: "Password reset code",
        description: "Use this code to verify your identity and reset your E Top password.",
        warning: "If you did not request a password reset, you can safely ignore this email."
    });

async function sendCodeEmail({
    to,
    name,
    code,
    subject,
    title,
    description,
    warning
}) {
    const transport = getTransporter();
    if (!transport) {
        return { sent: false, reason: "not_configured" };
    }

    try {
        const info = await transport.sendMail({
            from: {
                name: "E Top",
                address: process.env.EMAIL_FROM || process.env.EMAIL_USER
            },
            to,
            subject,
            html: createEmailHtml({
                name,
                code,
                title,
                description,
                warning
            }),
            text: `E Top\n\nHi ${name || "there"},\n${description}\nYour code: ${code}\nThis code expires in 10 minutes. ${warning}`
        });

        console.log("E Top email sent:", info.messageId);
        return { sent: true };
    } catch (error) {
        console.error("SEND E TOP EMAIL ERROR:", error);
        return { sent: false, reason: "send_failed", error };
    }
}
