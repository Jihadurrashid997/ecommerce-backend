const assert = require("node:assert/strict");
const test = require("node:test");
const Post = require("../models/Post");
const Message = require("../models/Message");
const GroupConversation = require("../models/GroupConversation");
const groupController = require("../controllers/groupController");
const User = require("../models/User");
const adminControlController = require("../controllers/adminControlController");
const { forgotPassword } = require("../controllers/authController");

const TEST_USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f191e810c19729de860ea";

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

const makePost = fields => new Post({
    author: "507f1f77bcf86cd799439011",
    kind: "post",
    caption: "A thoughtful moment",
    media: [],
    ...fields
});

test("a text-only post is valid", () => {
    assert.equal(makePost().validateSync(), undefined);
});

test("an empty post is rejected", () => {
    const error = makePost({ caption: "" }).validateSync();

    assert.ok(error);
    assert.match(error.errors.media.message, /caption or media/);
});

test("a photo post remains valid", () => {
    const post = makePost({
        caption: "",
        media: [{
            url: "https://cdn.example.com/photo.jpg",
            type: "image"
        }]
    });

    assert.equal(post.validateSync(), undefined);
});

test("a reel still requires video media", () => {
    const error = makePost({
        kind: "reel",
        caption: "A reel without a video"
    }).validateSync();

    assert.ok(error);
    assert.match(error.errors.media.message, /caption or media/);
});

test("direct messages still require a receiver", () => {
    const error = new Message({
        sender: TEST_USER_ID,
        message: "Hello"
    }).validateSync();

    assert.ok(error);
    assert.ok(error.errors.receiver);
});

test("group messages use a group ID instead of a direct receiver", () => {
    const message = new Message({
        sender: TEST_USER_ID,
        groupId: "507f191e810c19729de860ea",
        message: "Hello group"
    });

    assert.equal(message.validateSync(), undefined);
});

test("a message cannot target both a group and a direct recipient", () => {
    const error = new Message({
        sender: TEST_USER_ID,
        receiver: "507f191e810c19729de860ea",
        groupId: "507f191e810c19729de860eb",
        message: "Ambiguous destination"
    }).validateSync();

    assert.ok(error);
    assert.match(error.errors.groupId.message, /either a group or a direct recipient/);
});

test("groups validate their name, creator, and participant list", () => {
    const group = new GroupConversation({
        name: "Weekend plans",
        createdBy: TEST_USER_ID,
        admins: [TEST_USER_ID],
        participants: [
            TEST_USER_ID,
            "507f191e810c19729de860ea"
        ]
    });

    assert.equal(group.validateSync(), undefined);
});

test("non-members cannot load group message history", async () => {
    const originalFindOne = GroupConversation.findOne;
    const response = makeResponse();
    let lookup;

    GroupConversation.findOne = filter => {
        lookup = filter;
        return Promise.resolve(null);
    };

    try {
        await groupController.getGroupMessages(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: OTHER_USER_ID }
            },
            response
        );

        assert.deepEqual(lookup, {
            _id: OTHER_USER_ID,
            participants: TEST_USER_ID
        });
        assert.equal(response.statusCode, 404);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});

test("non-admin group members cannot remove other members", async () => {
    const originalFindOne = GroupConversation.findOne;
    const response = makeResponse();
    const group = {
        admins: [OTHER_USER_ID],
        participants: [OTHER_USER_ID, TEST_USER_ID]
    };

    GroupConversation.findOne = () => Promise.resolve(group);

    try {
        await groupController.removeGroupMember(
            {
                user: { id: TEST_USER_ID },
                params: {
                    groupId: "507f191e810c19729de860eb",
                    userId: OTHER_USER_ID
                },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.equal(group.participants.length, 2);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});

test("admin verification grants a badge with audit metadata", async () => {
    const originalUpdateOne = User.updateOne;
    const response = makeResponse();
    let update;

    User.updateOne = async (filter, value) => {
        assert.deepEqual(filter, { _id: OTHER_USER_ID });
        update = value;
        return { matchedCount: 1 };
    };

    try {
        await adminControlController.setVerification(
            {
                params: { id: OTHER_USER_ID },
                body: { isVerified: true },
                user: { id: TEST_USER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.isVerified, true);
        assert.equal(update.$set.isVerified, true);
        assert.equal(update.$set.verifiedBy, TEST_USER_ID);
        assert.ok(update.$set.verifiedAt instanceof Date);
    } finally {
        User.updateOne = originalUpdateOne;
    }
});

test("admin verification rejects non-boolean input", async () => {
    const originalUpdateOne = User.updateOne;
    const response = makeResponse();

    User.updateOne = async () => {
        throw new Error("Invalid status must not reach persistence.");
    };

    try {
        await adminControlController.setVerification(
            {
                params: { id: OTHER_USER_ID },
                body: { isVerified: "true" },
                user: { id: TEST_USER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /true or false/);
    } finally {
        User.updateOne = originalUpdateOne;
    }
});

test("forgot password reports missing SMTP configuration instead of claiming a code was sent", async () => {
    const names = [
        "EMAIL_HOST",
        "EMAIL_USER",
        "EMAIL_PASS"
    ];
    const previous = Object.fromEntries(
        names.map(name => [name, process.env[name]])
    );
    names.forEach(name => { process.env[name] = ""; });

    const response = {
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
    };

    try {
        await forgotPassword(
            { body: { email: "person@example.com" } },
            response
        );

        assert.equal(response.statusCode, 503);
        assert.match(response.body.message, /email is not configured/i);
    } finally {
        names.forEach(name => {
            if (previous[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = previous[name];
            }
        });
    }
});
