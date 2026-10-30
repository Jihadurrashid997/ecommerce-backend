const mongoose = require("mongoose");
const Message = require("../models/Message");
const MessageRequest = require("../models/MessageRequest");
const User = require("../models/User");
const UserReport = require("../models/UserReport");
const { getMessageRequestConfig } = require("../config/messageRequests");
const { saveFile, deleteFile } = require("../services/mediaStorage");
const {
    evaluateDirectMessagePermission,
    getDirectMessagePermission
} = require("../services/messengerConversationAccess");

const getUserId = req =>
    req.user?._id || req.user?.id || req.user?.userId || null;

const isValidObjectId = id => mongoose.Types.ObjectId.isValid(id);

const isValidEncryptedText = text =>
    text.startsWith("e2ee:v1:") &&
    /^e2ee:v1:[A-Za-z0-9+/]+=*$/.test(text);

const getRecentAttemptExpression = cutoff => ({
    $filter: {
        input: { $ifNull: ["$messageRequestAttempts", []] },
        as: "attempt",
        cond: { $gt: ["$$attempt", cutoff] }
    }
});

const clearRequestContent = {
    $unset: {
        message: "",
        isEncrypted: "",
        fileUrl: "",
        fileName: "",
        fileType: "",
        filePublicId: "",
        fileStorageType: ""
    }
};

const mediaFromRequest = request => ({
    url: request.fileUrl,
    publicId: request.filePublicId,
    type: request.fileStorageType
});

const removeRequestMedia = async request => {
    if (!request?.fileUrl && !request?.filePublicId) {
        return;
    }

    const removed = await deleteFile(mediaFromRequest(request));
    if (!removed) {
        console.error("Message request attachment cleanup failed.", {
            requestId: String(request._id)
        });
    }
};

