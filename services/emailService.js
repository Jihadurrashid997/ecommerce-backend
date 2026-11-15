const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

let transporter = null;
const EMAIL_LOGO_CID = "etop-logo";
const JR_GROUP_LOGO_CID = "jr-group-logo";
const localLogoPath = path.resolve(
    __dirname,
    "../frontend/public/brand/etop-loading-logo.png"
);
const jrGroupLogoPath = path.resolve(
    __dirname,
    "../frontend/public/brand/jr-group-logo-hd.png"
);

const isResendConfigured = () =>
    Boolean(
        process.env.RESEND_API_KEY &&
        (process.env.RESEND_FROM || process.env.EMAIL_FROM)
    );

const isGmailRelayConfigured = () =>
    Boolean(
        process.env.GMAIL_RELAY_URL &&
        process.env.GMAIL_RELAY_SECRET
    );

const isEmailConfigured = () =>
    isGmailRelayConfigured() ||
    isResendConfigured() ||
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
    if (fs.existsSync(localLogoPath)) {
        return `cid:${EMAIL_LOGO_CID}`;
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
    warning,
    logoUrl = getLogoUrl()
}) => {
    const brand = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="E Top" width="150" style="display:block;max-width:150px;height:auto;margin:0 auto 12px;">`
        : `<div style="margin-bottom:24px;color:#2563eb;font-size:30px;font-weight:800;">E Top</div>`;
    const jrGroupBrand = `<img src="cid:${JR_GROUP_LOGO_CID}" alt="JR Group of Company" width="135" style="display:block;max-width:135px;height:auto;margin:0 auto 24px;">`;

    return `
        <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
            <div style="max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e5eaf2;border-radius:16px;text-align:center;">
                ${brand}
                ${jrGroupBrand}
                <h1 style="margin:0 0 16px;color:#172554;font-size:24px;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 16px;text-align:left;">Hi ${escapeHtml(name || "there")},</p>
                <p style="margin:0 0 24px;text-align:left;">${escapeHtml(description)}</p>
                <div style="margin:28px 0;padding:18px;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-size:32px;font-weight:800;letter-spacing:8px;">${escapeHtml(code)}</div>
                <p style="margin:0;text-align:left;color:#64748b;font-size:13px;">This code expires in 10 minutes. ${escapeHtml(warning)}</p>
            </div>
            <p style="margin:16px auto 0;max-width:480px;text-align:center;color:#94a3b8;font-size:12px;">E Top · A JR Group of Company</p>
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
    if (!isEmailConfigured()) {
        return { sent: false, reason: "not_configured" };
    }

    try {
        const logoUrl = getLogoUrl();
        const html = createEmailHtml({
            name,
            code,
            title,
            description,
            warning,
            logoUrl
        });
        const text =
            `E Top · A JR Group of Company\n\nHi ${name || "there"},\n${description}\nYour code: ${code}\nThis code expires in 10 minutes. ${warning}`;
        const attachments = [
                ...(logoUrl === `cid:${EMAIL_LOGO_CID}`
                    ? [{
                        filename: "etop-loading-logo.png",
                        path: localLogoPath,
                        cid: EMAIL_LOGO_CID,
                        contentDisposition: "inline"
                    }]
                    : []),
                {
                    filename: "jr-group-logo-hd.png",
                    path: jrGroupLogoPath,
                    cid: JR_GROUP_LOGO_CID,
                    contentDisposition: "inline"
                }
            ];

        if (isGmailRelayConfigured()) {
            const relayAttachments = attachments.map(attachment => ({
                filename: attachment.filename,
                content: fs.readFileSync(attachment.path).toString("base64"),
                content_id: attachment.cid
            }));
            const response = await fetch(process.env.GMAIL_RELAY_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    secret: process.env.GMAIL_RELAY_SECRET,
                    to,
                    subject,
                    html,
                    text,
                    attachments: relayAttachments
                }),
                signal: AbortSignal.timeout(20000)
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    `Gmail email relay failed (${response.status}): ${result.message || "Unknown error"}`
                );
            }

            console.log("E Top email sent:", result.id || "via Gmail relay");
            return { sent: true };
        }

        if (isResendConfigured()) {
            const resendAttachments = attachments.map(attachment => ({
                filename: attachment.filename,
                content: fs.readFileSync(attachment.path).toString("base64"),
                content_id: attachment.cid
            }));
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: `E Top <${process.env.RESEND_FROM || process.env.EMAIL_FROM}>`,
                    to: [to],
                    subject,
                    html,
                    text,
                    attachments: resendAttachments
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `Resend API request failed (${response.status}): ${errorBody}`
                );
            }

            const result = await response.json();
            console.log("E Top email sent:", result.id);
            return { sent: true };
        }

        const transport = getTransporter();
        if (!transport) {
            return { sent: false, reason: "not_configured" };
        }

        const info = await transport.sendMail({
            from: {
                name: "E Top",
                address: process.env.EMAIL_FROM || process.env.EMAIL_USER
            },
            to,
            subject,
            html,
            attachments,
            text
        });

        console.log("E Top email sent:", info.messageId);
        return { sent: true };
    } catch (error) {
        console.error("SEND E TOP EMAIL ERROR:", error);
        return { sent: false, reason: "send_failed", error };
    }
}
