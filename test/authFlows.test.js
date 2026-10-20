const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const DeviceSession = require("../models/DeviceSession");
const emailService = require("../services/emailService");
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");

const USER_ID = "507f1f77bcf86cd799439011";
const ORIGINALS = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    updateOne: User.updateOne,
    create: User.create,
    findById: User.findById,
    findOneAndUpdateSession: DeviceSession.findOneAndUpdate,
    deleteMany: DeviceSession.deleteMany,
    isEmailConfigured: emailService.isEmailConfigured,
    sendVerificationEmail: emailService.sendVerificationEmail,
    sendPasswordResetEmail: emailService.sendPasswordResetEmail
};

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

const queryResult = value => ({
    select: async () => value
});

test.beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-for-auth-flows";
    emailService.isEmailConfigured = () => true;
    emailService.sendVerificationEmail = async () => ({ sent: true });
    emailService.sendPasswordResetEmail = async () => ({ sent: true });
});

test.afterEach(() => {
    Object.assign(User, {
        findOne: ORIGINALS.findOne,
        findOneAndUpdate: ORIGINALS.findOneAndUpdate,
        updateOne: ORIGINALS.updateOne,
        create: ORIGINALS.create,
        findById: ORIGINALS.findById
    });
    DeviceSession.deleteMany = ORIGINALS.deleteMany;
    DeviceSession.findOneAndUpdate = ORIGINALS.findOneAndUpdateSession;
    emailService.isEmailConfigured = ORIGINALS.isEmailConfigured;
    emailService.sendVerificationEmail = ORIGINALS.sendVerificationEmail;
    emailService.sendPasswordResetEmail = ORIGINALS.sendPasswordResetEmail;
    auth.invalidate(USER_ID);
});

test("registration creates a social account and requires email verification", async () => {
    let created;
    let sent;
    User.findOne = async () => null;
    User.create = async fields => {
        created = fields;
        return { ...fields, _id: USER_ID };
    };
    emailService.sendVerificationEmail = async email => {
        sent = email;
        return { sent: true };
    };

    const response = makeResponse();
    await authController.register(
        {
            body: {
                name: "  E Top User ",
                email: "USER@example.com",
                password: "correct horse battery",
                role: "seller"
            }
        },
        response
    );

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.verificationRequired, true);
    assert.equal(response.body.token, undefined);
    assert.equal(created.email, "user@example.com");
    assert.equal(created.emailVerified, false);
    assert.equal(created.role, "customer");
    assert.match(sent.code, /^\d{6}$/);
    assert.notEqual(created.emailVerificationCodeHash, sent.code);
});

test("registration fails explicitly when email delivery is not configured", async () => {
    emailService.isEmailConfigured = () => false;
    User.create = async () => {
        throw new Error("No account should be created.");
    };

    const response = makeResponse();
    await authController.register(
        {
            body: {
                name: "User",
                email: "user@example.com",
                password: "correct horse battery"
            }
        },
        response
    );

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "EMAIL_NOT_CONFIGURED");
});

test("login refuses a valid password until the mailbox is verified", async () => {
    User.findOne = () => queryResult({
        _id: USER_ID,
        email: "user@example.com",
        password: awaitHash,
        emailVerified: false,
        isSuspended: false
    });
    const response = makeResponse();
    await authController.login(
        {
            body: {
                email: "user@example.com",
                password: "correct horse battery"
            }
        },
        response
    );

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(response.body.token, undefined);
});

test("legacy accounts without verification state can still log in", async () => {
    User.findOne = () => queryResult({
        _id: USER_ID,
        email: "user@example.com",
        password: awaitHash,
        isSuspended: false
    });
    DeviceSession.findOneAndUpdate = async () => ({});

    const response = makeResponse();
    await authController.login(
        {
            body: {
                email: "user@example.com",
                password: "correct horse battery"
            }
        },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.token);
    assert.equal(response.body.user.emailVerified, false);
});

const awaitHash = bcrypt.hashSync("correct horse battery", 4);

