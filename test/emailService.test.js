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
    "EMAIL_LOGO_URL",
    "FRONTEND_URL",
    "CLIENT_URL"
];
const originalEnvironment = Object.fromEntries(
    environmentKeys.map(key => [key, process.env[key]])
);
const originalCreateTransport = nodemailer.createTransport;

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
    environmentKeys.forEach(key => {
        if (originalEnvironment[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnvironment[key];
        }
    });
});

test("sends password reset emails with the E Top logo embedded", async () => {
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

    assert.deepEqual(result, { sent: true });
    assert.equal(transportOptions.host, "smtp.example.test");
    assert.equal(sentMessage.from.name, "E Top");
    assert.match(sentMessage.html, /src="cid:etop-logo"/);
    assert.equal(sentMessage.attachments[0].cid, "etop-logo");
    assert.equal(sentMessage.attachments[0].path, logoPath);
    assert.equal(fs.existsSync(logoPath), true);
});
