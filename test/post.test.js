const assert = require("node:assert/strict");
const test = require("node:test");
const Post = require("../models/Post");
const Message = require("../models/Message");
const messageController = require("../controllers/messageController");
const GroupConversation = require("../models/GroupConversation");
const groupController = require("../controllers/groupController");
const User = require("../models/User");
const adminControlController = require("../controllers/adminControlController");
const { forgotPassword } = require("../controllers/authController");
const jwt = require("jsonwebtoken");

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

test("encrypted messages are marked without changing legacy message validation", () => {
    const message = new Message({
        sender: TEST_USER_ID,
        receiver: OTHER_USER_ID,
        message: "e2ee:v1:YWJj",
        isEncrypted: true
    });

    assert.equal(message.validateSync(), undefined);
    assert.equal(message.isEncrypted, true);

    const legacyMessage = new Message({
        sender: TEST_USER_ID,
        receiver: OTHER_USER_ID,
        message: "Plaintext remains supported"
    });

    assert.equal(legacyMessage.validateSync(), undefined);
    assert.equal(legacyMessage.isEncrypted, false);
});

test("users can register only public P-256 encryption keys", async () => {
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    const originalFindById = User.findById;
    const response = makeResponse();
    let savedKey;

    User.findById = userId => ({
        select: async () => {
            assert.equal(userId, TEST_USER_ID);
            return { messengerEncryptionPublicKey: "" };
        }
    });
    User.findByIdAndUpdate = async (userId, update) => {
        assert.equal(userId, TEST_USER_ID);
        savedKey = JSON.parse(update.$set.messengerEncryptionPublicKey);
        return {};
    };

    try {
        await messageController.saveEncryptionPublicKey(
            {
                user: { id: TEST_USER_ID },
                body: {
                    publicKey: {
                        kty: "EC",
                        crv: "P-256",
                        x: "A".repeat(43),
                        y: "B".repeat(43)
                    }
                }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(
            Object.keys(savedKey).sort(),
            ["crv", "ext", "key_ops", "kty", "x", "y"]
        );
        assert.equal(savedKey.kty, "EC");
    } finally {
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
        User.findById = originalFindById;
    }
});

test("encryption key registration rejects private key material", async () => {
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    const response = makeResponse();

    User.findByIdAndUpdate = async () => {
        throw new Error("Invalid keys must never be saved.");
    };

    try {
        await messageController.saveEncryptionPublicKey(
            {
                user: { id: TEST_USER_ID },
                body: {
                    publicKey: {
                        kty: "EC",
                        crv: "P-256",
                        x: "A".repeat(43),
                        y: "B".repeat(43),
                        d: "private material"
                    }
                }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.success, false);
    } finally {
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("encryption public keys are returned without exposing private key material", async () => {
    const originalFindById = User.findById;
    const response = makeResponse();
    const key = {
        kty: "EC",
        crv: "P-256",
        x: "A".repeat(43),
        y: "B".repeat(43),
        ext: true,
        key_ops: []
    };

    User.findById = userId => ({
        select: () => ({
            lean: async () => {
                assert.equal(userId, OTHER_USER_ID);
                return {
                    messengerEncryptionPublicKey: JSON.stringify(key)
                };
            }
        })
    });

    try {
        await messageController.getEncryptionPublicKey(
            {
                user: { id: TEST_USER_ID },
                params: { userId: OTHER_USER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body.data.publicKey, key);
        assert.equal("d" in response.body.data.publicKey, false);
    } finally {
        User.findById = originalFindById;
    }
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

test("non-members cannot receive group call tokens", async () => {
    const originalFindOne = GroupConversation.findOne;
    const response = makeResponse();

    GroupConversation.findOne = filter => ({
        select: async () => {
            assert.deepEqual(filter, {
                _id: OTHER_USER_ID,
                participants: TEST_USER_ID
            });
            return null;
        }
    });

    try {
        await groupController.createGroupCallToken(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: OTHER_USER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 404);
        assert.equal(response.body.success, false);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});

test("group calls fail explicitly when LiveKit is not configured", async () => {
    const originalFindOne = GroupConversation.findOne;
    const originalUrl = process.env.LIVEKIT_URL;
    const originalKey = process.env.LIVEKIT_API_KEY;
    const originalSecret = process.env.LIVEKIT_API_SECRET;
    const response = makeResponse();

    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    GroupConversation.findOne = () => ({
        select: async () => ({
            _id: OTHER_USER_ID,
            name: "Weekend plans"
        })
    });

    try {
        await groupController.createGroupCallToken(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: OTHER_USER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 503);
        assert.match(response.body.message, /not configured/i);
    } finally {
        GroupConversation.findOne = originalFindOne;
        if (originalUrl === undefined) delete process.env.LIVEKIT_URL;
        else process.env.LIVEKIT_URL = originalUrl;
        if (originalKey === undefined) delete process.env.LIVEKIT_API_KEY;
        else process.env.LIVEKIT_API_KEY = originalKey;
        if (originalSecret === undefined) delete process.env.LIVEKIT_API_SECRET;
        else process.env.LIVEKIT_API_SECRET = originalSecret;
    }
});

test("group call tokens are scoped to the authorized group and user", async () => {
    const originalFindOne = GroupConversation.findOne;
    const originalUserFindById = User.findById;
    const originalUrl = process.env.LIVEKIT_URL;
    const originalKey = process.env.LIVEKIT_API_KEY;
    const originalSecret = process.env.LIVEKIT_API_SECRET;
    const response = makeResponse();
    const secret = "livekit-test-secret";

    process.env.LIVEKIT_URL = "wss://calls.example.com";
    process.env.LIVEKIT_API_KEY = "livekit-test-key";
    process.env.LIVEKIT_API_SECRET = secret;
    GroupConversation.findOne = filter => ({
        select: async () => {
            assert.deepEqual(filter, {
                _id: OTHER_USER_ID,
                participants: TEST_USER_ID
            });
            return {
                _id: OTHER_USER_ID,
                name: "Weekend plans"
            };
        }
    });
    User.findById = userId => ({
        select: () => ({
            lean: async () => {
                assert.equal(userId, TEST_USER_ID);
                return { name: "Test User" };
            }
        })
    });

    try {
        await groupController.createGroupCallToken(
            {
                user: {
                    id: TEST_USER_ID,
                    name: "Test User"
                },
                params: { groupId: OTHER_USER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.data.serverUrl, "wss://calls.example.com");
        assert.equal(response.body.data.roomName, `group-${OTHER_USER_ID}`);
        assert.equal(response.body.data.groupName, "Weekend plans");

        const claims = jwt.verify(response.body.data.token, secret);
        assert.equal(claims.sub, TEST_USER_ID);
        assert.equal(claims.iss, "livekit-test-key");
        assert.equal(claims.name, "Test User");
        assert.equal(claims.video.roomJoin, true);
        assert.equal(claims.video.room, `group-${OTHER_USER_ID}`);
        assert.equal(claims.video.canPublish, true);
        assert.equal(claims.video.canSubscribe, true);
    } finally {
        GroupConversation.findOne = originalFindOne;
        User.findById = originalUserFindById;
        if (originalUrl === undefined) delete process.env.LIVEKIT_URL;
        else process.env.LIVEKIT_URL = originalUrl;
        if (originalKey === undefined) delete process.env.LIVEKIT_API_KEY;
        else process.env.LIVEKIT_API_KEY = originalKey;
        if (originalSecret === undefined) delete process.env.LIVEKIT_API_SECRET;
        else process.env.LIVEKIT_API_SECRET = originalSecret;
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
