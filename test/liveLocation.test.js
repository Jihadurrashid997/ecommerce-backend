const assert = require("node:assert/strict");
const test = require("node:test");
const GroupConversation = require("../models/GroupConversation");
const LiveLocationShare = require("../models/LiveLocationShare");
const Message = require("../models/Message");
const User = require("../models/User");
const controller = require("../controllers/liveLocationController");

const SENDER_ID = "507f1f77bcf86cd799439011";
const RECIPIENT_ID = "507f191e810c19729de860ea";
const SHARE_ID = "507f191e810c19729de860eb";

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

const query = value => ({
    select() {
        return this;
    },
    lean: async () => value
});

const withDirectAccessMocks = async (callback, { senderFollowing = [] } = {}) => {
    const originals = {
        userFindById: User.findById,
        messageExists: Message.exists,
        shareFindOneAndUpdate: LiveLocationShare.findOneAndUpdate
    };
    User.findById = id => query(
        String(id) === SENDER_ID
            ? {
                  _id: SENDER_ID,
                  accountVisibility: "public",
                  following: senderFollowing,
                  blockedUsers: []
              }
            : {
                  _id: RECIPIENT_ID,
                  accountVisibility: "private",
                  following: [],
                  blockedUsers: []
              }
    );
    Message.exists = async () => null;
    try {
        return await callback(originals);
    } finally {
        User.findById = originals.userFindById;
        Message.exists = originals.messageExists;
        LiveLocationShare.findOneAndUpdate = originals.shareFindOneAndUpdate;
    }
};

test("live location duration choices are restricted to 15 minutes, 1 hour, and 8 hours", async () => {
    await withDirectAccessMocks(async () => {
        let writes = 0;
        LiveLocationShare.findOneAndUpdate = async () => {
            writes += 1;
            return {};
        };
        const response = makeResponse();
        await controller.startLiveLocation(
            {
                user: { id: SENDER_ID },
                body: {
                    recipientId: RECIPIENT_ID,
                    durationMinutes: 30,
                    latitude: 23.7,
                    longitude: 90.4
                }
            },
            response
        );
        assert.equal(response.statusCode, 400);
        assert.equal(writes, 0);
    });
});

test("unapproved senders cannot share live location with Private accounts", async () => {
    await withDirectAccessMocks(async () => {
        let writes = 0;
        LiveLocationShare.findOneAndUpdate = async () => {
            writes += 1;
            return {};
        };
        const response = makeResponse();
        await controller.startLiveLocation(
            {
                user: { id: SENDER_ID },
                body: {
                    recipientId: RECIPIENT_ID,
                    durationMinutes: 15,
                    latitude: 23.7,
                    longitude: 90.4
                }
            },
            response
        );
        assert.equal(response.statusCode, 403);
        assert.equal(writes, 0);
    });
});

test("approved followers can start a bounded live share with no location history", async () => {
    await withDirectAccessMocks(
        async () => {
            let update;
            LiveLocationShare.findOneAndUpdate = async (filter, changes) => {
                update = { filter, changes };
                return {
                    _id: SHARE_ID,
                    sender: SENDER_ID,
                    recipient: RECIPIENT_ID,
                    groupId: null,
                    latitude: changes.$set.latitude,
                    longitude: changes.$set.longitude,
                    expiresAt: changes.$set.expiresAt,
                    updatedAt: new Date()
                };
            };
            const response = makeResponse();
            await controller.startLiveLocation(
                {
                    user: { id: SENDER_ID },
                    body: {
                        recipientId: RECIPIENT_ID,
                        durationMinutes: 60,
                        latitude: 23.7,
                        longitude: 90.4
                    },
                    app: { get: () => null }
                },
                response
            );

            assert.equal(response.statusCode, 201);
            assert.deepEqual(update.filter, {
                sender: SENDER_ID,
                recipient: RECIPIENT_ID,
                groupId: null
            });
            assert.equal(update.changes.$set.latitude, 23.7);
            assert.equal(
                update.changes.$set.expiresAt.getTime() -
                    Date.now() <= 60 * 60 * 1000,
                true
            );
            assert.equal(Object.hasOwn(response.body.data, "history"), false);
        },
        { senderFollowing: [RECIPIENT_ID] }
    );
});

test("expired live shares cannot be updated", async () => {
    const originalUpdate = LiveLocationShare.findOneAndUpdate;
    let filter;
    LiveLocationShare.findOneAndUpdate = async currentFilter => {
        filter = currentFilter;
        return null;
    };
    try {
        const response = makeResponse();
        await controller.updateLiveLocation(
            {
                user: { id: SENDER_ID },
                params: { shareId: SHARE_ID },
                body: { latitude: 23.7, longitude: 90.4 }
            },
            response
        );
        assert.equal(response.statusCode, 404);
        assert.equal(filter.expiresAt.$gt instanceof Date, true);
    } finally {
        LiveLocationShare.findOneAndUpdate = originalUpdate;
    }
});

