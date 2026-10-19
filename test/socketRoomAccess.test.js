const assert = require("node:assert/strict");
const test = require("node:test");
const {
    canJoinDirectConversationRoom,
    getDirectRoomParticipants
} = require("../services/socketRoomAccess");

const FIRST_USER = "507f1f77bcf86cd799439011";
const SECOND_USER = "507f191e810c19729de860ea";

test("direct room membership requires a canonical room containing the authenticated user", () => {
    const roomId = [FIRST_USER, SECOND_USER].sort().join("_");

    assert.deepEqual(
        getDirectRoomParticipants(roomId),
        [FIRST_USER, SECOND_USER].sort()
    );
    assert.equal(canJoinDirectConversationRoom(roomId, FIRST_USER), true);
    assert.equal(canJoinDirectConversationRoom(roomId, SECOND_USER), true);
    assert.equal(
        canJoinDirectConversationRoom(
            roomId,
            "507f191e810c19729de860eb"
        ),
        false
    );
});

test("direct room membership rejects malformed, noncanonical, and self rooms", () => {
    assert.equal(getDirectRoomParticipants("some-room"), null);
    assert.equal(
        getDirectRoomParticipants(
            [FIRST_USER, SECOND_USER].sort().reverse().join("_")
        ),
        null
    );
    assert.equal(
        getDirectRoomParticipants(`${FIRST_USER}_${FIRST_USER}`),
        null
    );
    assert.equal(
        canJoinDirectConversationRoom(
            `${FIRST_USER}_${SECOND_USER}`,
            "not-an-object-id"
        ),
        false
    );
});
