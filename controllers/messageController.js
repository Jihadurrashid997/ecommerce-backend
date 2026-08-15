const mongoose = require("mongoose");
const Message = require("../models/Message");

const getUserId = (req) => {
    return (
        req.user?._id ||
        req.user?.id ||
        req.user?.userId ||
        null
    );
};

const populateMessage = (query) => {
    return query
        .populate(
            "sender",
            "name email role profileImage avatar username fullName displayName firstName"
        )
        .populate(
            "receiver",
            "name email role profileImage avatar username fullName displayName firstName"
        );
};

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};


// ======================================================
// SEND MESSAGE
// ======================================================

exports.sendMessage = async (req, res) => {

    try {

        const sender = getUserId(req);

        const receiver =
            req.body?.receiver;

        const text =
            String(
                req.body?.message || ""
            ).trim();

        if (!sender) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication required"
            });

        }

        if (!receiver || !text) {

            return res.status(400).json({
                success: false,
                message:
                    "Receiver and message are required"
            });

        }

        if (!isValidObjectId(receiver)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid receiver"
            });

        }

        if (
            String(sender) ===
            String(receiver)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "You cannot message yourself"
            });

        }

        if (text.length > 5000) {

            return res.status(400).json({
                success: false,
                message:
                    "Message is too long"
            });

        }

        const created =
            await Message.create({
                sender,
                receiver,
                message: text,
                isSeen: false
            });

        const populated =
            await populateMessage(
                Message.findById(
                    created._id
                )
            );

        return res.status(201).json({
            success: true,
            message:
                "Message sent successfully",
            data: populated
        });

    } catch (error) {

        console.error(
            "SEND MESSAGE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to send message."
        });

    }

};


// ======================================================
// GET CONVERSATION
// ======================================================

exports.getConversation = async (
    req,
    res
) => {

    try {

        const currentUser =
            getUserId(req);

        const otherUserId =
            req.params.userId;

        if (!currentUser) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication required"
            });

        }

        if (
            !isValidObjectId(
                otherUserId
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid user ID"
            });

        }

        const messages =
            await populateMessage(
                Message.find({
                    $or: [
                        {
                            sender:
                                currentUser,
                            receiver:
                                otherUserId
                        },
                        {
                            sender:
                                otherUserId,
                            receiver:
                                currentUser
                        }
                    ]
                })
                    .sort({
                        createdAt: 1
                    })
                    .limit(1000)
            );

        return res.status(200).json({
            success: true,
            data: messages
        });

    } catch (error) {

        console.error(
            "GET CONVERSATION ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load conversation."
        });

    }

};


// ======================================================
// MARK CONVERSATION SEEN
// ======================================================

exports.markSeen = async (
    req,
    res
) => {

    try {

        const currentUser =
            getUserId(req);

        const otherUserId =
            req.params.userId;

        if (!currentUser) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication required"
            });

        }

        if (
            !isValidObjectId(
                otherUserId
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid user ID"
            });

        }

        const result =
            await Message.updateMany(
                {
                    sender:
                        otherUserId,

                    receiver:
                        currentUser,

                    isSeen:
                        false
                },
                {
                    $set: {
                        isSeen:
                            true
                    }
                }
            );

        return res.status(200).json({
            success: true,
            modifiedCount:
                result.modifiedCount || 0
        });

    } catch (error) {

        console.error(
            "MARK SEEN ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to mark messages as seen."
        });

    }

};


// ======================================================
// UNREAD MESSAGE COUNT
// ======================================================

exports.getUnreadCount = async (
    req,
    res
) => {

    try {

        const currentUser =
            getUserId(req);

        if (!currentUser) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication required"
            });

        }

        const count =
            await Message.countDocuments({
                receiver:
                    currentUser,

                isSeen:
                    false
            });

        return res.status(200).json({
            success: true,
            count
        });

    } catch (error) {

        console.error(
            "UNREAD COUNT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load unread count."
        });

    }

};


// ======================================================
// UNREAD COUNT BY USER
// ======================================================

exports.getUnreadByUser = async (
    req,
    res
) => {

    try {

        const currentUser =
            getUserId(req);

        if (!currentUser) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication required"
            });

        }

        const rows =
            await Message.aggregate([
                {
                    $match: {
                        receiver:
                            new mongoose.Types.ObjectId(
                                currentUser
                            ),
                        isSeen:
                            false
                    }
                },
                {
                    $group: {
                        _id:
                            "$sender",
                        count:
                            {
                                $sum: 1
                            }
                    }
                }
            ]);

        const unread = {};

        rows.forEach(
            (row) => {

                unread[
                    String(row._id)
                ] = row.count;

            }
        );

        return res.status(200).json({
            success: true,
            unread
        });

    } catch (error) {

        console.error(
            "UNREAD BY USER ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load unread messages."
        });

    }

};
