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
const messageUpload = require("../middleware/messageUpload");

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

const makeMessageQuery = document => ({
    populate() {
        return this;
    },
    then(resolve, reject) {
        return Promise.resolve(document).then(resolve, reject);
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

test("direct conversation history returns the requested page and indicates older messages", async () => {
    const originalFind = Message.find;
    const newest = { _id: "newest" };
    const older = { _id: "older" };
    const extra = { _id: "extra" };
    const response = makeResponse();
    const query = {
        sort(value) {
            assert.deepEqual(value, { createdAt: -1, _id: -1 });
            return this;
        },
        skip(value) {
            assert.equal(value, 2);
            return this;
        },
        limit(value) {
            assert.equal(value, 3);
            return this;
        },
        populate() {
            return this;
        },
        then(resolve, reject) {
            return Promise.resolve([newest, older, extra]).then(resolve, reject);
        }
    };

    Message.find = filter => {
        assert.deepEqual(filter, {
            $or: [
                { sender: TEST_USER_ID, receiver: OTHER_USER_ID },
                { sender: OTHER_USER_ID, receiver: TEST_USER_ID }
            ]
        });
        return query;
    };

    try {
        await messageController.getConversation(
            {
                user: { id: TEST_USER_ID },
                params: { userId: OTHER_USER_ID },
                query: { page: "2", limit: "2" }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body.data, [older, newest]);
        assert.equal(response.body.page, 2);
        assert.equal(response.body.limit, 2);
        assert.equal(response.body.hasMore, true);
    } finally {
        Message.find = originalFind;
    }
});

test("direct conversation history rejects invalid pagination", async () => {
    const originalFind = Message.find;
    const response = makeResponse();
    Message.find = () => {
        throw new Error("Invalid pagination must not query messages.");
    };

    try {
        await messageController.getConversation(
            {
                user: { id: TEST_USER_ID },
                params: { userId: OTHER_USER_ID },
                query: { page: "0", limit: "50" }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.success, false);
    } finally {
        Message.find = originalFind;
    }
});

test("editing and deleting a direct message broadcasts updates to both participants", async () => {
    const originalFindById = Message.findById;
    const message = {
        _id: OTHER_USER_ID,
        sender: TEST_USER_ID,
        receiver: OTHER_USER_ID,
        message: "before",
        async save() {}
    };
    const events = [];
    const query = {
        populate() {
            return this;
        },
        then(resolve, reject) {
            return Promise.resolve(message).then(resolve, reject);
        }
    };
    let lookups = 0;

    Message.findById = () => {
        lookups += 1;
        return lookups % 2 === 1
            ? Promise.resolve(message)
            : query;
    };

    try {
        await messageController.editMessage(
            {
                user: { id: TEST_USER_ID },
                params: { id: OTHER_USER_ID },
                body: { message: "after" },
                app: {
                    get: () => ({
                        to(room) {
                            return {
                                emit(event, payload) {
                                    events.push({ room, event, payload });
                                }
                            };
                        }
                    })
                }
            },
            makeResponse()
        );
        await messageController.deleteMessage(
            {
                user: { id: TEST_USER_ID },
                params: { id: OTHER_USER_ID },
                app: {
                    get: () => ({
                        to(room) {
                            return {
                                emit(event, payload) {
                                    events.push({ room, event, payload });
                                }
                            };
                        }
                    })
                }
            },
            makeResponse()
        );

        assert.equal(message.message, "");
        assert.equal(message.isDeleted, true);
        assert.deepEqual(
            events.map(({ room, event }) => ({ room, event })),
            [
                { room: `user:${TEST_USER_ID}`, event: "message-updated" },
                { room: `user:${OTHER_USER_ID}`, event: "message-updated" },
                { room: `user:${TEST_USER_ID}`, event: "message-updated" },
                { room: `user:${OTHER_USER_ID}`, event: "message-updated" }
            ]
        );
        assert.equal(events[0].payload.message.isEdited, true);
        assert.equal(events[2].payload.message.isDeleted, true);
    } finally {
        Message.findById = originalFindById;
    }
});

test("marking a conversation seen notifies the sender for the changed messages", async () => {
    const originalFind = Message.find;
    const originalUpdateMany = Message.updateMany;
    const events = [];
    const response = makeResponse();
    const unseenMessages = [
        { _id: "507f1f77bcf86cd799439014" },
        { _id: "507f1f77bcf86cd799439015" }
    ];
    Message.find = filter => {
        assert.deepEqual(filter, {
            sender: OTHER_USER_ID,
            receiver: TEST_USER_ID,
            isSeen: false
        });
        return {
            select(fields) {
                assert.equal(fields, "_id");
                return this;
            },
            lean: async () => unseenMessages
        };
    };
    Message.updateMany = async (filter, update) => {
        assert.deepEqual(filter, {
            sender: OTHER_USER_ID,
            receiver: TEST_USER_ID,
            isSeen: false
        });
        assert.deepEqual(update, {
            $set: { isSeen: true, isDelivered: true }
        });
        return { modifiedCount: unseenMessages.length };
    };

    try {
        await messageController.markSeen(
            {
                user: { id: TEST_USER_ID },
                params: { userId: OTHER_USER_ID },
                app: {
                    get: () => ({
                        to(room) {
                            return {
                                emit(event, data) {
                                    events.push({ room, event, data });
                                }
                            };
                        }
                    })
                }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(events, [
            {
                room: `user:${OTHER_USER_ID}`,
                event: "messages-seen",
                data: {
                    senderId: OTHER_USER_ID,
                    receiverId: TEST_USER_ID,
                    messageIds: unseenMessages.map(item => item._id)
                }
            }
        ]);
    } finally {
        Message.find = originalFind;
        Message.updateMany = originalUpdateMany;
    }
});

test("users cannot forward messages outside conversations they can access", async () => {
    const originalFindById = Message.findById;
    const response = makeResponse();
    Message.findById = () => ({
        select: async () => ({
            sender: OTHER_USER_ID,
            receiver: "507f1f77bcf86cd799439012",
            groupId: null,
            isDeleted: false
        })
    });

    try {
        await messageController.sendMessage(
            {
                user: { id: TEST_USER_ID },
                body: {
                    receiver: OTHER_USER_ID,
                    forwardedFrom: "507f1f77bcf86cd799439013"
                }
            },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.equal(response.body.success, false);
    } finally {
        Message.findById = originalFindById;
    }
});

test("Messenger attachment uploads accept common audio formats and reject video files", () => {
    const filterFile = mimetype => {
        let result;
        messageUpload.fileFilter({}, { mimetype }, (error, accepted) => {
            result = { error, accepted };
        });
        return result;
    };

    for (const mimetype of [
        "application/octet-stream",
        "audio/webm",
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/mp4; codecs=mp4a.40.2",
        "audio/aac",
        "audio/mpeg",
        "audio/ogg",
        "audio/wav",
        "audio/flac",
        "audio/m4a",
        "audio/opus",
        "audio/3gpp"
    ]) {
        assert.deepEqual(filterFile(mimetype), {
            error: null,
            accepted: true
        });
    }

    assert.match(filterFile("video/mp4").error.message, /images, audio/i);
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

test("new groups keep end-to-end encryption disabled by default", () => {
    const group = new GroupConversation({
        name: "Weekend plans",
        createdBy: TEST_USER_ID,
        admins: [TEST_USER_ID],
        participants: [TEST_USER_ID, OTHER_USER_ID]
    });

    assert.equal(group.isEncrypted, false);
});

test("only admins can enable group encryption and every member must have a key", async () => {
    const originalFindOne = GroupConversation.findOne;
    const originalUserFind = User.find;
    const group = {
        _id: "507f191e810c19729de860eb",
        admins: [TEST_USER_ID],
        participants: [TEST_USER_ID, OTHER_USER_ID],
        isEncrypted: false,
        save: async () => {}
    };
    const response = makeResponse();

    GroupConversation.findOne = async () => group;
    User.find = () => ({
        select: () => ({
            lean: async () => [
                {
                    _id: TEST_USER_ID,
                    messengerEncryptionPublicKey: JSON.stringify({
                        kty: "EC",
                        crv: "P-256",
                        x: "A".repeat(43),
                        y: "B".repeat(43)
                    })
                }
            ]
        })
    });

    try {
        await groupController.setGroupEncryption(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: group._id },
                body: { isEncrypted: true },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.deepEqual(response.body.membersWithoutKeys, [OTHER_USER_ID]);
        assert.equal(group.isEncrypted, false);
    } finally {
        GroupConversation.findOne = originalFindOne;
        User.find = originalUserFind;
    }
});

test("non-admin group members cannot change group encryption settings", async () => {
    const originalFindOne = GroupConversation.findOne;
    const group = {
        _id: "507f191e810c19729de860eb",
        admins: [OTHER_USER_ID],
        participants: [TEST_USER_ID, OTHER_USER_ID],
        isEncrypted: false,
        save: async () => {
            throw new Error("Non-admin must not save group settings.");
        }
    };
    const response = makeResponse();

    GroupConversation.findOne = async () => group;

    try {
        await groupController.setGroupEncryption(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: group._id },
                body: { isEncrypted: true },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.equal(group.isEncrypted, false);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});

test("encrypted groups reject members who have not registered an encryption key", async () => {
    const originalFindOne = GroupConversation.findOne;
    const originalCountDocuments = User.countDocuments;
    const originalUserFind = User.find;
    const newMemberId = "507f191e810c19729de860ec";
    const group = {
        _id: "507f191e810c19729de860eb",
        admins: [TEST_USER_ID],
        participants: [TEST_USER_ID, OTHER_USER_ID],
        isEncrypted: true,
        save: async () => {
            throw new Error("Unprepared member must not be added.");
        }
    };
    const response = makeResponse();

    GroupConversation.findOne = async () => group;
    User.countDocuments = async () => 1;
    User.find = () => ({
        select: () => ({
            lean: async () => []
        })
    });

    try {
        await groupController.addGroupMembers(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: group._id },
                body: { memberIds: [newMemberId] },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.deepEqual(response.body.membersWithoutKeys, [newMemberId]);
        assert.deepEqual(group.participants, [TEST_USER_ID, OTHER_USER_ID]);
    } finally {
        GroupConversation.findOne = originalFindOne;
        User.countDocuments = originalCountDocuments;
        User.find = originalUserFind;
    }
});

test("group messages cannot bypass enabled end-to-end encryption", async () => {
    const originalFindOne = GroupConversation.findOne;
    const response = makeResponse();

    GroupConversation.findOne = async () => ({
        isEncrypted: true,
        participants: [TEST_USER_ID]
    });

    try {
        await messageController.sendMessage(
            {
                user: { id: TEST_USER_ID },
                body: {
                    groupId: "507f191e810c19729de860eb",
                    message: "must not be stored as plaintext"
                }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /requires end-to-end encrypted/);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});

test("encrypted group attachments store only opaque ciphertext metadata", async () => {
    const originalGroupFindOne = GroupConversation.findOne;
    const originalMessageCreate = Message.create;
    const originalMessageFindById = Message.findById;
    const group = {
        _id: "507f191e810c19729de860eb",
        isEncrypted: true,
        participants: [TEST_USER_ID],
        save: async () => {}
    };
    const response = makeResponse();
    let storedMessage;
    const created = {
        _id: "507f191e810c19729de860ec",
        createdAt: new Date().toISOString()
    };

    GroupConversation.findOne = async () => group;
    Message.create = async document => {
        storedMessage = document;
        return created;
    };
    Message.findById = () =>
        makeMessageQuery({ ...created, ...storedMessage });

    try {
        await messageController.sendMessage(
            {
                user: { id: TEST_USER_ID },
                body: {
                    groupId: group._id,
                    message: "e2eg:v1:YWJj",
                    isEncrypted: "true"
                },
                file: {
                    filename: "stored-ciphertext.bin",
                    originalname: "encrypted-media.bin",
                    mimetype: "application/octet-stream"
                },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 201);
        assert.equal(storedMessage.isEncrypted, true);
        assert.equal(storedMessage.fileType, "application/octet-stream");
        assert.equal(storedMessage.fileName, "encrypted-media.bin");
        assert.equal(storedMessage.fileUrl, "/uploads/stored-ciphertext.bin");
        assert.equal(group.lastMessage.message, "🔒 Encrypted message");
    } finally {
        GroupConversation.findOne = originalGroupFindOne;
        Message.create = originalMessageCreate;
        Message.findById = originalMessageFindById;
    }
});

test("unencrypted direct messages cannot upload opaque ciphertext files", async () => {
    const originalUserFindById = User.findById;
    const publicKey = JSON.stringify({
        kty: "EC",
        crv: "P-256",
        x: "A".repeat(43),
        y: "B".repeat(43)
    });
    const response = makeResponse();

    User.findById = () => ({
        select: async () => ({
            blockedUsers: [],
            messengerEncryptionPublicKey: publicKey
        })
    });

    try {
        await messageController.sendMessage(
            {
                user: { id: TEST_USER_ID },
                body: {
                    receiver: OTHER_USER_ID,
                    message: "",
                    isEncrypted: "false"
                },
                file: {
                    filename: "ciphertext.bin",
                    originalname: "encrypted-media.bin",
                    mimetype: "application/octet-stream"
                }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /opaque ciphertext/i);
    } finally {
        User.findById = originalUserFindById;
    }
});

test("encrypted direct messages accept client-encrypted opaque files", async () => {
    const originalUserFindById = User.findById;
    const originalMessageCreate = Message.create;
    const originalMessageFindById = Message.findById;
    const publicKey = JSON.stringify({
        kty: "EC",
        crv: "P-256",
        x: "A".repeat(43),
        y: "B".repeat(43)
    });
    const response = makeResponse();
    let storedMessage;
    const created = {
        _id: "507f191e810c19729de860ec",
        createdAt: new Date().toISOString()
    };

    User.findById = () => ({
        select: async () => ({
            blockedUsers: [],
            messengerEncryptionPublicKey: publicKey
        })
    });
    Message.create = async document => {
        storedMessage = document;
        return created;
    };
    Message.findById = () =>
        makeMessageQuery({ ...created, ...storedMessage });

    try {
        await messageController.sendMessage(
            {
                user: { id: TEST_USER_ID },
                body: {
                    receiver: OTHER_USER_ID,
                    message: "e2ee:v1:YWJj",
                    isEncrypted: "true"
                },
                file: {
                    filename: "stored-ciphertext.bin",
                    originalname: "encrypted-media.bin",
                    mimetype: "application/octet-stream"
                }
            },
            response
        );

        assert.equal(response.statusCode, 201);
        assert.equal(storedMessage.isEncrypted, true);
        assert.equal(storedMessage.fileType, "application/octet-stream");
        assert.equal(storedMessage.fileName, "encrypted-media.bin");
    } finally {
        User.findById = originalUserFindById;
        Message.create = originalMessageCreate;
        Message.findById = originalMessageFindById;
    }
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

test("users can store and retrieve only their passphrase-encrypted Messenger key backup", async () => {
    const originalFindById = User.findById;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    const backup = {
        version: 1,
        kdf: "PBKDF2-SHA-256",
        iterations: 600000,
        salt: "A".repeat(22),
        iv: "B".repeat(16),
        ciphertext: "C".repeat(120)
    };
    let savedBackup;
    const response = makeResponse();

    User.findById = userId => ({
        select: async () => {
            assert.equal(userId, TEST_USER_ID);
            return {
                messengerEncryptionPublicKey: "{\"kty\":\"EC\"}"
            };
        }
    });
    User.findByIdAndUpdate = async (userId, update) => {
        assert.equal(userId, TEST_USER_ID);
        savedBackup = JSON.parse(update.$set.messengerEncryptionKeyBackup);
        return {};
    };

    try {
        await messageController.saveEncryptionKeyBackup(
            {
                user: { id: TEST_USER_ID },
                body: { backup }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(savedBackup, backup);
        assert.equal("passphrase" in savedBackup, false);

        User.findById = userId => ({
            select: () => ({
                lean: async () => {
                    assert.equal(userId, TEST_USER_ID);
                    return {
                        messengerEncryptionKeyBackup: JSON.stringify(savedBackup)
                    };
                }
            })
        });
        const getResponse = makeResponse();

        await messageController.getEncryptionKeyBackup(
            { user: { id: TEST_USER_ID } },
            getResponse
        );

        assert.equal(getResponse.statusCode, 200);
        assert.deepEqual(getResponse.body.data.backup, backup);
    } finally {
        User.findById = originalFindById;
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("Messenger key backup rejects invalid encryption metadata", async () => {
    const originalFindById = User.findById;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    const response = makeResponse();

    User.findById = async () => {
        throw new Error("Invalid backup metadata must be rejected before lookup.");
    };
    User.findByIdAndUpdate = async () => {
        throw new Error("Invalid backup metadata must never be stored.");
    };

    try {
        await messageController.saveEncryptionKeyBackup(
            {
                user: { id: TEST_USER_ID },
                body: {
                    backup: {
                        version: 1,
                        kdf: "PBKDF2-SHA-256",
                        iterations: 1,
                        salt: "short",
                        iv: "short",
                        ciphertext: "not encrypted"
                    }
                }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.success, false);
    } finally {
        User.findById = originalFindById;
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
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

test("group conversation history supports paging and preserves chronological order", async () => {
    const originalFindOne = GroupConversation.findOne;
    const originalFind = Message.find;
    const originalUpdateMany = Message.updateMany;
    const newest = { _id: "newest" };
    const older = { _id: "older" };
    const extra = { _id: "extra" };
    const response = makeResponse();
    const query = {
        sort(value) {
            assert.deepEqual(value, { createdAt: -1, _id: -1 });
            return this;
        },
        skip(value) {
            assert.equal(value, 2);
            return this;
        },
        limit(value) {
            assert.equal(value, 3);
            return this;
        },
        populate() {
            return this;
        },
        then(resolve, reject) {
            return Promise.resolve([newest, older, extra]).then(resolve, reject);
        }
    };

    GroupConversation.findOne = filter => {
        assert.deepEqual(filter, {
            _id: OTHER_USER_ID,
            participants: TEST_USER_ID
        });
        return Promise.resolve({ _id: OTHER_USER_ID });
    };
    Message.find = filter => {
        assert.deepEqual(filter, { groupId: OTHER_USER_ID });
        return query;
    };
    Message.updateMany = async filter => {
        assert.deepEqual(filter, {
            groupId: OTHER_USER_ID,
            sender: { $ne: TEST_USER_ID }
        });
    };

    try {
        await groupController.getGroupMessages(
            {
                user: { id: TEST_USER_ID },
                params: { groupId: OTHER_USER_ID },
                query: { page: "2", limit: "2" }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body.data, [older, newest]);
        assert.equal(response.body.page, 2);
        assert.equal(response.body.limit, 2);
        assert.equal(response.body.hasMore, true);
    } finally {
        GroupConversation.findOne = originalFindOne;
        Message.find = originalFind;
        Message.updateMany = originalUpdateMany;
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