exports.createMessageRequest = async (req, res) => {
    let uploadedMedia;
    try {
        const senderId = getUserId(req);
        const recipientId = req.body?.receiver;
        const text = String(req.body?.message ?? req.body?.text ?? "").trim();
        const file = req.file;
        const isEncrypted =
            req.body?.isEncrypted === true ||
            req.body?.isEncrypted === "true";

        if (!senderId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }
        if (!isValidObjectId(recipientId) || String(senderId) === String(recipientId)) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid recipient."
            });
        }
        if (!text && !file) {
            return res.status(400).json({
                success: false,
                message: "A message or attachment is required."
            });
        }
        if (text.length > 5000) {
            return res.status(400).json({
                success: false,
                message: "Message is too long."
            });
        }
        if (isEncrypted && !isValidEncryptedText(text)) {
            return res.status(400).json({
                success: false,
                message: "A valid encrypted message is required."
            });
        }
        if (
            file &&
            (isEncrypted
                ? file.mimetype !== "application/octet-stream"
                : file.mimetype === "application/octet-stream")
        ) {
            return res.status(400).json({
                success: false,
                message: "Encrypted attachments must be opaque client-encrypted files."
            });
        }

        const permission = await getDirectMessagePermission({
            User,
            Message,
            senderId,
            recipientId
        });
        if (permission.reason === "blocked") {
            return res.status(403).json({
                success: false,
                message: "You cannot contact this user."
            });
        }
        if (permission.reason === "user-not-found") {
            return res.status(404).json({
                success: false,
                message: "Recipient not found."
            });
        }
        if (!permission.canCreateRequest) {
            return res.status(409).json({
                success: false,
                message: permission.canSendMessage
                    ? "This account accepts direct messages. Start a conversation instead."
                    : "A request cannot be created for this conversation."
            });
        }

        const { maxPer24Hours, deleteCooldownDays } = getMessageRequestConfig();
        const now = new Date();
        const cooldownStart = new Date(
            now.getTime() - deleteCooldownDays * 24 * 60 * 60 * 1000
        );
        const [pendingRequest, recentlyDeletedRequest] = await Promise.all([
            MessageRequest.exists({
                sender: senderId,
                recipient: recipientId,
                status: "pending"
            }),
            MessageRequest.exists({
                sender: senderId,
                recipient: recipientId,
                status: "deleted",
                deletedAt: { $gte: cooldownStart }
            })
        ]);
        if (pendingRequest) {
            return res.status(409).json({
                success: false,
                message: "A message request is already pending."
            });
        }
        if (recentlyDeletedRequest) {
            return res.status(429).json({
                success: false,
                message: "You cannot send another request to this user yet."
            });
        }

        if (isEncrypted) {
            const [sender, recipient] = await Promise.all([
                User.findById(senderId)
                    .select("+messengerEncryptionPublicKey")
                    .lean(),
                User.findById(recipientId)
                    .select("+messengerEncryptionPublicKey")
                    .lean()
            ]);
            if (
                !sender?.messengerEncryptionPublicKey ||
                !recipient?.messengerEncryptionPublicKey
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Encrypted requests require registered encryption keys for both users."
                });
            }
        }

        if (file) {
            uploadedMedia = await saveFile(file, "etop/messenger-requests");
        }

        const session = await mongoose.startSession();
        let result;
        try {
            await session.withTransaction(async () => {
                result = undefined;
                const pending = await MessageRequest.exists({
                    sender: senderId,
                    recipient: recipientId,
                    status: "pending"
                }).session(session);
                if (pending) {
                    result = "pending";
                    return;
                }

                const deleted = await MessageRequest.exists({
                    sender: senderId,
                    recipient: recipientId,
                    status: "deleted",
                    deletedAt: { $gte: cooldownStart }
                }).session(session);
                if (deleted) {
                    result = "cooldown";
                    return;
                }

                const [sender, recipient, existingConversation] =
                    await Promise.all([
                        User.findById(senderId)
                            .select("following blockedUsers accountVisibility")
                            .session(session)
                            .lean(),
                        User.findById(recipientId)
                            .select("following blockedUsers accountVisibility")
                            .session(session)
                            .lean(),
                        Message.exists({
                            $or: [
                                { sender: senderId, receiver: recipientId },
                                { sender: recipientId, receiver: senderId }
                            ]
                        }).session(session)
                    ]);
                const currentPermission = evaluateDirectMessagePermission({
                    sender,
                    recipient,
                    hasExistingConversation: Boolean(existingConversation)
                });
                if (!currentPermission.canCreateRequest) {
                    result = "permission-changed";
                    return;
                }

                const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const recentAttempts = getRecentAttemptExpression(cutoff);
                const rateReservation = await User.findOneAndUpdate(
                    {
                        _id: senderId,
                        $expr: {
                            $lt: [
                                { $size: recentAttempts },
                                maxPer24Hours
                            ]
                        }
                    },
                    [
                        {
                            $set: {
                                messageRequestAttempts: {
                                    $concatArrays: [recentAttempts, [now]]
                                }
                            }
                        }
                    ],
                    {
                        new: true,
                        session
                    }
                );
                if (!rateReservation) {
                    result = "rate-limited";
                    return;
                }

                const requestDocument = {
                    sender: senderId,
                    recipient: recipientId,
                    message: text,
                    isEncrypted,
                    ...(uploadedMedia
                        ? {
                              fileUrl: uploadedMedia.url,
                              fileName: file.originalname || "",
                              fileType: file.mimetype || "",
                              filePublicId: uploadedMedia.publicId,
                              fileStorageType: uploadedMedia.type
                          }
                        : {})
                };
                const [created] = await MessageRequest.create(
                    [requestDocument],
                    { session }
                );
                result = created;
            });
        } finally {
            await session.endSession();
        }

        if (result === "pending") {
            await removeRequestMedia({
                _id: "duplicate",
                fileUrl: uploadedMedia?.url,
                filePublicId: uploadedMedia?.publicId,
                fileStorageType: uploadedMedia?.type
            });
            uploadedMedia = null;
            return res.status(409).json({
                success: false,
                message: "A message request is already pending."
            });
        }
        if (result === "cooldown") {
            await removeRequestMedia({
                _id: "cooldown",
                fileUrl: uploadedMedia?.url,
                filePublicId: uploadedMedia?.publicId,
                fileStorageType: uploadedMedia?.type
            });
            uploadedMedia = null;
            return res.status(429).json({
                success: false,
                message: "You cannot send another request to this user yet."
            });
        }
        if (result === "permission-changed") {
            await removeRequestMedia({
                _id: "permission-changed",
                fileUrl: uploadedMedia?.url,
                filePublicId: uploadedMedia?.publicId,
                fileStorageType: uploadedMedia?.type
            });
            uploadedMedia = null;
            return res.status(409).json({
                success: false,
                message: "Messaging permissions changed. Refresh the account and try again."
            });
        }
        if (result === "rate-limited") {
            await removeRequestMedia({
                _id: "rate-limit",
                fileUrl: uploadedMedia?.url,
                filePublicId: uploadedMedia?.publicId,
                fileStorageType: uploadedMedia?.type
            });
            uploadedMedia = null;
            return res.status(429).json({
                success: false,
                message: "You have reached the daily Message Request limit."
            });
        }

        uploadedMedia = null;
        return res.status(201).json({
            success: true,
            data: {
                _id: String(result._id),
                status: result.status,
                createdAt: result.createdAt
            }
        });
    } catch (error) {
        if (uploadedMedia) {
            await removeRequestMedia({
                _id: "failed-create",
                fileUrl: uploadedMedia.url,
                filePublicId: uploadedMedia.publicId,
                fileStorageType: uploadedMedia.type
            });
        }
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A message request is already pending."
            });
        }
        console.error("CREATE MESSAGE REQUEST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not create the message request."
        });
    }
};

