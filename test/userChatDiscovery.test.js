const assert = require("node:assert/strict");
const test = require("node:test");
const User = require("../models/User");
const Message = require("../models/Message");
const userController = require("../controllers/userController");

const CURRENT_USER = "507f1f77bcf86cd799439011";
const PUBLIC_USER = "507f191e810c19729de860ea";
const PRIVATE_USER = "507f191e810c19729de860eb";
const SEARCH_TIME = new Date("2026-01-01T00:00:00.000Z");

const query = value => {
    let skip = 0;
    let limit = Infinity;
    return {
        select() {
            return this;
        },
        limit(count) {
            limit = count;
            return this;
        },
        sort() {
            return this;
        },
        skip(count) {
            skip = count;
            return this;
        },
        lean: async () => Array.isArray(value)
            ? value.slice(skip, skip + limit)
            : value
    };
};

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
        if (filter._id?.$ne === CURRENT_USER) {
            searchFilters.push(filter);
            return query([
                {
                    _id: PUBLIC_USER,
                    name: "Jordan",
                    accountVisibility: "public",
                    following: [],
                    blockedUsers: [],
                    lastSeen: SEARCH_TIME
                },
                {
                    _id: PRIVATE_USER,
                    name: "Jordan Private",
                    accountVisibility: "private",
                    following: [],
                    blockedUsers: [],
                    lastSeen: SEARCH_TIME
                }
            ]);
        }

        const ids = filter._id?.$in || [];
        return query([
            ...(ids.includes(PUBLIC_USER)
                ? [{ _id: PUBLIC_USER }]
                : []),
            ...(ids.includes(PRIVATE_USER)
                ? [{ _id: PRIVATE_USER }]
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

test("chat-user discovery paginates server-side and reports whether another page exists", async () => {
    const originals = {
        userFindById: User.findById,
        userFind: User.find,
        messageDistinct: Message.distinct
    };
    const peers = [
        {
            _id: PUBLIC_USER,
            name: "Alpha",
            accountVisibility: "public",
            following: [],
            blockedUsers: []
        },
        {
            _id: PRIVATE_USER,
            name: "Beta",
            accountVisibility: "public",
            following: [],
            blockedUsers: []
        }
    ];
    User.findById = () => query({
        _id: CURRENT_USER,
        following: [],
        blockedUsers: []
    });
    User.find = filter => query(
        peers.filter(peer =>
            (filter._id?.$in || []).map(String).includes(String(peer._id))
        )
    );
    Message.distinct = async field =>
        field === "receiver" ? [PUBLIC_USER, PRIVATE_USER] : [];

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
                query: { page: "1", limit: "1" }
            },
            response
        );

        assert.equal(response.body.page, 1);
        assert.equal(response.body.limit, 1);
        assert.equal(response.body.hasMore, true);
        assert.deepEqual(
            response.body.users.map(peer => peer._id),
            [PUBLIC_USER]
        );
    } finally {
        User.findById = originals.userFindById;
        User.find = originals.userFind;
        Message.distinct = originals.messageDistinct;
    }
});
