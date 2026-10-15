const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const GroupConversation = require("../models/GroupConversation");

const getUserId = (req) => {
    return (
        req.user?._id ||
        req.user?.id ||
        req.user?.userId ||
        null
    );
};

const isValidObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);

const isValidEncryptionPublicKey = key =>
    key &&
    typeof key === "object" &&
    key.kty === "EC" &&
    key.crv === "P-256" &&
    typeof key.x === "string" &&
    /^[A-Za-z0-9_-]{40,50}$/.test(key.x) &&
    typeof key.y === "string" &&
    /^[A-Za-z0-9_-]{40,50}$/.test(key.y) &&
    key.d === undefined;

const canAccessMessage = async (message, userId) => {
    if (message.groupId) {
        return Boolean(await GroupConversation.exists({
            _id: message.groupId,
            participants: userId
        }));
    }

    return [message.sender, message.receiver].some(
        participant =>
            participant &&
            String(participant) === String(userId)
    );
};

const populateMessage = (query) =>
    query
        .populate(
            "sender",
            "name email role profileImage avatar username fullName displayName firstName"
        )
        .populate(
            "receiver",
            "name email role profileImage avatar username fullName displayName firstName"
        )
        .populate({
            path: "replyTo",
            select: "message fileUrl fileName fileType sender createdAt",
            populate: {
                path: "sender",
                select: "name username fullName displayName firstName"
            }
        })
        .populate({
            path: "forwardedFrom",
            select: "message fileUrl fileName fileType sender createdAt",
            populate: {
                path: "sender",
                select: "name username fullName displayName firstName"
            }
        })
        .populate(
            "reactions.user",
            "name username fullName displayName firstName"
        );

exports.saveEncryptionPublicKey = async (req, res) => {
    try {
        const userId = getUserId(req);
        const publicKey = req.body?.publicKey;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!isValidEncryptionPublicKey(publicKey)) {
            return res.status(400).json({
                success: false,
                message: "A valid P-256 public key is required."
            });
        }

        const currentUser = await User.findById(userId)
            .select("+messengerEncryptionPublicKey");

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (currentUser.messengerEncryptionPublicKey) {
            let currentKey;

            try {
                currentKey = JSON.parse(
                    currentUser.messengerEncryptionPublicKey
                );
            } catch (error) {
                console.error("INVALID SAVED ENCRYPTION PUBLIC KEY:", error);
            }

            if (
                !currentKey ||
                currentKey.kty !== publicKey.kty ||
                currentKey.crv !== publicKey.crv ||
                currentKey.x !== publicKey.x ||
                currentKey.y !== publicKey.y
            ) {
                return res.status(409).json({
                    success: false,
                    message: "An encryption key is already registered for this account. Use the original device; replacing the key would make old encrypted messages unreadable."
                });
            }

            return res.json({
                success: true,
                message: "Encryption public key is already registered."
            });
        }

        await User.findByIdAndUpdate(userId, {
            $set: {
                messengerEncryptionPublicKey: JSON.stringify({
                    kty: publicKey.kty,
                    crv: publicKey.crv,
                    x: publicKey.x,
                    y: publicKey.y,
                    ext: true,
                    key_ops: []
                })
            }
        });

        return res.json({
            success: true,
            message: "Encryption public key saved."
        });
    } catch (error) {
        console.error("SAVE ENCRYPTION PUBLIC KEY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to save the encryption public key."
        });
    }
};

exports.getEncryptionPublicKey = async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        if (!getUserId(req)) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!isValidObjectId(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        const user = await User.findById(targetUserId)
            .select("+messengerEncryptionPublicKey")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (!user.messengerEncryptionPublicKey) {
            return res.status(404).json({
                success: false,
                message: "This person has not set up an encryption key yet."
            });
        }

        let publicKey;

        try {
            publicKey = JSON.parse(user.messengerEncryptionPublicKey);
        } catch (error) {
            console.error("INVALID SAVED ENCRYPTION PUBLIC KEY:", error);
            return res.status(500).json({
                success: false,
                message: "The saved encryption key is invalid."
            });
        }

        if (!isValidEncryptionPublicKey(publicKey)) {
            return res.status(500).json({
                success: false,
                message: "The saved encryption key is invalid."
            });
        }

        return res.json({
            success: true,
            data: {
                publicKey: {
                    kty: publicKey.kty,
                    crv: publicKey.crv,
                    x: publicKey.x,
                    y: publicKey.y,
                    ext: true,
                    key_ops: []
                }
            }
        });
    } catch (error) {
        console.error("GET ENCRYPTION PUBLIC KEY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load the encryption public key."
        });
    }
};

