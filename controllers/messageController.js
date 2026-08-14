const mongoose = require("mongoose");
const Message = require("../models/Message");

const getUserId = (req) => {
    return req.user?._id || req.user?.id || req.user?.userId || null;
};

const populateMessage = (query) => {
    return query
        .populate(
            "sender",
            "name email role profileImage avatar username"
        )
        .populate(
            "receiver",
            "name email role profileImage avatar username"
        );
};

// ======================================================
// SEND MESSAGE
// ======================================================

exports.sendMessage = async (req, res) => {
    try {
        const sender = getUserId(req);
        const { receiver, message } = req.body;

        const text = String(message || "").trim();

        if (!sender) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!receiver || !text) {
            return res.status(400).json({
                success: false,
                message: "Receiver and message are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(receiver)) {
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

        const newMessage = await Message.create({
            sender,
            receiver,
            message: text,
            isSeen: false
        });

        const populatedMessage = await populateMessage(
            Message.findById(newMessage._id)
        );

        return res.status(201).json({
            success: true,
            data: populatedMessage
        });
    } catch (error) {
        console.error("SEND MESSAGE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send message."
        });
    }
};

// ======================================================
// GET CONVERSATION
// ======================================================

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

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
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
            }).sort({ createdAt: 1 })
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

// ======================================================
// MARK CONVERSATION SEEN
// ======================================================

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

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
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
                    isSeen: true
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
