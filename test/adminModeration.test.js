const assert = require("node:assert/strict");
const test = require("node:test");
const User = require("../models/User");
const Post = require("../models/Post");
const ContentReport = require("../models/ContentReport");
const AdminAuditLog = require("../models/AdminAuditLog");
const moderation = require("../controllers/adminModerationController");
const { requirePermission } = require("../middleware/adminPermissions");

const ADMIN_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f191e810c19729de860ea";
const POST_ID = "507f191e810c19729de860eb";

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

test("authenticated users can report a profile with a reason", async () => {
    const originalFindById = User.findById;
    const originalCreate = ContentReport.create;
    let report;
    User.findById = () => ({ select: async () => ({ _id: USER_ID }) });
    ContentReport.create = async fields => { report = fields; };

    try {
        const response = makeResponse();
        await moderation.createReport({
            body: { targetType: "profile", targetId: USER_ID, reason: "Impersonation" },
            user: { id: ADMIN_ID }
        }, response);
        assert.equal(response.statusCode, 201);
        assert.equal(report.reporter, ADMIN_ID);
        assert.equal(report.targetOwner, USER_ID);
        assert.equal(report.reason, "Impersonation");
    } finally {
        User.findById = originalFindById;
        ContentReport.create = originalCreate;
    }
});

test("users cannot report their own profile or submit an empty reason", async () => {
    const originalFindById = User.findById;
    User.findById = () => ({ select: async () => ({ _id: ADMIN_ID }) });

    try {
        const ownReport = makeResponse();
        await moderation.createReport({
            body: { targetType: "profile", targetId: ADMIN_ID, reason: "test" },
            user: { id: ADMIN_ID }
        }, ownReport);
        assert.equal(ownReport.statusCode, 400);

        const emptyReason = makeResponse();
        await moderation.createReport({
            body: { targetType: "profile", targetId: USER_ID, reason: " " },
            user: { id: ADMIN_ID }
        }, emptyReason);
        assert.equal(emptyReason.statusCode, 400);
    } finally {
        User.findById = originalFindById;
    }
});

test("admin content moderation hides, deletes, and restores a post with audit entries", async () => {
    const originalFindById = Post.findById;
    const originalAuditCreate = AdminAuditLog.create;
    const post = {
        _id: POST_ID,
        kind: "post",
        media: [],
        save: async () => {}
    };
    const logs = [];
    Post.findById = () => ({ select: async () => post });
    AdminAuditLog.create = async entry => logs.push(entry);

    try {
        const hidden = makeResponse();
        await moderation.moderateContent({
            params: { id: POST_ID },
            body: { action: "hide", reason: "Policy violation" },
            user: { id: ADMIN_ID, adminRole: "moderator" }
        }, hidden);
        assert.equal(post.moderationStatus, "hidden");
        assert.equal(hidden.body.moderationStatus, "hidden");

        const restored = makeResponse();
        await moderation.moderateContent({
            params: { id: POST_ID },
            body: { action: "restore" },
            user: { id: ADMIN_ID, adminRole: "moderator" }
        }, restored);
        assert.equal(post.moderationStatus, "visible");
        assert.equal(logs.length, 2);
    } finally {
        Post.findById = originalFindById;
        AdminAuditLog.create = originalAuditCreate;
    }
});

test("moderators cannot use super-admin-only permissions", () => {
    const request = { user: { adminRole: "moderator" } };
    const response = makeResponse();
    let continued = false;
    requirePermission("user_moderate")(request, response, () => { continued = true; });
    assert.equal(response.statusCode, 403);
    assert.equal(continued, false);
});
