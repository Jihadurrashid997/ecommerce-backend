const getDirectRoomParticipants = roomId => {
    const match = /^([a-f\d]{24})_([a-f\d]{24})$/i.exec(
        String(roomId || "")
    );

    if (!match) {
        return null;
    }

    const participants = match.slice(1).map(id => id.toLowerCase());

    if (
        participants[0] === participants[1] ||
        participants[0] > participants[1]
    ) {
        return null;
    }

    return participants;
};

const canJoinDirectConversationRoom = (roomId, userId) => {
    const participants = getDirectRoomParticipants(roomId);
    const normalizedUserId = String(userId || "").toLowerCase();

    return Boolean(
        participants &&
        /^[a-f\d]{24}$/.test(normalizedUserId) &&
        participants.includes(normalizedUserId)
    );
};

module.exports = {
    canJoinDirectConversationRoom,
    getDirectRoomParticipants
};
