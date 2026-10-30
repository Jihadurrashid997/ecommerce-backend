const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const messageController = require("../controllers/messageController");

const CURRENT_USER = "507f1f77bcf86cd799439011";
const PEER_ONE = "507f191e810c19729de860ea";
const PEER_TWO = "507f191e810c19729de860eb";

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

test("recent conversations aggregate before paginating and expose next-page metadata", async () => {
    const originalAggregate = Message.aggregate;
    const rows = [
        {
            userId: new mongoose.Types.ObjectId(PEER_ONE),
            lastMessage: { createdAt: new Date("2026-01-02T00:00:00.000Z") }
        },
        {
            userId: new mongoose.Types.ObjectId(PEER_TWO),
            lastMessage: { createdAt: new Date("2026-01-01T00:00:00.000Z") }
        }
    ];
    let pipeline;
    Message.aggregate = async value => {
        pipeline = value;
        return rows;
    };

    try {
        const response = makeResponse();
        await messageController.getRecentConversations(
            {
                user: { id: CURRENT_USER },
                query: { page: "1", limit: "1" }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.page, 1);
        assert.equal(response.body.limit, 1);
        assert.equal(response.body.hasMore, true);
        assert.equal(response.body.data.length, 1);
        assert.equal(String(response.body.data[0].userId), PEER_ONE);
        assert.equal(
            pipeline.some(stage => Boolean(stage.$group)),
            true
        );
        assert.equal(
            pipeline.some(stage => stage.$skip === 0),
            true
        );
        assert.equal(
            pipeline.some(stage => stage.$limit === 2),
            true
        );
    } finally {
        Message.aggregate = originalAggregate;
    }
});

test("recent conversations reject invalid pagination", async () => {
    const originalAggregate = Message.aggregate;
    Message.aggregate = async () => {
        throw new Error("Aggregation should not run");
    };

    try {
        const response = makeResponse();
        await messageController.getRecentConversations(
            {
                user: { id: CURRENT_USER },
                query: { page: "0" }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.success, false);
    } finally {
        Message.aggregate = originalAggregate;
    }
});
