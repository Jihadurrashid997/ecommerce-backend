const assert = require("node:assert/strict");
const test = require("node:test");
const User = require("../models/User");
const Message = require("../models/Message");
const userController = require("../controllers/userController");

const CURRENT_USER = "507f1f77bcf86cd799439011";
const PUBLIC_USER = "507f191e810c19729de860ea";
const PRIVATE_USER = "507f191e810c19729de860eb";
const SEARCH_TIME = new Date("2026-01-01T00:00:00.000Z");

const query = value => ({
    select() {
        return this;
    },
    limit() {
        return this;
    },
    sort() {
        return this;
    },
    skip() {
        return this;
    },
    lean: async () => value
});

test("chat-user search discovers matching Public accounts without exposing unapproved Private accounts", async () => {
    const originals = {
        userFindById: User.findById,
        userFind: User.find,
        messageDistinct: Message.distinct
    };
    const searchFilters = [];
    User.findById = () => query({
        _id: CURRENT_USER,
        following: [],
        blockedUsers: []
    });
    User.find = filter => {
        if (filter.accountVisibility?.$ne === "private") {
            searchFilters.push(filter);
            return query([
                {
                    _id: PUBLIC_USER,
                    accountVisibility: "public",
                    following: []
                }
            ]);
        }
        if (filter.accountVisibility === "private") {
            searchFilters.push(filter);
            return query([
                {
                    _id: PRIVATE_USER,
                    accountVisibility: "private",
                    following: []
                }
            ]);
        }

        const ids = filter._id?.$in || [];
        return query([
            ...(ids.includes(PUBLIC_USER)
                ? [{
                      _id: PUBLIC_USER,
                      name: "Jordan",
                      accountVisibility: "public",
                      following: [],
                      blockedUsers: [],
                      lastSeen: SEARCH_TIME
                  }]
                : []),
            ...(ids.includes(PRIVATE_USER)
                ? [{
                      _id: PRIVATE_USER,
                      name: "Jordan Private",
                      accountVisibility: "private",
                      following: [],
                      blockedUsers: [],
                      lastSeen: SEARCH_TIME
                  }]
                : [])
        ]);
    };
    Message.distinct = async () => [];

    try {
        const response = {
            body: null,
            json(body) {
                this.body = body;
                return this;
            }
        };
        await userController.getChatUsers(
            {
                user: { id: CURRENT_USER },
                query: { q: "jor" }
            },
            response
        );

        assert.equal(response.body.success, true);
        assert.deepEqual(
            new Set(response.body.users.map(user => user._id)),
            new Set([PUBLIC_USER, PRIVATE_USER])
        );
        assert.equal(response.body.users[0].canStartConversation, true);
        const privateResult = response.body.users.find(
            user => user._id === PRIVATE_USER
        );
        assert.equal(privateResult.requiresMessageRequest, true);
        assert.equal(privateResult.canStartConversation, false);
        assert.equal(Object.hasOwn(privateResult, "lastSeen"), false);
        assert.equal(
            searchFilters.every(filter =>
                filter.$or[0].name.source === "jor"
            ),
            true
        );
    } finally {
        User.findById = originals.userFindById;
        User.find = originals.userFind;
        Message.distinct = originals.messageDistinct;
    }
});
