const mongoose =
    require("mongoose");

const Message =
    require("../models/Message");


// ======================================================
// SEND MESSAGE
// ======================================================

exports.sendMessage = async (
    req,
    res
) => {

    try {

        const {
            receiver,
            message
        } = req.body;


        const text =
            String(
                message || ""
            ).trim();


        if (
            !receiver ||
            !text
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Receiver and message are required"

            });

        }


        if (
            !mongoose.Types.ObjectId.isValid(
                receiver
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid receiver"

            });

        }


        if (
            receiver.toString() ===
            req.user.id.toString()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "You cannot message yourself"

            });

        }


        const newMessage =
            await Message.create({

                sender:
                    req.user.id,

                receiver,

                message:
                    text

            });


        const populatedMessage =
            await Message.findById(
                newMessage._id
            )
            .populate(
                "sender",
                "name email role profileImage"
            )
            .populate(
                "receiver",
                "name email role profileImage"
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

        const otherUserId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
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
            await Message.find({

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
                "name email role profileImage"
            )
            .populate(
                "receiver",
                "name email role profileImage"
            );


        res.status(200).json({

            success: true,

            data:
                messages

        });

    } catch (err) {

        console.error(
            "Conversation error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to load conversation."

        });

    }

};


// ======================================================
// MARK SEEN
// ======================================================

exports.markSeen = async (
    req,
    res
) => {

    try {

        const otherUserId =
            req.params.userId;


        if (
            !mongoose.Types.ObjectId.isValid(
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
                        req.user.id,

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


        res.status(200).json({

            success: true,

            modifiedCount:
                result.modifiedCount || 0

        });

    } catch (err) {

        console.error(
            "Mark seen error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to mark messages as seen."

        });

    }

};