test("location updates overwrite the single current point with reduced precision", async () => {
    await withDirectAccessMocks(
        async () => {
            const originalUpdate = LiveLocationShare.findOneAndUpdate;
            let changes;
            LiveLocationShare.findOneAndUpdate = async (filter, update) => {
                changes = { filter, update };
                return {
                    _id: SHARE_ID,
                    sender: SENDER_ID,
                    recipient: RECIPIENT_ID,
                    groupId: null,
                    latitude: update.$set.latitude,
                    longitude: update.$set.longitude,
                    expiresAt: new Date(Date.now() + 60_000),
                    updatedAt: new Date()
                };
            };

            try {
                const response = makeResponse();
                await controller.updateLiveLocation(
                    {
                        user: { id: SENDER_ID },
                        params: { shareId: SHARE_ID },
                        body: {
                            latitude: 23.7807123,
                            longitude: 90.4071128
                        },
                        app: { get: () => null }
                    },
                    response
                );
                assert.equal(response.statusCode, 200);
                assert.equal(changes.filter.sender, SENDER_ID);
                assert.deepEqual(changes.update, {
                    $set: {
                        latitude: 23.7807,
                        longitude: 90.4071
                    }
                });
                assert.equal(
                    Object.hasOwn(changes.update, "$push"),
                    false
                );
            } finally {
                LiveLocationShare.findOneAndUpdate = originalUpdate;
            }
        },
        { senderFollowing: [RECIPIENT_ID] }
    );
});

test("live location shares have automatic expiry and one record per sender and conversation", () => {
    const indexes = LiveLocationShare.schema.indexes();
    assert.equal(
        indexes.some(([keys, options]) =>
            keys.expiresAt === 1 && options.expireAfterSeconds === 0
        ),
        true
    );
    assert.equal(
        indexes.some(([keys, options]) =>
            keys.sender === 1 &&
            keys.recipient === 1 &&
            keys.groupId === 1 &&
            options.unique === true
        ),
        true
    );
    assert.equal(
        indexes.some(([keys]) =>
            keys.groupId === 1 && keys.sender === 1
        ),
        true
    );
});

test("group live-location reads exclude senders who are no longer members", async () => {
    const originals = {
        groupFindOne: GroupConversation.findOne,
        shareFind: LiveLocationShare.find
    };
    let shareFilter;
    GroupConversation.findOne = () => ({
        select() {
            return this;
        },
        lean: async () => ({
            _id: SHARE_ID,
            participants: [RECIPIENT_ID]
        })
    });
    LiveLocationShare.find = filter => {
        shareFilter = filter;
        return { lean: async () => [] };
    };

    try {
        const response = makeResponse();
        await controller.getLiveLocations(
            {
                user: { id: RECIPIENT_ID },
                query: { groupId: SHARE_ID }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(shareFilter.sender, { $in: [RECIPIENT_ID] });
        assert.equal(shareFilter.groupId, SHARE_ID);
        assert.deepEqual(response.body.data, []);
    } finally {
        GroupConversation.findOne = originals.groupFindOne;
        LiveLocationShare.find = originals.shareFind;
    }
});

test("an active group share is deleted and stopped when its sender loses membership", async () => {
    const originals = {
        groupFindOne: GroupConversation.findOne,
        shareUpdate: LiveLocationShare.findOneAndUpdate,
        shareDelete: LiveLocationShare.deleteOne
    };
    let deletedFilter;
    const events = [];
    GroupConversation.findOne = () => ({
        select() {
            return this;
        },
        lean: async () => ({ participants: [RECIPIENT_ID] })
    });
    LiveLocationShare.findOneAndUpdate = async () => ({
        _id: SHARE_ID,
        sender: SENDER_ID,
        recipient: null,
        groupId: RECIPIENT_ID,
        latitude: 23.7,
        longitude: 90.4,
        expiresAt: new Date(Date.now() + 60_000),
        updatedAt: new Date()
    });
    LiveLocationShare.deleteOne = async filter => {
        deletedFilter = filter;
    };

    try {
        const response = makeResponse();
        await controller.updateLiveLocation(
            {
                user: { id: SENDER_ID },
                params: { shareId: SHARE_ID },
                body: { latitude: 23.8, longitude: 90.5 },
                app: {
                    get: () => ({
                        to: room => ({
                            emit: (event, payload) =>
                                events.push({ room, event, payload })
                        })
                    })
                }
            },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.deepEqual(deletedFilter, { _id: SHARE_ID });
        assert.deepEqual(events, [{
            room: `user:${RECIPIENT_ID}`,
            event: "live-location-stopped",
            payload: { shareId: SHARE_ID }
        }]);
    } finally {
        GroupConversation.findOne = originals.groupFindOne;
        LiveLocationShare.findOneAndUpdate = originals.shareUpdate;
        LiveLocationShare.deleteOne = originals.shareDelete;
    }
});
