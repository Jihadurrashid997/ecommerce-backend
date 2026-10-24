const isObjectId = value =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

const isCanonicalDirectCallRoom = (roomId, callerId, receiverId) => {
    if (
        !isObjectId(callerId) ||
        !isObjectId(receiverId) ||
        callerId.toLowerCase() === receiverId.toLowerCase()
    ) {
        return false;
    }

    const expectedRoom = [callerId, receiverId]
        .map(id => id.toLowerCase())
        .sort()
        .join("_");

    return roomId === expectedRoom;
};

const canStartDirectCall = ({
    socketUserId,
    callerId,
    receiverId,
    roomId
}) =>
    isObjectId(socketUserId) &&
    socketUserId.toLowerCase() === String(callerId || "").toLowerCase() &&
    isCanonicalDirectCallRoom(roomId, callerId, receiverId);

const hasBlockedUser = (user, targetId) => {
    const normalizedTargetId = String(targetId || "").toLowerCase();
    return Boolean(
        normalizedTargetId &&
        (user?.blockedUsers || []).some(blockedUser => {
            const id = blockedUser?._id || blockedUser;
            return String(id).toLowerCase() === normalizedTargetId;
        })
    );
};

const canHandleDirectCall = ({
    call,
    roomId,
    socketUserId,
    callerId,
    receiverId,
    role
}) => {
    if (
        !call ||
        call.roomId !== roomId ||
        !isCanonicalDirectCallRoom(roomId, call.callerId, call.receiverId)
    ) {
        return false;
    }

    const userId = String(socketUserId || "").toLowerCase();
    const eventCallerId = String(callerId || "").toLowerCase();
    const eventReceiverId = String(receiverId || "").toLowerCase();

    if (role === "participant") {
        const expectedParticipants = [
            call.callerId.toLowerCase(),
            call.receiverId.toLowerCase()
        ].sort();
        const eventParticipants = [eventCallerId, eventReceiverId].sort();
        return (
            eventCallerId === userId &&
            eventCallerId !== eventReceiverId &&
            expectedParticipants[0] === eventParticipants[0] &&
            expectedParticipants[1] === eventParticipants[1]
        );
    }

    if (
        eventCallerId !== call.callerId.toLowerCase() ||
        eventReceiverId !== call.receiverId.toLowerCase()
    ) {
        return false;
    }

    if (role === "caller") {
        return userId === call.callerId.toLowerCase();
    }
    if (role === "receiver") {
        return userId === call.receiverId.toLowerCase();
    }
    return (
        userId === call.callerId.toLowerCase() ||
        userId === call.receiverId.toLowerCase()
    );
};

const getConnectedCallDuration = (call, now = Date.now()) => {
    const connectedAt = Number(call?.connectedAt);
    if (!Number.isFinite(connectedAt) || connectedAt <= 0) return 0;
    return Math.max(0, Math.floor((now - connectedAt) / 1000));
};

module.exports = {
    canHandleDirectCall,
    canStartDirectCall,
    getConnectedCallDuration,
    hasBlockedUser,
    isCanonicalDirectCallRoom
};
