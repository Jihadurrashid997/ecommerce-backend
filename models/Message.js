const mongoose =
    require("mongoose");
const {
    isCloudinaryConfigured,
    getPrivateDownloadUrl
} = require("../services/mediaStorage");

const transformAttachmentUrl = (_document, value) => {
    if (value.filePublicId) {
        value.fileUrl = isCloudinaryConfigured()
            ? getPrivateDownloadUrl(
                value.filePublicId,
                value.fileName,
                {
                    mediaType: value.fileStorageType,
                    mimeType: value.fileType,
                    deliveryType: value.fileDeliveryType || "upload",
                    attachment: value.fileType === "application/pdf"
                }
            )
            : "";
    }
    return value;
};


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
                    128000

            },

            type: {
                type: String,
                enum: ["message", "call-log"],
                default: "message"
            },

            callId: {
                type: String,
                default: undefined,
                unique: true,
                sparse: true
            },

            callType: {
                type: String,
                enum: ["voice", "video"],
                default: undefined
            },

            callStatus: {
                type: String,
                enum: ["ended", "missed", "declined", "busy"],
                default: undefined
            },

            callDuration: {
                type: Number,
                min: 0,
                default: undefined
            },

            callParticipantCount: {
                type: Number,
                min: 1,
                default: undefined
            },

            isEncrypted: {
                type: Boolean,
                default: false
            },

            clientMessageId: {
                type: String,
                maxlength: 80,
                default: undefined
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

            filePublicId: {

                type:
                    String,

                default:
                    ""

            },

            fileStorageType: {

                type:
                    String,

                enum: [
                    "",
                    "image",
                    "video",
                    "audio",
                    "raw"
                ],

                default:
                    ""

            },

            fileDeliveryType: {
                type: String,
                enum: ["upload", "private", "authenticated"],
                default: "upload"
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

            },

            deletedFor: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }],

        },

        {
            timestamps:
                true,
            toJSON: {
                transform: transformAttachmentUrl
            },
            toObject: {
                transform: transformAttachmentUrl
            }
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

MessageSchema.index(
    { sender: 1, clientMessageId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            clientMessageId: { $type: "string" }
        }
    }
);

module.exports =
    mongoose.model(
        "Message",
        MessageSchema
    );
