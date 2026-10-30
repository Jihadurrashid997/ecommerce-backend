const mongoose = require("mongoose");

const messageRequestSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        message: {
            type: String,
            trim: true,
            maxlength: 5000,
            default: ""
        },
        isEncrypted: {
            type: Boolean,
            default: false
        },
        fileUrl: {
            type: String,
            default: ""
        },
        fileName: {
            type: String,
            default: ""
        },
        fileType: {
            type: String,
            default: ""
        },
        filePublicId: {
            type: String,
            default: ""
        },
        fileStorageType: {
            type: String,
            enum: ["", "image", "video", "audio", "raw"],
            default: ""
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "deleted", "blocked"],
            default: "pending",
            index: true
        },
        acceptedAt: {
            type: Date,
            default: null
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true
        }
    },
    { timestamps: true }
);

messageRequestSchema.index(
    { sender: 1, recipient: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "pending" }
    }
);
messageRequestSchema.index({ recipient: 1, status: 1, createdAt: -1 });
messageRequestSchema.index({ sender: 1, recipient: 1, status: 1, deletedAt: -1 });

module.exports = mongoose.model("MessageRequest", messageRequestSchema);
