const mongoose = require("mongoose");

const PlatformNotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        type: {
            type: String,
            enum: [
                "follow",
                "post",
                "post_like",
                "post_comment",
                "community",
                "announcement",
                "system"
            ],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500
        },
        link: {
            type: String,
            default: "",
            maxlength: 300
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

PlatformNotificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
PlatformNotificationSchema.index({ recipient: 1, readAt: 1 });

module.exports = mongoose.model(
    "PlatformNotification",
    PlatformNotificationSchema
);
