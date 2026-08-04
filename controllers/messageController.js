const Message = require("../models/Message");

// Send Message
exports.sendMessage = async (req, res) => {
    try {

        const { receiver, message } = req.body;

        if (!receiver || !message) {
            return res.status(400).json({
                success: false,
                message: "Receiver and message are required"
            });
        }

        const newMessage = await Message.create({
            sender: req.user.id,
            receiver,
            message
        });

        res.status(201).json({
            success: true,
            data: newMessage
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

// Get Conversation
exports.getConversation = async (req, res) => {

    try {

        const otherUserId = req.params.userId;

        const messages = await Message.find({

            $or: [

                {
                    sender: req.user.id,
                    receiver: otherUserId
                },

                {
                    sender: otherUserId,
                    receiver: req.user.id
                }

            ]

        })
        .sort({ createdAt: 1 })
        .populate("sender", "name email role")
        .populate("receiver", "name email role");

        res.json({
            success: true,
            data: messages
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// Mark Seen
exports.markSeen = async (req, res) => {

    try {

        await Message.updateMany(
            {
                sender: req.params.userId,
                receiver: req.user.id,
                isSeen: false
            },
            {
                isSeen: true
            }
        );

        res.json({
            success: true,
            message: "Messages marked as seen"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};
