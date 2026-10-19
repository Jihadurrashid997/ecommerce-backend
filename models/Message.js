const mongoose =
    require("mongoose");


const MessageSchema =
    new mongoose.Schema(

        {

            sender: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true

            },


            receiver: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    function () {

                        return !this.groupId;

                    },

                index:
                    true

            },


            groupId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "GroupConversation",

                default:
                    null,

                index:
                    true,

                validate: {
                    validator: function (value) {
                        return !value || !this.receiver;
                    },
                    message:
                        "A message can belong to either a group or a direct recipient, not both."
                }

            },


            readBy: [
                {
                    type:
                        mongoose.Schema.Types.ObjectId,

                    ref:
                        "User"
                }
            ],


            message: {

                type:
                    String,

                // Only required when there is no
                // file attachment - an image/file
                // sent with no caption is still a
                // valid message.
                required:
                    function () {

                        return !this.fileUrl;

                    },

                trim:
                    true,

                maxlength:
                    5000

            },

            isEncrypted: {
                type: Boolean,
                default: false
            },


            fileUrl: {

                type:
                    String,

                default:
                    ""

            },


            fileName: {

                type:
                    String,

                default:
                    ""

            },


            fileType: {

                type:
                    String,

                default:
                    ""

            },


            isSeen: {

                type:
                    Boolean,

                default:
                    false,

                index:
                    true

            },


            isDelivered: {

                type:
                    Boolean,

                default:
                    false

            },


            replyTo: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Message",

                default:
                    null

            },


            forwardedFrom: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Message",

                default:
                    null

            },

            isForwarded: {
                type: Boolean,
                default: false
            },


            reactions: [
                {

                    emoji: {
                        type: String,
                        required: true
                    },

                    user: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                        required: true
                    }

                }
            ],


            isEdited: {

                type:
                    Boolean,

                default:
                    false

            },


            isDeleted: {

                type:
                    Boolean,

                default:
                    false

            }

        },

        {
            timestamps:
                true
        }

    );


// Fast conversation lookup

MessageSchema.index({
    sender: 1,
    receiver: 1,
    createdAt: 1
});


MessageSchema.index({
    receiver: 1,
    sender: 1,
    createdAt: 1
});

MessageSchema.index({
    groupId: 1,
    createdAt: 1
});

module.exports =
    mongoose.model(
        "Message",
        MessageSchema
    );
