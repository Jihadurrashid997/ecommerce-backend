const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const PlatformNotification = require("../models/PlatformNotification");
const User = require("../models/User");
const { notifyUser, notifyUsers } = require("../services/platformNotifications");

const USER_ID = "507f1f77bcf86cd799439011";
const ACTOR_ID = "507f191e810c19729de860ea";

const validNotification = overrides => new PlatformNotification({
    recipient: USER_ID,
    type: "announcement",
    title: "Platform update",
    message: "A service update is available.",
    ...overrides
});

test("platform notifications reject Shop and Messenger channels", () => {
    for (const type of ["shop", "messenger"]) {
        const error = validNotification({ type }).validateSync();
        assert.ok(error);
        assert.ok(error.errors.type);
    }
});

test("platform notifications require a recipient and readable message", () => {
    const error = new PlatformNotification({
        type: "system",
        title: "Update"
    }).validateSync();

    assert.ok(error);
    assert.ok(error.errors.recipient);
    assert.ok(error.errors.message);
});

test("single notifications respect preferences and do not notify the actor", async () => {
    const originals = {
        findById: User.findById,
        create: PlatformNotification.create,
        readyState: mongoose.connection.readyState
    };
    const inserted = [];
    User.findById = () => ({
        select() {
            return this;
        },
        async lean() {
            return { notificationPreferences: { follows: true } };
        }
    });
    PlatformNotification.create = async notification => inserted.push(notification);
    mongoose.connection.readyState = 1;

    try {
        assert.equal(await notifyUser(USER_ID, {
            actor: ACTOR_ID,
            type: "follow",
            title: "New follower",
            message: "Someone followed you."
        }), true);
        assert.equal(await notifyUser(ACTOR_ID, {
            actor: ACTOR_ID,
            type: "follow",
            title: "New follower",
            message: "Someone followed you."
        }), false);
        assert.equal(inserted.length, 1);
        assert.equal(String(inserted[0].recipient), USER_ID);
    } finally {
        User.findById = originals.findById;
        PlatformNotification.create = originals.create;
        mongoose.connection.readyState = originals.readyState;
    }
});

test("bulk notifications deduplicate recipients and exclude the actor", async () => {
    const originals = {
        find: User.find,
        insertMany: PlatformNotification.insertMany,
        readyState: mongoose.connection.readyState
    };
    let filter;
    let inserted = [];
    User.find = value => {
        filter = value;
        return {
            select() {
                return this;
            },
            async lean() {
                return [{ _id: USER_ID }];
            }
        };
    };
    PlatformNotification.insertMany = async documents => {
        inserted = documents;
    };
    mongoose.connection.readyState = 1;

    try {
        const count = await notifyUsers(
            [USER_ID, USER_ID, ACTOR_ID],
            {
                actor: ACTOR_ID,
                type: "announcement",
                title: "Announcement",
                message: "An update is available."
            }
        );
        assert.equal(count, 1);
        assert.deepEqual(filter._id.$in, [USER_ID]);
        assert.equal(inserted.length, 1);
        assert.equal(String(inserted[0].recipient), USER_ID);
    } finally {
        User.find = originals.find;
        PlatformNotification.insertMany = originals.insertMany;
        mongoose.connection.readyState = originals.readyState;
    }
});
