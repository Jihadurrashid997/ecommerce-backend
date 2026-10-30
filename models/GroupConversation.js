const mongoose = require("mongoose");

const GroupConversationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 80
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        groupPhoto: {
            type: String,
            default: ""
        },
        groupPhotoPublicId: {
            type: String,
            default: ""
        },
        groupPhotoStorageType: {
            type: String,
            enum: ["", "image"],
            default: ""
        },
        groupPhotoType: {
            type: String,
            default: ""
        },
        isEncrypted: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        admins: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        participants: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }],
            validate: {
                validator: members => members.length >= 1 && members.length <= 100,
                message: "A group must have between 1 and 100 members."
            }
        },
        lastMessage: {
            message: {
                type: String,
                default: ""
            },
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null
            },
            createdAt: {
                type: Date,
                default: null
            }
        }
    },
    {
        timestamps: true
    }
);

GroupConversationSchema.index({
    participants: 1,
    updatedAt: -1
});

module.exports = mongoose.model(
    "GroupConversation",
    GroupConversationSchema
);
