const getId = value => {
    if (value && typeof value === "object") {
        const id = value._id || value.id;
        if (id !== undefined && id !== null) {
            return String(id).toLowerCase();
        }
    }

    return String(value || "").toLowerCase();
};

const isBlocked = (user, otherUserId) =>
    (user?.blockedUsers || []).some(
        blockedUser => getId(blockedUser) === getId(otherUserId)
    );

const canViewPresence = (
    viewer,
    subject,
    hasExistingConversation = false
) => {
    const viewerId = getId(viewer?._id);
    const subjectId = getId(subject?._id);
    if (!viewerId || !subjectId || viewerId === subjectId) {
        return false;
    }

    if (
        isBlocked(viewer, subjectId) ||
        isBlocked(subject, viewerId)
    ) {
        return false;
    }

    if (subject.accountVisibility !== "private") {
        return true;
    }

    return hasExistingConversation ||
        (viewer.following || []).some(
            followedUser => getId(followedUser) === subjectId
        );
};

const getVisibleOnlineUserIds = ({
    viewerId,
    onlineUserIds = [],
    users = [],
    existingConversationPeers = []
}) => {
    const viewer = users.find(
        user => getId(user._id) === getId(viewerId)
    );
    if (!viewer) {
        return [];
    }

    const online = new Set(onlineUserIds.map(getId));
    const existingPeers = new Set(existingConversationPeers.map(getId));
    return users
        .filter(user =>
            online.has(getId(user._id)) &&
            canViewPresence(
                viewer,
                user,
                existingPeers.has(getId(user._id))
            )
        )
        .map(user => getId(user._id));
};

module.exports = {
    canViewPresence,
    getVisibleOnlineUserIds
};