exports.getMessageRequests = async (req, res) => {
    try {
        const recipientId = getUserId(req);
        const requests = await MessageRequest.find({
            recipient: recipientId,
            status: "pending"
        })
            .select("message isEncrypted fileName fileType createdAt sender")
            .populate("sender", "name profileImage avatar image")
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            requests: requests.map(request => ({
                _id: String(request._id),
                sender: request.sender
                    ? {
                          _id: String(request.sender._id),
                          name: request.sender.name || "",
                          profileImage:
                              request.sender.profileImage ||
                              request.sender.avatar ||
                              request.sender.image ||
                              ""
                      }
                    : null,
                message: request.message || "",
                isEncrypted: Boolean(request.isEncrypted),
                fileName: request.fileName || "",
                fileType: request.fileType || "",
                createdAt: request.createdAt
            })).filter(request => request.sender)
        });
    } catch (error) {
        console.error("GET MESSAGE REQUESTS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load Message Requests."
        });
    }
};

exports.acceptMessageRequest = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid Message Request."
        });
    }

    const recipientId = getUserId(req);
    const session = await mongoose.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            result = undefined;
            const request = await MessageRequest.findOneAndUpdate(
                {
                    _id: req.params.id,
                    recipient: recipientId,
                    status: "pending"
                },
                {
                    $set: {
                        status: "accepted",
                        acceptedAt: new Date()
                    }
                },
                {
                    new: false,
                    session
                }
            ).lean();

            if (!request) {
                result = "not-found";
                return;
            }

            const [sender, recipient] = await Promise.all([
                User.findById(request.sender)
                    .select("blockedUsers")
                    .session(session)
                    .lean(),
                User.findById(recipientId)
                    .select("blockedUsers")
                    .session(session)
                    .lean()
            ]);
            const blocked =
                !sender ||
                !recipient ||
                (sender.blockedUsers || []).some(
                    id => String(id) === String(recipientId)
                ) ||
                (recipient.blockedUsers || []).some(
                    id => String(id) === String(request.sender)
                );
            if (blocked) {
                await MessageRequest.updateOne(
                    { _id: request._id, status: "accepted" },
                    { $set: { status: "pending", acceptedAt: null } },
                    { session }
                );
                result = "blocked";
                return;
            }

            const messageDocument = {
                sender: request.sender,
                receiver: recipientId,
                message: request.message,
                isEncrypted: request.isEncrypted,
                isSeen: false,
                isDelivered: true,
                readBy: [request.sender],
                createdAt: request.createdAt,
                fileUrl: request.fileUrl,
                fileName: request.fileName,
                fileType: request.fileType,
                filePublicId: request.filePublicId,
                fileStorageType: request.fileStorageType
            };
            const [created] = await Message.create(
                [messageDocument],
                { session }
            );
            result = created;
        });

        if (result === "not-found") {
            return res.status(404).json({
                success: false,
                message: "Pending Message Request not found."
            });
        }
        if (result === "blocked") {
            return res.status(403).json({
                success: false,
                message: "This user is blocked."
            });
        }

        const refreshPresence = req.app?.get("refreshPresence");
        if (typeof refreshPresence === "function") {
            Promise.resolve(refreshPresence()).catch(error => {
                console.error("Refresh Messenger presence after acceptance error:", error);
            });
        }

        const roomId = [String(result.sender), String(result.receiver)]
            .sort()
            .join("_");
        const serialized = {
            ...result.toObject(),
            _id: String(result._id),
            id: String(result._id),
            senderId: String(result.sender),
            receiverId: String(result.receiver),
            roomId,
            timestamp: new Date(result.createdAt).getTime()
        };
        const io = req.app?.get("io");
        if (io) {
            io.to(roomId).emit("receive-message", serialized);
            io.to(`user:${String(result.sender)}`).emit("direct-message", serialized);
            io.to(`user:${String(result.sender)}`).emit("message-request-accepted", {
                requestId: String(req.params.id),
                conversationId: roomId
            });
        }
        return res.json({
            success: true,
            data: serialized
        });
    } catch (error) {
        console.error("ACCEPT MESSAGE REQUEST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not accept this Message Request."
        });
    } finally {
        await session.endSession();
    }
};

