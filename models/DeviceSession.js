const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
    {
        endpoint: { type: String, required: true, maxlength: 2048 },
        expirationTime: { type: Number, default: null },
        keys: {
            p256dh: { type: String, required: true, maxlength: 256 },
            auth: { type: String, required: true, maxlength: 128 }
        }
    },
    { _id: false }
);

const deviceSessionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        deviceId: {
            type: String,
            required: true,
            minlength: 16,
            maxlength: 80
        },
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            maxlength: 100
        },
        lastActiveAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        pushSubscription: {
            type: pushSubscriptionSchema,
            default: undefined
        }
    },
    { timestamps: true }
);

deviceSessionSchema.index(
    { user: 1, deviceId: 1 },
    { unique: true }
);

module.exports = mongoose.model("DeviceSession", deviceSessionSchema);
