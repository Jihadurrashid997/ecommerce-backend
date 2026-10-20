const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const DeviceSession = require("../models/DeviceSession");
const deviceController = require("../controllers/deviceController");

const USER_ID = "507f1f77bcf86cd799439011";
const DEVICE_ID = "c4d9aa49-130c-4755-88c4-327da682a241";
const SESSION_ID = "a4b18d02-2b32-41a7-982c-e20697b28eb1";
const originalFind = DeviceSession.find;
const originalFindOne = DeviceSession.findOne;
const originalFindOneAndUpdate = DeviceSession.findOneAndUpdate;
const originalUpdateOne = DeviceSession.updateOne;
const originalDeleteOne = DeviceSession.deleteOne;
const originalVapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const originalVapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const originalVapidSubject = process.env.VAPID_SUBJECT;

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

test.afterEach(() => {
    DeviceSession.find = originalFind;
    DeviceSession.findOne = originalFindOne;
    DeviceSession.findOneAndUpdate = originalFindOneAndUpdate;
    DeviceSession.updateOne = originalUpdateOne;
    DeviceSession.deleteOne = originalDeleteOne;
    if (originalVapidPublicKey === undefined) {
        delete process.env.VAPID_PUBLIC_KEY;
    } else {
        process.env.VAPID_PUBLIC_KEY = originalVapidPublicKey;
    }
    if (originalVapidPrivateKey === undefined) {
        delete process.env.VAPID_PRIVATE_KEY;
    } else {
        process.env.VAPID_PRIVATE_KEY = originalVapidPrivateKey;
    }
    if (originalVapidSubject === undefined) {
        delete process.env.VAPID_SUBJECT;
    } else {
        process.env.VAPID_SUBJECT = originalVapidSubject;
    }
});

test("device sessions require account, device, active session and complete push keys", () => {
    const session = new DeviceSession({
        user: USER_ID,
        deviceId: DEVICE_ID,
        sessionId: SESSION_ID,
        name: "Chrome on Windows",
        pushSubscription: {
            endpoint: "https://fcm.googleapis.com/push/endpoint",
            keys: { p256dh: "public-key", auth: "auth-key" }
        }
    });
    assert.equal(session.validateSync(), undefined);

    session.pushSubscription.keys.auth = "";
    assert.ok(session.validateSync());
});

test("linked device revocation removes its session and disconnects its socket", async () => {
    const deleted = { deleteOne: async () => {} };
    let connectedDeviceRoom;
    DeviceSession.findOne = filter => {
        if (filter.sessionId) {
            return { select: async () => ({ deviceId: "current-device" }) };
        }
        const target = { ...deleted, sessionId: SESSION_ID };
        return {
            then(resolve, reject) {
                return Promise.resolve(target).then(resolve, reject);
            }
        };
    };
    const io = {
        in(room) {
            connectedDeviceRoom = room;
            return { disconnectSockets: () => {} };
        }
    };
    const res = makeResponse();
    await deviceController.revokeDevice(
        {
            params: { deviceId: DEVICE_ID },
            user: { id: USER_ID, sid: "current-session" },
            app: { get: () => io }
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(connectedDeviceRoom, `device:${SESSION_ID}`);
});

test("the active device cannot be revoked through the linked-device list", async () => {
    DeviceSession.findOne = () => ({
        select: async () => ({ deviceId: DEVICE_ID })
    });
    const res = makeResponse();
    await deviceController.revokeDevice(
        {
            params: { deviceId: DEVICE_ID },
            user: { id: USER_ID, sid: SESSION_ID }
        },
        res
    );

    assert.equal(res.statusCode, 409);
});

test("push subscriptions are saved only to the authenticated active device", async () => {
    process.env.VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
    process.env.VAPID_SUBJECT = "mailto:admin@example.com";
    let filter;
    let update;
    DeviceSession.findOneAndUpdate = async (query, change) => {
        filter = query;
        update = change;
        return { _id: new mongoose.Types.ObjectId() };
    };
    const res = makeResponse();
    await deviceController.savePushSubscription(
        {
            user: { id: USER_ID, sid: SESSION_ID },
            body: {
                subscription: {
                    endpoint: "https://fcm.googleapis.com/push/endpoint",
                    keys: { p256dh: "public-key", auth: "auth-key" }
                }
            }
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter, {
        user: USER_ID,
        sessionId: SESSION_ID
    });
    assert.equal(
        update.$set.pushSubscription.endpoint,
        "https://fcm.googleapis.com/push/endpoint"
    );
});

test("push subscription endpoints reject non-HTTPS targets", async () => {
    const res = makeResponse();
    await deviceController.savePushSubscription(
        {
            user: { id: USER_ID, sid: SESSION_ID },
            body: {
                subscription: {
                    endpoint: "http://127.0.0.1/private",
                    keys: { p256dh: "public-key", auth: "auth-key" }
                }
            }
        },
        res
    );

    assert.equal(res.statusCode, 400);
});
