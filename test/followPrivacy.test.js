const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const User = require("../models/User");
const userController = require("../controllers/userController");

const OWNER_ID = "507f1f77bcf86cd799439011";
const FOLLOWER_ID = "507f191e810c19729de860ea";
const BLOCKED_ID = "507f191e810c19729de860eb";

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

const makeSession = () => ({
    async withTransaction(callback) {
        return callback();
    },
    async endSession() {}
});

const setupUsers = initialUsers => {
    const users = new Map(
        initialUsers.map(user => [String(user._id), structuredClone(user)])
    );
    const original = {
        startSession: mongoose.startSession,
        findById: User.findById,
        updateOne: User.updateOne,
        countDocuments: User.countDocuments,
        findOne: User.findOne
    };

    mongoose.startSession = async () => makeSession();
    User.findById = id => {
        const query = {
            select() { return this; },
            session() { return this; },
            async lean() { return users.get(String(id)) || null; }
        };
        return query;
    };
    User.findOne = filter => {
        const query = {
            select() { return this; },
            session() { return this; },
            async lean() {
                const user = users.get(String(filter._id));
                const hasPending = (user?.pendingFollowRequests || []).some(
                    request => String(request.user) === String(filter["pendingFollowRequests.user"])
                );
                return user && hasPending ? user : null;
            }
        };
        return query;
    };
    User.updateOne = async (filter, update) => {
        const user = users.get(String(filter._id));
        if (!user) return { matchedCount: 0 };

        if (update.$set) Object.assign(user, update.$set);
        if (update.$addToSet?.following) {
            const id = String(update.$addToSet.following);
            user.following ||= [];
            if (!user.following.some(existing => String(existing) === id)) {
                user.following.push(id);
            }
        }
        if (update.$pull?.following) {
            user.following = (user.following || []).filter(
                existing => String(existing) !== String(update.$pull.following)
            );
        }
        if (update.$push?.pendingFollowRequests) {
            user.pendingFollowRequests ||= [];
            user.pendingFollowRequests.push(update.$push.pendingFollowRequests);
        }
        if (update.$pull?.pendingFollowRequests) {
            const requesterId = String(update.$pull.pendingFollowRequests.user);
            user.pendingFollowRequests = (user.pendingFollowRequests || []).filter(
                request => String(request.user) !== requesterId
            );
        }
        return { matchedCount: 1 };
    };
    User.countDocuments = filter => ({
        async session() {
            return [...users.values()].filter(user =>
                (user.following || []).some(id => String(id) === String(filter.following))
            ).length;
        }
    });

    return {
        users,
        restore() {
            mongoose.startSession = original.startSession;
            User.findById = original.findById;
            User.updateOne = original.updateOne;
            User.countDocuments = original.countDocuments;
            User.findOne = original.findOne;
        }
    };
};

test("legacy accounts default to Public and existing follows stay in the approved relationship", () => {
    assert.equal(User.schema.path("accountVisibility").defaultValue, "public");
    const legacyUser = new User({
        name: "Legacy",
        email: "legacy@example.test",
        password: "password",
        following: [FOLLOWER_ID]
    });

    assert.equal(legacyUser.accountVisibility, "public");
    assert.deepEqual(legacyUser.following.map(String), [FOLLOWER_ID]);
});

test("settings expose Public for legacy accounts and allow only valid visibility values", async () => {
    const originalFindById = User.findById;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    let update;
    User.findById = () => ({
        select() {
            return this;
        },
        async lean() {
            return { theme: "dark", notificationPreferences: {} };
        }
    });
    User.findByIdAndUpdate = (_id, changes) => {
        update = changes;
        return {
            select() { return this; },
            async lean() {
                return { theme: "dark", accountVisibility: "private" };
            }
        };
    };

    try {
        const readResponse = makeResponse();
        await userController.getSettings({ user: { id: OWNER_ID } }, readResponse);
        assert.equal(readResponse.body.settings.accountVisibility, "public");

        const writeResponse = makeResponse();
        await userController.updateSettings(
            {
                user: { id: OWNER_ID },
                body: { accountVisibility: "private" }
            },
            writeResponse
        );
        assert.deepEqual(update, { $set: { accountVisibility: "private" } });
        assert.equal(writeResponse.body.settings.accountVisibility, "private");

        const invalidResponse = makeResponse();
        await userController.updateSettings(
            {
                user: { id: OWNER_ID },
                body: { accountVisibility: "followers-only" }
            },
            invalidResponse
        );
        assert.equal(invalidResponse.statusCode, 400);
    } finally {
        User.findById = originalFindById;
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("following a Private account creates a pending request, not an approved follow", async () => {
    const state = setupUsers([
        {
            _id: OWNER_ID,
            accountVisibility: "private",
            pendingFollowRequests: [],
            following: [],
            blockedUsers: []
        },
        {
            _id: FOLLOWER_ID,
            accountVisibility: "public",
            pendingFollowRequests: [],
            following: [],
            blockedUsers: []
        }
    ]);

    try {
        const response = makeResponse();
        await userController.toggleFollow(
            { params: { id: OWNER_ID }, user: { id: FOLLOWER_ID } },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.action, "request-sent");
        assert.equal(response.body.isFollowRequestPending, true);
        assert.deepEqual(state.users.get(FOLLOWER_ID).following, []);
        assert.equal(
            String(state.users.get(OWNER_ID).pendingFollowRequests[0].user),
            FOLLOWER_ID
        );
    } finally {
        state.restore();
    }
});

test("a Private account owner can approve a pending follower request", async () => {
    const state = setupUsers([
        {
            _id: OWNER_ID,
            accountVisibility: "private",
            pendingFollowRequests: [{ user: FOLLOWER_ID, createdAt: new Date() }],
            following: [],
            blockedUsers: []
        },
        {
            _id: FOLLOWER_ID,
            accountVisibility: "public",
            pendingFollowRequests: [],
            following: [],
            blockedUsers: []
        }
    ]);

    try {
        const response = makeResponse();
        await userController.respondToFollowRequest(
            {
                params: { id: FOLLOWER_ID },
                user: { id: OWNER_ID },
                body: { action: "accept" }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.action, "accepted");
        assert.deepEqual(state.users.get(OWNER_ID).pendingFollowRequests, []);
        assert.deepEqual(state.users.get(FOLLOWER_ID).following, [OWNER_ID]);
    } finally {
        state.restore();
    }
});

test("blocked users cannot create private follow requests", async () => {
    const state = setupUsers([
        {
            _id: OWNER_ID,
            accountVisibility: "private",
            pendingFollowRequests: [],
            following: [],
            blockedUsers: [FOLLOWER_ID]
        },
        {
            _id: FOLLOWER_ID,
            accountVisibility: "public",
            pendingFollowRequests: [],
            following: [],
            blockedUsers: []
        }
    ]);

    try {
        const response = makeResponse();
        await userController.toggleFollow(
            { params: { id: OWNER_ID }, user: { id: FOLLOWER_ID } },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.deepEqual(state.users.get(OWNER_ID).pendingFollowRequests, []);
    } finally {
        state.restore();
    }
});
