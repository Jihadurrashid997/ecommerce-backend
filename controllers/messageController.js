const mongoose = require("mongoose");

const Message = require("../models/Message");


// ======================================================
// SEND MESSAGE
// ======================================================

exports.sendMessage = async (req, res) => {

    try {

        const {
            receiver,
            message
        } = req.body;


        const sender =
            req.user.id;


        // --------------------------------------
        // VALIDATION
        // --------------------------------------

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


        // --------------------------------------
        // CREATE MESSAGE
        // --------------------------------------

        const newMessage =
            await Message.create({

                sender,

                receiver,

                message:
                    message.trim()

            });


        // --------------------------------------
        // POPULATE USERS
        // --------------------------------------

        const populatedMessage =
            await Message.findById(
                newMessage._id
            )
                .populate(
                    "sender",
                    "_id name email role profileImage"
                )
                .populate(
                    "receiver",
                    "_id name email role profileImage"
                );


        // --------------------------------------
        // RESPONSE
        // --------------------------------------

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



// ======================================================
// GET CONVERSATION
// ======================================================

exports.getConversation = async (
    req,
    res
) => {

    try {

        const currentUserId =
            req.user.id;


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
                            currentUserId,

                        receiver:
                            otherUserId

                    },

                    {
                        sender:
                            otherUserId,

                        receiver:
                            currentUserId

                    }

                ]

            })
                .sort({
                    createdAt: 1
                })
                .populate(
                    "sender",
                    "_id name email role profileImage"
                )
                .populate(
                    "receiver",
                    "_id name email role profileImage"
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



// ======================================================
// MARK SEEN
// ======================================================

exports.markSeen = async (
    req,
    res
) => {

    try {

        const currentUserId =
            req.user.id;


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


        await Message.updateMany(

            {

                sender:
                    otherUserId,

                receiver:
                    currentUserId,

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