/* =========================================================
   SEND MESSAGE
========================================================= */

exports.sendMessage = async (req, res) => {
    try {
        const sender = getUserId(req);
        const receiver = req.body?.receiver;
        const groupId = req.body?.groupId;

        const text = String(
            req.body?.message ?? req.body?.text ?? ""
        ).trim();

        // messageUpload middleware (see routes/messageRoutes.js)
        // puts the uploaded file here when the request came
        // from the chat's attach/image buttons.
        const file = req.file;
        const isEncrypted = req.body?.isEncrypted === true;

        if (!sender) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (groupId) {
            if (isEncrypted) {
                return res.status(400).json({
                    success: false,
                    message: "End-to-end encryption is currently supported for one-to-one text messages only."
                });
            }

            if (!isValidObjectId(groupId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid group ID"
                });
            }

            if (!text && !file) {
                return res.status(400).json({
                    success: false,
                    message: "A message or file is required"
                });
            }

            if (text.length > 5000) {
                return res.status(400).json({
                    success: false,
                    message: "Message is too long"
                });
            }

            const group = await GroupConversation.findOne({
                _id: groupId,
                participants: sender
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: "Group not found"
                });
            }

            const messageData = {
                sender,
                groupId,
                message: text,
                readBy: [sender]
            };

            if (file) {
                messageData.fileUrl = `/uploads/${file.filename}`;
                messageData.fileName = file.originalname;
                messageData.fileType = file.mimetype;
            }

            const replyTo = req.body?.replyTo;

            if (replyTo && isValidObjectId(replyTo)) {
                const original = await Message.exists({
                    _id: replyTo,
                    groupId
                });

                if (original) {
                    messageData.replyTo = replyTo;
                }
            }

            const created = await Message.create(messageData);

            group.lastMessage = {
                message: text || (file ? "Attachment" : ""),
                sender,
                createdAt: created.createdAt
            };
            await group.save();

            const populated = await Message.findById(created._id)
                .populate(
                    "sender",
                    "name email role profileImage avatar username fullName displayName firstName"
                )
                .populate({
                    path: "replyTo",
                    select: "message fileUrl fileName fileType sender createdAt",
                    populate: {
                        path: "sender",
                        select: "name username fullName displayName firstName"
                    }
                })
                .populate(
                    "reactions.user",
                    "name username fullName displayName firstName"
                );

            return res.status(201).json({
                success: true,
                message: "Group message sent successfully",
                data: populated
            });
        }

        const forwardedFromId = req.body?.forwardedFrom;

        let forwardSource = null;

        if (forwardedFromId && isValidObjectId(forwardedFromId)) {

            forwardSource = await Message.findById(forwardedFromId)
                .select("message fileUrl fileName fileType");

        }

        if (!receiver || (!text && !file && !forwardSource)) {
            return res.status(400).json({
                success: false,
                message: "Receiver and a message or file are required"
            });
        }

        if (!isValidObjectId(receiver)) {
            return res.status(400).json({
                success: false,
                message: "Invalid receiver"
            });
        }

        if (String(sender) === String(receiver)) {
            return res.status(400).json({
                success: false,
                message: "You cannot message yourself"
            });
        }

        const [senderDoc, receiverDoc] = await Promise.all([
            User.findById(sender).select("blockedUsers +messengerEncryptionPublicKey"),
            User.findById(receiver).select("blockedUsers +messengerEncryptionPublicKey")
        ]);

        const senderBlockedReceiver =
            (senderDoc?.blockedUsers || [])
                .map(String)
                .includes(String(receiver));

        const receiverBlockedSender =
            (receiverDoc?.blockedUsers || [])
                .map(String)
                .includes(String(sender));

        if (senderBlockedReceiver) {
            return res.status(403).json({
                success: false,
                message: "You have blocked this user. Unblock them to send a message."
            });
        }

        if (receiverBlockedSender) {
            return res.status(403).json({
                success: false,
                message: "You can't send a message to this user."
            });
        }

        if (
            isEncrypted &&
            (
                !text.startsWith("e2ee:v1:") ||
                !/^e2ee:v1:[A-Za-z0-9+/]+=*$/.test(text) ||
                file ||
                forwardSource ||
                !senderDoc?.messengerEncryptionPublicKey ||
                !receiverDoc?.messengerEncryptionPublicKey
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Encrypted messages require valid ciphertext, registered keys for both users, and no attachment or forwarded content."
            });
        }

        if (text.length > 5000) {
            return res.status(400).json({
                success: false,
                message: "Message is too long"
            });
        }

        const messageData = {
            sender,
            receiver,
            message: text,
            isEncrypted,
            isSeen: false
        };

        if (file) {

            messageData.fileUrl = `/uploads/${file.filename}`;
            messageData.fileName = file.originalname;
            messageData.fileType = file.mimetype;

        }

        const replyTo = req.body?.replyTo;

        if (replyTo && isValidObjectId(replyTo)) {

            const original = await Message.exists({
                _id: replyTo,
                $or: [
                    { sender, receiver },
                    { sender: receiver, receiver: sender }
                ]
            });

            if (original) {
                messageData.replyTo = replyTo;
            }

        }

        if (forwardSource) {

            messageData.forwardedFrom = forwardSource._id;

            // Only fill in from the original when the person
            // didn't already type their own text or attach a
            // fresh file - this is what lets "forward" work
            // without re-uploading the file to the server.
            if (!text && !file) {
                messageData.message = forwardSource.message || "";
            }

            if (!file && forwardSource.fileUrl) {
                messageData.fileUrl = forwardSource.fileUrl;
                messageData.fileName = forwardSource.fileName;
                messageData.fileType = forwardSource.fileType;
            }

        }

        const created = await Message.create(messageData);

        const populated = await populateMessage(
            Message.findById(created._id)
        );

        return res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: populated
        });
    } catch (error) {
        console.error("SEND MESSAGE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send message."
        });
    }
};