exports.deleteMessageRequest = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid Message Request."
        });
    }

    try {
        const request = await MessageRequest.findOneAndUpdate(
            {
                _id: req.params.id,
                recipient: getUserId(req),
                status: "pending"
            },
            {
                $set: {
                    status: "deleted",
                    deletedAt: new Date()
                },
                ...clearRequestContent
            },
            { new: false }
        );
        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Pending Message Request not found."
            });
        }

        await removeRequestMedia(request);
        return res.json({ success: true });
    } catch (error) {
        console.error("DELETE MESSAGE REQUEST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not delete this Message Request."
        });
    }
};

exports.blockMessageRequestSender = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid Message Request."
        });
    }

    const recipientId = getUserId(req);
    const session = await mongoose.startSession();
    let request;
    try {
        await session.withTransaction(async () => {
            request = undefined;
            request = await MessageRequest.findOneAndUpdate(
                {
                    _id: req.params.id,
                    recipient: recipientId,
                    status: "pending"
                },
                {
                    $set: { status: "blocked" },
                    ...clearRequestContent
                },
                { new: false, session }
            ).lean();
            if (!request) return;

            await User.updateOne(
                { _id: recipientId },
                { $addToSet: { blockedUsers: request.sender } },
                { session }
            );
        });
        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Pending Message Request not found."
            });
        }

        await removeRequestMedia(request);
        const refreshPresence = req.app?.get("refreshPresence");
        if (typeof refreshPresence === "function") {
            Promise.resolve(refreshPresence()).catch(error => {
                console.error("Refresh Messenger presence after block error:", error);
            });
        }
        return res.json({ success: true });
    } catch (error) {
        console.error("BLOCK MESSAGE REQUEST SENDER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not block this user."
        });
    } finally {
        await session.endSession();
    }
};

exports.reportMessageRequest = async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid Message Request."
        });
    }

    const reason = String(req.body?.reason || "").trim();
    if (reason.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Report reason must be 500 characters or fewer."
        });
    }

    try {
        const request = await MessageRequest.findOne({
            _id: req.params.id,
            recipient: getUserId(req),
            status: "pending"
        }).select("_id sender");
        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Pending Message Request not found."
            });
        }

        await UserReport.create({
            reporter: getUserId(req),
            reportedUser: request.sender,
            messageRequest: request._id,
            reason
        });
        return res.status(201).json({ success: true });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already reported this request."
            });
        }
        console.error("REPORT MESSAGE REQUEST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not report this Message Request."
        });
    }
};
