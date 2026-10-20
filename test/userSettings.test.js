const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const userController = require("../controllers/userController");

const USER_ID = "507f1f77bcf86cd799439011";

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

test("user settings update only accepted theme and notification preference fields", async () => {
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    let update;
    User.findByIdAndUpdate = (id, changes) => {
        assert.equal(id, USER_ID);
        update = changes;
        return {
            select() {
                return this;
            },
            async lean() {
                return {
                    theme: "light",
                    notificationPreferences: {
                        follows: true,
                        posts: false,
                        communities: true,
                        announcements: true
                    }
                };
            }
        };
    };

    try {
        const response = makeResponse();
        await userController.updateSettings(
            {
                user: { id: USER_ID },
                body: {
                    theme: "light",
                    notifications: { posts: false }
                }
            },
            response
        );

        assert.deepEqual(update, {
            $set: {
                theme: "light",
                "notificationPreferences.posts": false
            }
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.settings.notifications.posts, false);
    } finally {
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("user settings reject unsupported notification preference keys", async () => {
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    User.findByIdAndUpdate = () => {
        throw new Error("Invalid settings must not reach the database.");
    };

    try {
        const response = makeResponse();
        await userController.updateSettings(
            {
                user: { id: USER_ID },
                body: { notifications: { shop: false } }
            },
            response
        );
        assert.equal(response.statusCode, 400);
    } finally {
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("password changes verify the current password and hash the replacement", async () => {
    const originalFindById = User.findById;
    const passwordHash = await bcrypt.hash("current-pass-123", 4);
    let saved = false;
    const user = {
        password: passwordHash,
        async save() {
            saved = true;
        }
    };
    User.findById = () => ({
        select() {
            return Promise.resolve(user);
        }
    });

    try {
        const response = makeResponse();
        await userController.changePassword(
            {
                user: { id: USER_ID },
                body: {
                    currentPassword: "current-pass-123",
                    newPassword: "replacement-pass-123"
                }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(saved, true);
        assert.equal(await bcrypt.compare("replacement-pass-123", user.password), true);
    } finally {
        User.findById = originalFindById;
    }
});

test("password changes reject an incorrect current password", async () => {
    const originalFindById = User.findById;
    let saved = false;
    const user = {
        password: await bcrypt.hash("current-pass-123", 4),
        async save() {
            saved = true;
        }
    };
    User.findById = () => ({
        select() {
            return Promise.resolve(user);
        }
    });

    try {
        const response = makeResponse();
        await userController.changePassword(
            {
                user: { id: USER_ID },
                body: {
                    currentPassword: "wrong-password",
                    newPassword: "replacement-pass-123"
                }
            },
            response
        );
        assert.equal(response.statusCode, 400);
        assert.equal(saved, false);
    } finally {
        User.findById = originalFindById;
    }
});