/* =========================================================
   GET CONVERSATION
========================================================= */

exports.getConversation = async (req, res) => {
    try {
        const currentUser = getUserId(req);
        const otherUserId = req.params.userId;

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!isValidObjectId(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const messages = await populateMessage(
            Message.find({
                $or: [
                    {
                        sender: currentUser,
                        receiver: otherUserId
                    },
                    {
                        sender: otherUserId,
                        receiver: currentUser
                    }
                ]
            })
                .sort({ createdAt: 1 })
                .limit(1000)
        );

        return res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error("GET CONVERSATION ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load conversation."
        });
    }
};

/* =========================================================
   MARK CONVERSATION AS SEEN
========================================================= */

exports.markSeen = async (req, res) => {
    try {
        const currentUser = getUserId(req);
        const otherUserId = req.params.userId;

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!isValidObjectId(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const result = await Message.updateMany(
            {
                sender: otherUserId,
                receiver: currentUser,
                isSeen: false
            },
            {
                $set: {
                    isSeen: true,
                    isDelivered: true
                }
            }
        );

        return res.status(200).json({
            success: true,
            modifiedCount: result.modifiedCount || 0
        });
    } catch (error) {
        console.error("MARK SEEN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to mark messages as seen."
        });
    }
};

/* =========================================================
   TOTAL UNREAD COUNT
========================================================= */

exports.getUnreadCount = async (req, res) => {
    try {
        const currentUser = getUserId(req);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const count = await Message.countDocuments({
            receiver: currentUser,
            isSeen: false
        });

        return res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        console.error("UNREAD COUNT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load unread count."
        });
    }
};

/* =========================================================
   UNREAD COUNT BY USER
========================================================= */

exports.getUnreadByUser = async (req, res) => {
    try {
        const currentUser = getUserId(req);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const rows = await Message.aggregate([
            {
                $match: {
                    receiver: new mongoose.Types.ObjectId(
                        String(currentUser)
                    ),
                    isSeen: false
                }
            },
            {
                $group: {
                    _id: "$sender",
                    count: {
                        $sum: 1
                    }
                }
            }
        ]);

        const unread = {};

        rows.forEach((row) => {
            unread[String(row._id)] = row.count;
        });

        return res.status(200).json({
            success: true,
            unread
        });
    } catch (error) {
        console.error("UNREAD BY USER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load unread messages."
        });
    }
};

/* =========================================================
   GET RECENT CONVERSATIONS
========================================================= */

