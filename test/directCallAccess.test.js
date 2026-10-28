const assert = require("node:assert/strict");
const test = require("node:test");
const {
    canHandleDirectCall,
    canStartDirectCall,
    getConnectedCallDuration,
    hasBlockedUser,
    isCanonicalDirectCallRoom
} = require("../services/directCallAccess");

const CALLER = "507f1f77bcf86cd799439011";
const RECEIVER = "507f191e810c19729de860ea";
const OTHER_USER = "507f191e810c19729de860eb";
const ROOM_ID = [CALLER, RECEIVER].sort().join("_");
const call = {
    callerId: CALLER,
    receiverId: RECEIVER,
    roomId: ROOM_ID
};

test("direct call start requires authenticated caller and canonical participant room", () => {
    assert.equal(
        canStartDirectCall({
            socketUserId: CALLER,
            callerId: CALLER,
            receiverId: RECEIVER,
            roomId: ROOM_ID
        }),
        true
    );
    assert.equal(
        canStartDirectCall({
            socketUserId: OTHER_USER,
            callerId: CALLER,
            receiverId: RECEIVER,
            roomId: ROOM_ID
        }),
        false
    );
    assert.equal(
        canStartDirectCall({
            socketUserId: CALLER,
            callerId: CALLER,
            receiverId: OTHER_USER,
            roomId: ROOM_ID
        }),
        false
    );
});

test("call signaling is limited to the expected authenticated participant and role", () => {
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: CALLER,
            callerId: CALLER,
            receiverId: RECEIVER,
            role: "caller"
        }),
        true
    );
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: OTHER_USER,
            callerId: CALLER,
            receiverId: RECEIVER,
            role: "caller"
        }),
        false
    );
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: RECEIVER,
            callerId: RECEIVER,
            receiverId: CALLER,
            role: "participant"
        }),
        true
    );
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: OTHER_USER,
            callerId: OTHER_USER,
            receiverId: CALLER,
            role: "participant"
        }),
        false
    );
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: CALLER,
            callerId: CALLER,
            receiverId: RECEIVER,
            role: "receiver"
        }),
        false
    );
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: `${ROOM_ID}_extra`,
            socketUserId: CALLER,
            callerId: CALLER,
            receiverId: RECEIVER
        }),
        false
    );
});

test("only the authenticated receiver can request a direct-call renegotiation", () => {
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: RECEIVER,
            callerId: CALLER,
            receiverId: RECEIVER,
            role: "receiver"
        }),
        true
    );
    assert.equal(
        canHandleDirectCall({
            call,
            roomId: ROOM_ID,
            socketUserId: CALLER,
            callerId: CALLER,
            receiverId: RECEIVER,
            role: "receiver"
        }),
        false
    );
});

test("direct call room validation rejects invalid and self-call participants", () => {
    assert.equal(
        isCanonicalDirectCallRoom(ROOM_ID, CALLER, RECEIVER),
        true
    );
    assert.equal(
        isCanonicalDirectCallRoom(ROOM_ID, CALLER, OTHER_USER),
        false
    );
    assert.equal(
        isCanonicalDirectCallRoom(`${CALLER}_${CALLER}`, CALLER, CALLER),
        false
    );
});

test("block checks handle stored IDs and populated user references", () => {
    assert.equal(
        hasBlockedUser({ blockedUsers: [RECEIVER] }, RECEIVER),
        true
    );
    assert.equal(
        hasBlockedUser({ blockedUsers: [{ _id: RECEIVER }] }, RECEIVER),
        true
    );
    assert.equal(
        hasBlockedUser({ blockedUsers: [OTHER_USER] }, RECEIVER),
        false
    );
});

test("call duration starts at the authoritative connected timestamp, not acceptance", () => {
    assert.equal(getConnectedCallDuration({ acceptedAt: 1000 }, 9000), 0);
    assert.equal(getConnectedCallDuration({ connectedAt: 1000 }, 9000), 8);
    assert.equal(getConnectedCallDuration({ connectedAt: 9000 }, 1000), 0);
});
