const Message = require("../models/Message");


// ==========================
// SEND MESSAGE
// ==========================

exports.sendMessage = async (
    req,
    res
) => {

    try {

        const {
            receiver,
            message
        } = req.body;


        if (
            !receiver ||
            !message ||
            !message.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Receiver and message are required"
            });

        }


        const newMessage =
            await Message.create({

                sender:
                    req.user.id,

                receiver,

                message:
                    message.trim()

            });


        const populatedMessage =
            await Message
                .findById(
                    newMessage._id
                )
                .populate(
                    "sender",
                    "name email role profileImage avatar image"
                )
                .populate(
                    "receiver",
                    "name email role profileImage avatar image"
                );


        res.status(201).json({

            success: true,

            data:
                populatedMessage

        });


    } catch (err) {

        console.error(
            "Send message error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ==========================
// GET CONVERSATION
// ==========================

exports.getConversation = async (
    req,
    res
) => {

    try {

        const otherUserId =
            req.params.userId;


        if (!otherUserId) {

            return res.status(400).json({

                success: false,

                message:
                    "User ID is required"

            });

        }


        const messages =
            await Message
                .find({

                    $or: [

                        {
                            sender:
                                req.user.id,

                            receiver:
                                otherUserId
                        },

                        {
                            sender:
                                otherUserId,

                            receiver:
                                req.user.id
                        }

                    ]

                })
                .sort({
                    createdAt: 1
                })
                .populate(
                    "sender",
                    "name email role profileImage avatar image"
                )
                .populate(
                    "receiver",
                    "name email role profileImage avatar image"
                );


        res.json({

            success: true,

            data:
                messages

        });


    } catch (err) {

        console.error(
            "Get conversation error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ==========================
// MARK MESSAGES SEEN
// ==========================

exports.markSeen = async (
    req,
    res
) => {

    try {

        const otherUserId =
            req.params.userId;


        await Message.updateMany(

            {
                sender:
                    otherUserId,

                receiver:
                    req.user.id,

                isSeen:
                    false
            },

            {
                $set: {
                    isSeen: true
                }
            }

        );


        res.json({

            success: true,

            message:
                "Messages marked as seen"

        });


    } catch (err) {

        console.error(
            "Mark seen error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};
