const assert = require("node:assert/strict");
const test = require("node:test");
const {
    canViewPresence,
    getVisibleOnlineUserIds
} = require("../services/messengerPresence");

const VIEWER = "507f1f77bcf86cd799439011";
const PUBLIC_USER = "507f191e810c19729de860ea";
const PRIVATE_USER = "507f191e810c19729de860eb";
const BLOCKED_USER = "507f191e810c19729de860ec";

const account = (id, fields = {}) => ({
    _id: id,
    accountVisibility: "public",
    following: [],
    blockedUsers: [],
    ...fields
});

test("presence is visible for Public accounts and hidden for private accounts without approval", () => {
    const viewer = account(VIEWER);
    const publicUser = account(PUBLIC_USER);
    const privateUser = account(PRIVATE_USER, {
        accountVisibility: "private"
    });

    assert.equal(canViewPresence(viewer, publicUser), true);
    assert.equal(canViewPresence(viewer, privateUser), false);
});

test("a Private account exposes presence only to approved followers", () => {
    const viewer = account(VIEWER, {
        following: [PRIVATE_USER]
    });
    const privateUser = account(PRIVATE_USER, {
        accountVisibility: "private"
    });

    assert.equal(canViewPresence(viewer, privateUser), true);
});

test("accepted existing conversations can see Private presence after promotion", () => {
    const viewer = account(VIEWER);
    const privateUser = account(PRIVATE_USER, {
        accountVisibility: "private"
    });

    assert.equal(canViewPresence(viewer, privateUser), false);
    assert.equal(canViewPresence(viewer, privateUser, true), true);
});

test("presence is hidden in either direction when either account is blocked", () => {
    const viewerBlock = account(VIEWER, {
        blockedUsers: [PRIVATE_USER]
    });
    const subjectBlocked = account(PRIVATE_USER);
    const viewerBlocked = account(VIEWER);
    const subjectBlock = account(PRIVATE_USER, {
        blockedUsers: [VIEWER]
    });

    assert.equal(canViewPresence(viewerBlock, subjectBlocked), false);
    assert.equal(canViewPresence(viewerBlocked, subjectBlock), false);
});

test("online-user snapshots are personalized, omit self, blocked peers, and unapproved Private accounts", () => {
    const users = [
        account(VIEWER),
        account(PUBLIC_USER),
        account(PRIVATE_USER, {
            accountVisibility: "private"
        }),
        account(BLOCKED_USER, {
            blockedUsers: [VIEWER]
        })
    ];

    assert.deepEqual(
        getVisibleOnlineUserIds({
            viewerId: VIEWER,
            onlineUserIds: [VIEWER, PUBLIC_USER, PRIVATE_USER, BLOCKED_USER],
            users,
            existingConversationPeers: [PRIVATE_USER]
        }),
        [PUBLIC_USER, PRIVATE_USER]
    );
    assert.deepEqual(
        getVisibleOnlineUserIds({
            viewerId: "507f191e810c19729de860ed",
            onlineUserIds: [PUBLIC_USER],
            users
        }),
        []
    );
});