exports.getRecentConversations = async (req, res) => {
    try {
        const currentUser = getUserId(req);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const messages = await Message.find({
            $or: [
                { sender: currentUser },
                { receiver: currentUser }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(2000)
            .lean();

        const conversationMap = new Map();

        for (const item of messages) {
            const senderId = String(
                item.sender?._id || item.sender || ""
            );

            const receiverId = String(
                item.receiver?._id || item.receiver || ""
            );

            const currentId = String(currentUser);

            const otherUserId =
                senderId === currentId
                    ? receiverId
                    : senderId;

            if (!otherUserId) continue;

            if (otherUserId === currentId) continue;

            // Because messages are already sorted newest first,
            // the first message for a user is their latest message.
            if (!conversationMap.has(otherUserId)) {
                conversationMap.set(otherUserId, {
                    userId: otherUserId,
                    lastMessage: item
                });
            }
        }

        const conversations = Array.from(
            conversationMap.values()
        );

        return res.status(200).json({
            success: true,
            data: conversations
        });

    } catch (error) {
        console.error(
            "GET RECENT CONVERSATIONS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to load recent conversations."
        });
    }
};

/* =========================================================
   REACT TO MESSAGE (toggle)
========================================================= */

exports.reactToMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { emoji } = req.body || {};

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (!isValidObjectId(id) || !emoji) {
            return res.status(400).json({ success: false, message: "Invalid message or emoji" });
        }

        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (!await canAccessMessage(message, userId)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this conversation."
            });
        }

        const existingIndex = message.reactions.findIndex(
            r => String(r.user) === String(userId) && r.emoji === emoji
        );

        if (existingIndex !== -1) {
            // Same emoji already reacted -> remove (toggle off)
            message.reactions.splice(existingIndex, 1);
        } else {
            // Remove any other reaction by this user first (one reaction per user per message)
            message.reactions = message.reactions.filter(
                r => String(r.user) !== String(userId)
            );
            message.reactions.push({ emoji, user: userId });
        }

        await message.save();

        const populated = await populateMessage(Message.findById(id));

        return res.json({ success: true, data: populated });

    } catch (error) {
        console.error("REACT MESSAGE ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to react to message." });
    }
};

/* =========================================================
   EDIT MESSAGE (text only, own messages only)
========================================================= */

exports.editMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const text = String(req.body?.message ?? "").trim();

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (!isValidObjectId(id) || !text) {
            return res.status(400).json({ success: false, message: "Invalid message" });
        }

        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (!await canAccessMessage(message, userId)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this conversation."
            });
        }

        if (String(message.sender) !== String(userId)) {
            return res.status(403).json({ success: false, message: "You can only edit your own messages" });
        }

        if (message.isDeleted) {
            return res.status(400).json({ success: false, message: "Cannot edit a deleted message" });
        }

        const isEncryptedPayload =
            text.startsWith("e2ee:v1:") &&
            /^e2ee:v1:[A-Za-z0-9+/]+=*$/.test(text);

        if (
            (message.isEncrypted || req.body?.isEncrypted === true) &&
            !isEncryptedPayload
        ) {
            return res.status(400).json({
                success: false,
                message: "Encrypted messages must remain encrypted when edited."
            });
        }

        message.message = text;
        message.isEncrypted =
            message.isEncrypted || req.body?.isEncrypted === true;
        message.isEdited = true;

        await message.save();

        const populated = await populateMessage(Message.findById(id));

        return res.json({ success: true, data: populated });

    } catch (error) {
        console.error("EDIT MESSAGE ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to edit message." });
    }
};

/* =========================================================
   DELETE MESSAGE (soft delete, own messages only)
========================================================= */

exports.deleteMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid message" });
        }

        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (!await canAccessMessage(message, userId)) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this conversation."
            });
        }

        if (String(message.sender) !== String(userId)) {
            return res.status(403).json({ success: false, message: "You can only delete your own messages" });
        }

        message.isDeleted = true;
        message.message = "";
        message.fileUrl = "";
        message.fileName = "";
        message.fileType = "";
        message.reactions = [];

        await message.save();

        const populated = await populateMessage(Message.findById(id));

        return res.json({ success: true, data: populated });

    } catch (error) {
        console.error("DELETE MESSAGE ERROR:", error);
        return res.status(500).json({ success: false, message: "Unable to delete message." });
    }
};
