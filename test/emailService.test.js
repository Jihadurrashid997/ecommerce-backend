const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, test } = require("node:test");
const nodemailer = require("nodemailer");

const environmentKeys = [
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_SECURE",
    "EMAIL_USER",
    "EMAIL_PASS",
    "EMAIL_FROM",
    "GMAIL_RELAY_URL",
    "GMAIL_RELAY_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM",
    "EMAIL_LOGO_URL",
    "FRONTEND_URL",
    "CLIENT_URL"
];
const originalEnvironment = Object.fromEntries(
    environmentKeys.map(key => [key, process.env[key]])
);
const originalCreateTransport = nodemailer.createTransport;
const originalFetch = global.fetch;

let sentMessage;
let transportOptions;

nodemailer.createTransport = options => {
    transportOptions = options;
    return {
        sendMail: async message => {
            sentMessage = message;
            return { messageId: "test-message" };
        }
    };
};

const emailService = require("../services/emailService");

after(() => {
    nodemailer.createTransport = originalCreateTransport;
    global.fetch = originalFetch;
    environmentKeys.forEach(key => {
        if (originalEnvironment[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnvironment[key];
        }
    });
});

test("sends password reset emails with E Top and JR Group logos embedded", async () => {
    delete process.env.GMAIL_RELAY_URL;
    delete process.env.GMAIL_RELAY_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    process.env.EMAIL_HOST = "smtp.example.test";
    process.env.EMAIL_PORT = "587";
    process.env.EMAIL_SECURE = "false";
    process.env.EMAIL_USER = "sender@example.test";
    process.env.EMAIL_PASS = "test-password";
    process.env.EMAIL_FROM = "no-reply@example.test";
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_URL;

    const result = await emailService.sendPasswordResetEmail({
        to: "customer@example.test",
        name: "Customer",
        code: "123456"
    });

    const logoPath = path.resolve(
        __dirname,
        "../frontend/public/brand/etop-loading-logo.png"
    );
    const jrGroupLogoPath = path.resolve(
        __dirname,
        "../frontend/public/brand/jr-group-logo-hd.png"
    );

    assert.deepEqual(result, { sent: true });
    assert.equal(transportOptions.host, "smtp.example.test");
    assert.equal(sentMessage.from.name, "E Top");
    assert.match(sentMessage.html, /src="cid:etop-logo"/);
    assert.equal(sentMessage.attachments[0].cid, "etop-logo");
    assert.equal(sentMessage.attachments[0].path, logoPath);
    assert.match(sentMessage.html, /src="cid:jr-group-logo"/);
    assert.match(sentMessage.html, /JR Group of Company/);
    assert.match(sentMessage.text, /A JR Group of Company/);
    assert.equal(sentMessage.attachments[1].cid, "jr-group-logo");
    assert.equal(sentMessage.attachments[1].path, jrGroupLogoPath);
    assert.equal(fs.existsSync(logoPath), true);
    assert.equal(fs.existsSync(jrGroupLogoPath), true);
});

test("sends branded password reset emails through the Gmail HTTPS relay", async () => {
    process.env.GMAIL_RELAY_URL = "https://script.google.test/macros/s/test/exec";
    process.env.GMAIL_RELAY_SECRET = "test-relay-secret";
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_URL;
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ success: true })
        };
    };

    const result = await emailService.sendPasswordResetEmail({
        to: "customer@example.test",
        name: "Customer",
        code: "123456"
    });

    const payload = JSON.parse(request.options.body);
    assert.deepEqual(result, { sent: true });
    assert.equal(request.url, process.env.GMAIL_RELAY_URL);
    assert.equal(payload.secret, "test-relay-secret");
    assert.equal(payload.to, "customer@example.test");
    assert.match(payload.html, /src="cid:etop-logo"/);
    assert.match(payload.html, /src="cid:jr-group-logo"/);
    assert.deepEqual(
        payload.attachments.map(attachment => attachment.content_id),
        ["etop-logo", "jr-group-logo"]
    );
});

test("sends branded password reset emails through the Resend HTTPS API", async () => {
    delete process.env.GMAIL_RELAY_URL;
    delete process.env.GMAIL_RELAY_SECRET;
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "passwords@example.test";
    delete process.env.EMAIL_LOGO_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_URL;
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ id: "resend-message" })
        };
    };

    const result = await emailService.sendPasswordResetEmail({
        to: "customer@example.test",
        name: "Customer",
        code: "123456"
    });

    const payload = JSON.parse(request.options.body);
    assert.deepEqual(result, { sent: true });
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.options.headers.Authorization, "Bearer re_test_key");
    assert.equal(payload.from, "E Top <passwords@example.test>");
    assert.deepEqual(payload.to, ["customer@example.test"]);
    assert.match(payload.html, /src="cid:etop-logo"/);
    assert.match(payload.html, /src="cid:jr-group-logo"/);
    assert.equal(payload.attachments[0].content_id, "etop-logo");
    assert.equal(payload.attachments[1].content_id, "jr-group-logo");
    assert.equal(
        Buffer.from(payload.attachments[1].content, "base64").subarray(0, 8).toString("hex"),
        "89504e470d0a1a0a"
    );
});
