const mongoose = require("mongoose");

const LiveLocationShareSchema = new mongoose.Schema(
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
            default: null
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupConversation",
            default: null
        },
        latitude: {
            type: Number,
            required: true,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            required: true,
            min: -180,
            max: 180
        },
        expiresAt: {
            type: Date,
            required: true
        }
    },
    { timestamps: true }
);

LiveLocationShareSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);
LiveLocationShareSchema.index(
    { sender: 1, recipient: 1, groupId: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "LiveLocationShare",
    LiveLocationShareSchema
);
