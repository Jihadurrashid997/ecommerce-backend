const assert = require("node:assert/strict");
const test = require("node:test");
const User = require("../models/User");
const { getFollowSuggestions } = require("../controllers/userController");

const USER_ID = "507f1f77bcf86cd799439011";
const FOLLOWED_ID = "507f191e810c19729de860ea";
const SUGGESTED_ID = "507f1f77bcf86cd799439012";
const BLOCKED_BY_ID = "507f1f77bcf86cd799439013";

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

test("follow suggestions exclude private, followed, and blocked users and rank common circles", async () => {
    const originalFindById = User.findById;
    const originalFind = User.find;
    const filters = [];
    User.findById = () => ({
        select() { return this; },
        lean: async () => ({
            following: [FOLLOWED_ID],
            blockedUsers: [BLOCKED_BY_ID]
        })
    });
    User.find = filter => {
        filters.push(filter);
        const query = {
            select() { return this; },
            limit() { return this; },
            lean: async () => filter.blockedUsers && !filter._id
                ? [{ _id: "507f1f77bcf86cd799439014" }]
                : [{
                    _id: SUGGESTED_ID,
                    name: "Suggested",
                    isVerified: true,
                    following: [FOLLOWED_ID]
                }]
        };
        return query;
    };

    try {
        const response = makeResponse();
        await getFollowSuggestions({ user: { id: USER_ID } }, response);

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body.data, [{
            _id: SUGGESTED_ID,
            name: "Suggested",
            isVerified: true,
            mutualConnections: 1
        }]);
        assert.ok(filters[1]._id.$nin.includes(USER_ID));
        assert.ok(filters[1]._id.$nin.includes(FOLLOWED_ID));
        assert.ok(filters[1]._id.$nin.includes(BLOCKED_BY_ID));
        assert.ok(filters[1]._id.$nin.includes("507f1f77bcf86cd799439014"));
        assert.deepEqual(filters[1].accountVisibility, { $ne: "private" });
        assert.deepEqual(filters[1].blockedUsers, { $ne: USER_ID });
    } finally {
        User.findById = originalFindById;
        User.find = originalFind;
    }
});
