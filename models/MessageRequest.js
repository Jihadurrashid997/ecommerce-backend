const mongoose = require("mongoose");
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
        fileDeliveryType: {
            type: String,
            enum: ["upload", "private", "authenticated"],
            default: "upload"
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
    {
        timestamps: true,
        toJSON: { transform: transformAttachmentUrl },
        toObject: { transform: transformAttachmentUrl }
    }
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
