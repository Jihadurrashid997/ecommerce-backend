const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const MessageRequest = require("../models/MessageRequest");
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

test("messenger preferences persist only account-scoped pin, archive, and mute flags", async () => {
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
                    messengerPreferences: {
                        "507f191e810c19729de860ea": {
                            pinned: true,
                            archived: false,
                            muted: true
                        }
                    }
                };
            }
        };
    };

    try {
        const response = makeResponse();
        await userController.updateMessengerPreference(
            {
                user: { id: USER_ID },
                params: { conversationId: "507f191e810c19729de860ea" },
                body: { pinned: true, muted: true }
            },
            response
        );

        assert.deepEqual(update, {
            $set: {
                "messengerPreferences.507f191e810c19729de860ea.pinned": true,
                "messengerPreferences.507f191e810c19729de860ea.muted": true
            }
        });
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body.preference, {
            pinned: true,
            archived: false,
            muted: true
        });
    } finally {
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("messenger preference updates reject unknown keys and non-boolean values", async () => {
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    User.findByIdAndUpdate = () => {
        throw new Error("Invalid preference must not reach the database.");
    };

    try {
        const response = makeResponse();
        await userController.updateMessengerPreference(
            {
                user: { id: USER_ID },
                params: { conversationId: "507f191e810c19729de860ea" },
                body: { onlineStatus: false }
            },
            response
        );
        assert.equal(response.statusCode, 400);
    } finally {
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("blocking a user removes pending Message Requests in both directions", async () => {
    const originals = {
        userFindByIdAndUpdate: User.findByIdAndUpdate,
        requestFind: MessageRequest.find,
        requestFindOneAndUpdate: MessageRequest.findOneAndUpdate
    };
    const requestId = "507f191e810c19729de860eb";
    let requestFilter;
    let requestUpdate;
    User.findByIdAndUpdate = async () => ({});
    MessageRequest.find = filter => {
        assert.deepEqual(filter, {
            status: "pending",
            $or: [
                { sender: USER_ID, recipient: "507f191e810c19729de860ea" },
                { sender: "507f191e810c19729de860ea", recipient: USER_ID }
            ]
        });
        return {
            select() {
                return this;
            },
            lean: async () => [{ _id: requestId }]
        };
    };
    MessageRequest.findOneAndUpdate = (filter, update) => {
        requestFilter = filter;
        requestUpdate = update;
        return { lean: async () => ({ _id: requestId }) };
    };

    try {
        const response = makeResponse();
        await userController.blockUser(
            {
                user: { id: USER_ID },
                params: { id: "507f191e810c19729de860ea" },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(requestFilter, {
            _id: requestId,
            status: "pending"
        });
        assert.equal(requestUpdate.$set.status, "blocked");
        assert.equal(requestUpdate.$unset.message, "");
        assert.equal(requestUpdate.$unset.fileUrl, "");
    } finally {
        User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
        MessageRequest.find = originals.requestFind;
        MessageRequest.findOneAndUpdate = originals.requestFindOneAndUpdate;
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