test("email verification consumes the code and marks the account verified", async () => {
    let filter;
    let update;
    User.findOneAndUpdate = (conditions, change) => {
        filter = conditions;
        update = change;
        return {
            select: async () => ({ _id: USER_ID })
        };
    };

    const response = makeResponse();
    await authController.verifyEmail(
        {
            body: {
                email: "USER@example.com",
                code: "123456"
            }
        },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(filter.email, "user@example.com");
    assert.equal(filter.emailVerified, false);
    assert.match(filter.emailVerificationCodeHash, /^[a-f\d]{64}$/);
    assert.equal(update.$set.emailVerified, true);
    assert.equal("emailVerificationCodeHash" in update.$unset, true);
});

test("invalid email verification codes consume a bounded attempt", async () => {
    let increments = 0;
    User.findOneAndUpdate = () => queryResult(null);
    User.updateOne = async (filter, update) => {
        assert.equal(update.$inc.emailVerificationAttempts, 1);
        increments += 1;
    };
    User.findOne = () => queryResult(null);

    const response = makeResponse();
    await authController.verifyEmail(
        {
            body: {
                email: "user@example.com",
                code: "000000"
            }
        },
        response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(increments, 1);
});

test("legacy accounts without verification state retain protected access", async () => {
    auth.invalidate(USER_ID);
    User.findById = () => ({
        select: () => ({
            lean: async () => ({
                role: "customer",
                isSuspended: false,
                emailVerified: undefined
            })
        })
    });
    const response = makeResponse();
    let nextCalled = false;
    const request = {
        header: () =>
            `Bearer ${jwt.sign({ id: USER_ID }, process.env.JWT_SECRET)}`
    };

    await auth()(request, response, () => {
        nextCalled = true;
    });

    assert.equal(response.statusCode, 200);
    assert.equal(nextCalled, true);
    assert.equal(request.user.role, "customer");
});

test("password reset emails a code and exchanges it for a one-time token", async () => {
    let storedCodeHash;
    let emailedCode;
    let issuedSession;
    User.findOne = filter => {
        if (filter.resetPasswordToken) {
            return queryResult(
                filter.resetPasswordToken === storedCodeHash
                    ? { _id: USER_ID }
                    : null
            );
        }
        if (filter.email) {
            return queryResult({
                _id: USER_ID,
                email: "user@example.com",
                name: "E Top User"
            });
        }
        return queryResult(null);
    };
    User.updateOne = async (filter, update) => {
        if (update.$set?.resetPasswordToken) {
            storedCodeHash = update.$set.resetPasswordToken;
        }
    };
    emailService.sendPasswordResetEmail = async email => {
        emailedCode = email.code;
        return { sent: true };
    };
    User.findOneAndUpdate = (filter, update) => {
        issuedSession = { filter, update };
        return queryResult({ _id: USER_ID });
    };

    const sendResponse = makeResponse();
    await authController.forgotPassword(
        { body: { email: "USER@example.com" } },
        sendResponse
    );
    assert.equal(sendResponse.statusCode, 200);
    assert.match(emailedCode, /^\d{6}$/);
    assert.match(storedCodeHash, /^[a-f\d]{64}$/);
    assert.notEqual(storedCodeHash, emailedCode);

    const verifyResponse = makeResponse();
    await authController.verifyResetCode(
        {
            body: {
                email: "user@example.com",
                code: emailedCode
            }
        },
        verifyResponse
    );

    assert.equal(verifyResponse.statusCode, 200);
    assert.match(verifyResponse.body.resetToken, /^[a-f\d]{64}$/);
    assert.notEqual(
        issuedSession.update.$set.resetSessionTokenHash,
        verifyResponse.body.resetToken
    );
    assert.equal(issuedSession.filter.resetPasswordToken, storedCodeHash);
});

test("password reset consumes a one-time token and revokes linked devices", async () => {
    const resetToken = "a".repeat(64);
    let sessionRevoked = false;
    let savedChange;
    User.findOne = () => queryResult({ _id: USER_ID });
    DeviceSession.deleteMany = async filter => {
        assert.equal(String(filter.user), USER_ID);
        sessionRevoked = true;
    };
    User.findOneAndUpdate = (filter, update) => {
        savedChange = { filter, update };
        return {
            select: async () => ({ _id: USER_ID })
        };
    };

    const response = makeResponse();
    await authController.resetPassword(
        {
            body: {
                resetToken,
                password: "new secure password"
            }
        },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(sessionRevoked, true);
    assert.equal(savedChange.filter._id, USER_ID);
    assert.ok(savedChange.filter.resetSessionTokenHash);
    assert.equal(savedChange.update.$set.emailVerified, true);
    assert.equal(savedChange.update.$unset.resetSessionTokenHash, "");
    assert.notEqual(
        savedChange.update.$set.password,
        "new secure password"
    );
});
