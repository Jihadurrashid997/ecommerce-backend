const getId = value => {
    if (value && typeof value === "object") {
        if (value._id !== undefined && value._id !== null) {
            return String(value._id).toLowerCase();
        }
        if (typeof value.toHexString === "function") {
            return value.toHexString().toLowerCase();
        }
        if (value.id !== undefined && value.id !== null) {
            return String(value.id).toLowerCase();
        }
    }

    return String(value || "").toLowerCase();
};

const hasFollowConnection = (firstUser, secondUser) => {
    const firstId = getId(firstUser);
    const secondId = getId(secondUser);

    if (!firstId || !secondId || firstId === secondId) {
        return false;
    }

    const firstFollowsSecond = (firstUser?.following || []).some(
        userId => getId(userId) === secondId
    );
    const secondFollowsFirst = (secondUser?.following || []).some(
        userId => getId(userId) === firstId
    );

    return firstFollowsSecond || secondFollowsFirst;
};

const isBlocked = (user, otherUserId) =>
    (user?.blockedUsers || []).some(
        blockedUserId => getId(blockedUserId) === getId(otherUserId)
    );

const isApprovedFollower = (sender, recipient) =>
    (sender?.following || []).some(
        followedUserId => getId(followedUserId) === getId(recipient?._id)
    );

const evaluateDirectMessagePermission = ({
    sender,
    recipient,
    hasExistingConversation = false
}) => {
    const senderId = getId(sender);
    const recipientId = getId(recipient);
    if (!senderId || !recipientId || senderId === recipientId) {
        return {
            canReadHistory: false,
            canSendMessage: false,
            canCreateRequest: false,
            canCall: false,
            reason: "invalid-participants"
        };
    }

    const blocked =
        isBlocked(sender, recipientId) ||
        isBlocked(recipient, senderId);
    const isExisting = Boolean(hasExistingConversation);
    const recipientIsPrivate = recipient.accountVisibility === "private";
    const approvedFollower = isApprovedFollower(sender, recipient);
    const canInitiate = !recipientIsPrivate || approvedFollower;

    return {
        canReadHistory: isExisting,
        canSendMessage: !blocked && (isExisting || canInitiate),
        canCreateRequest:
            !blocked &&
            !isExisting &&
            recipientIsPrivate &&
            !approvedFollower,
        canCall: !blocked && (isExisting || canInitiate),
        reason: blocked
            ? "blocked"
            : isExisting
                ? "existing-conversation"
                : canInitiate
                    ? approvedFollower && recipientIsPrivate
                        ? "approved-follower"
                        : "public-account"
                    : "message-request-required"
    };
};

const getDirectMessagePermission = async ({
    User,
    Message,
    senderId,
    recipientId,
    senderDocument,
    recipientDocument
}) => {
    if (
        !senderId ||
        !recipientId ||
        getId(senderId) === getId(recipientId)
    ) {
        return evaluateDirectMessagePermission({
            sender: senderId,
            recipient: recipientId
        });
    }

    const [existingConversation, sender, recipient] = await Promise.all([
        Message.exists({
            $or: [
                { sender: senderId, receiver: recipientId },
                { sender: recipientId, receiver: senderId }
            ]
        }),
        senderDocument ||
            User.findById(senderId)
                .select("following blockedUsers accountVisibility")
                .lean(),
        recipientDocument ||
            User.findById(recipientId)
                .select("following blockedUsers accountVisibility")
                .lean()
    ]);

    if (!sender || !recipient) {
        return {
            canReadHistory: false,
            canSendMessage: false,
            canCreateRequest: false,
            canCall: false,
            reason: "user-not-found"
        };
    }

    return evaluateDirectMessagePermission({
        sender,
        recipient,
        hasExistingConversation: Boolean(existingConversation)
    });
};

const canAccessDirectConversation = async options => {
    const permission = await getDirectMessagePermission({
        ...options,
        senderId: options.senderId || options.userId,
        recipientId: options.recipientId || options.peerId,
        senderDocument: options.senderDocument || options.userDocument,
        recipientDocument: options.recipientDocument || options.peerDocument
    });

    return permission.canReadHistory || permission.canSendMessage;
};

const getEligibleConversationPeerIds = ({
    currentUserId,
    users = [],
    existingConversationPeers = [],
    following = []
}) => {
    const currentId = getId(currentUserId);
    const eligibleIds = new Set(
        users
            .filter(user =>
                user.accountVisibility !== "private" ||
                (user.following || []).some(id => getId(id) === currentId)
            )
            .map(user => getId(user._id))
    );

    for (const id of [
        ...existingConversationPeers,
        ...following
    ]) {
        const peerId = getId(id);
        if (peerId && peerId !== currentId) {
            eligibleIds.add(peerId);
        }
    }

    eligibleIds.delete(currentId);
    return [...eligibleIds];
};

module.exports = {
    canAccessDirectConversation,
    evaluateDirectMessagePermission,
    getDirectMessagePermission,
    getEligibleConversationPeerIds,
    hasFollowConnection
};
