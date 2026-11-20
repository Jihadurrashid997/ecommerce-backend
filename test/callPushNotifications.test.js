const assert = require("node:assert/strict");
const test = require("node:test");
const { buildIncomingCallEvent } = require("../services/callPushNotifications");

test("native incoming call payload preserves call identity and routing metadata", () => {
    const event = buildIncomingCallEvent({
        callId: "server-call-id",
        roomId: "caller_receiver",
        callerId: "caller",
        receiverId: "receiver",
        callerName: "Caller",
        callerAvatar: "https://example.com/avatar.png",
        type: "video",
        createdAt: 1
    });

    assert.match(
        event.eventId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.equal(event.serverCallId, "server-call-id");
    assert.equal(event.hasVideo, true);
    assert.equal(event.startedAt, new Date(1).toISOString());
    assert.deepEqual(event.caller, {
        id: "caller",
        displayName: "Caller",
        avatarUrl: "https://example.com/avatar.png"
    });
    assert.deepEqual(event.metadata, {
        roomId: "caller_receiver",
        callerId: "caller",
        receiverId: "receiver",
        callerName: "Caller",
        receiverName: "Messenger contact",
        type: "video"
    });
});
