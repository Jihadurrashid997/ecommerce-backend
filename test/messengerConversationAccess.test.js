const assert = require("node:assert/strict");
const test = require("node:test");
const {
    canAccessDirectConversation,
    evaluateDirectMessagePermission,
    getDirectMessagePermission,
    getEligibleConversationPeerIds
} = require("../services/messengerConversationAccess");

const FIRST_USER = "507f1f77bcf86cd799439011";
const SECOND_USER = "507f191e810c19729de860ea";
const THIRD_USER = "507f191e810c19729de860eb";

const user = (id, {
    visibility = "public",
    following = [],
    blockedUsers = []
} = {}) => ({
    _id: id,
    accountVisibility: visibility,
    following,
    blockedUsers
});

const makeModels = ({
    sender = user(FIRST_USER),
    recipient = user(SECOND_USER),
    existing = false
} = {}) => ({
    User: {
        findById: id => ({
            select: () => ({
                lean: async () => ({
                    [FIRST_USER]: sender,
                    [SECOND_USER]: recipient,
                    [THIRD_USER]: user(THIRD_USER)
                }[String(id)] || null)
            })
        })
    },
    Message: {
        exists: async query => {
            assert.equal(query.$or.length, 2);
            assert.equal(query.$or[0].sender, query.$or[1].receiver);
            assert.equal(query.$or[0].receiver, query.$or[1].sender);
            return existing ? { _id: "message-id" } : null;
        }
    }
});

test("any authenticated user can start a conversation with a Public account", async () => {
    const models = makeModels({
        sender: user(FIRST_USER),
        recipient: user(SECOND_USER, { visibility: "public" })
    });

    const permission = await getDirectMessagePermission({
        ...models,
        senderId: FIRST_USER,
        recipientId: SECOND_USER
    });

    assert.equal(permission.canSendMessage, true);
    assert.equal(permission.canCreateRequest, false);
    assert.equal(permission.reason, "public-account");
});

test("only an approved follower can start a conversation with a Private account", async () => {
    const models = makeModels({
        sender: user(FIRST_USER, { following: [SECOND_USER] }),
        recipient: user(SECOND_USER, { visibility: "private" })
    });

    const permission = await getDirectMessagePermission({
        ...models,
        senderId: FIRST_USER,
        recipientId: SECOND_USER
    });

    assert.equal(permission.canSendMessage, true);
    assert.equal(permission.canCreateRequest, false);
    assert.equal(permission.reason, "approved-follower");
});

test("unapproved users are directed to a Message Request for Private accounts", async () => {
    const models = makeModels({
        sender: user(FIRST_USER),
        recipient: user(SECOND_USER, { visibility: "private" })
    });

    const permission = await getDirectMessagePermission({
        ...models,
        senderId: FIRST_USER,
        recipientId: SECOND_USER
    });

    assert.equal(permission.canSendMessage, false);
    assert.equal(permission.canCreateRequest, true);
    assert.equal(permission.reason, "message-request-required");
});

test("the approved follower is recorded in the requester's following list", () => {
    const permission = evaluateDirectMessagePermission({
        sender: user(FIRST_USER, { following: [SECOND_USER] }),
        recipient: user(SECOND_USER, { visibility: "private" })
    });

    assert.equal(permission.canSendMessage, true);
    assert.equal(permission.canCreateRequest, false);
});

test("a Private account following the sender does not approve the sender", () => {
    const permission = evaluateDirectMessagePermission({
        sender: user(FIRST_USER),
        recipient: user(SECOND_USER, {
            visibility: "private",
            following: [FIRST_USER]
        })
    });

    assert.equal(permission.canSendMessage, false);
    assert.equal(permission.canCreateRequest, true);
});

test("existing conversation history survives unfollow and privacy changes", async () => {
    const models = makeModels({
        sender: user(FIRST_USER),
        recipient: user(SECOND_USER, { visibility: "private" }),
        existing: true
    });

    const permission = await getDirectMessagePermission({
        ...models,
        senderId: FIRST_USER,
        recipientId: SECOND_USER
    });

    assert.equal(permission.canReadHistory, true);
    assert.equal(permission.canSendMessage, true);
    assert.equal(permission.reason, "existing-conversation");
});

test("blocking prevents contact but preserves access to prior history", () => {
    const permission = evaluateDirectMessagePermission({
        sender: user(FIRST_USER),
        recipient: user(SECOND_USER, {
            visibility: "private",
            blockedUsers: [FIRST_USER]
        }),
        hasExistingConversation: true
    });

    assert.equal(permission.canReadHistory, true);
    assert.equal(permission.canSendMessage, false);
    assert.equal(permission.canCall, false);
    assert.equal(permission.canCreateRequest, false);
    assert.equal(permission.reason, "blocked");
});

test("blocked users cannot message, call, or request a new conversation", () => {
    const permission = evaluateDirectMessagePermission({
        sender: user(FIRST_USER, { blockedUsers: [SECOND_USER] }),
        recipient: user(SECOND_USER)
    });

    assert.equal(permission.canSendMessage, false);
    assert.equal(permission.canCall, false);
    assert.equal(permission.canCreateRequest, false);
});

test("users without a persisted relationship cannot read a conversation", async () => {
    const models = makeModels();

    assert.equal(
        await canAccessDirectConversation({
            ...models,
            senderId: FIRST_USER,
            recipientId: SECOND_USER
        }),
        true,
        "the recipient is Public, so the sender may initiate"
    );
    assert.equal(
        await canAccessDirectConversation({
            ...makeModels({
                sender: user(FIRST_USER),
                recipient: user(SECOND_USER, { visibility: "private" })
            }),
            senderId: FIRST_USER,
            recipientId: SECOND_USER
        }),
        false
    );
});

test("missing and self participants are denied", async () => {
    const models = makeModels();
    assert.equal(
        (await getDirectMessagePermission({
            ...models,
            senderId: FIRST_USER,
            recipientId: FIRST_USER
        })).canSendMessage,
        false
    );
    assert.equal(
        (await getDirectMessagePermission({
            ...models,
            senderId: FIRST_USER,
            recipientId: "507f191e810c19729de860ec"
        })).reason,
        "user-not-found"
    );
});

test("chat discovery includes Public accounts, approved Private followers, and old conversations", () => {
    const ids = getEligibleConversationPeerIds({
        currentUserId: FIRST_USER,
        users: [
            user(SECOND_USER, { visibility: "public" }),
            user(THIRD_USER, { visibility: "private" }),
            user("507f191e810c19729de860ec", { visibility: "private" })
        ],
        following: [THIRD_USER],
        followers: ["507f191e810c19729de860ed"],
        existingConversationPeers: ["507f191e810c19729de860ec"]
    });

    assert.deepEqual(
        new Set(ids),
        new Set([SECOND_USER, THIRD_USER, "507f191e810c19729de860ec"])
    );
});
