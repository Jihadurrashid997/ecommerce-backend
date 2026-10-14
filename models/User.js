const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        role: {
            type: String,
            enum: [
                "customer",
                "seller",
                "admin"
            ],
            default: "customer"
        },

        // ==========================
        // PROFILE INFORMATION
        // ==========================

        bio: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500
        },

        location: {
            type: String,
            default: "",
            trim: true
        },

        profileImage: {
            type: String,
            default: ""
        },

        profileImagePublicId: {
            type: String,
            default: "",
            select: false
        },

        profileImageType: {
            type: String,
            default: "",
            select: false
        },

        isVerified: {
            type: Boolean,
            default: false,
            index: true
        },

        verifiedAt: {
            type: Date,
            default: null
        },

        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        // ==========================
        // PRESENCE
        // ==========================

        lastSeen: {
            type: Date,
            default: Date.now
        },

        // ==========================
        // PASSWORD RESET
        // ==========================

        resetPasswordToken: {
            type: String,
            select: false
        },

        resetPasswordExpires: {
            type: Date,
            select: false
        },

        // ==========================
        // BLOCKING
        // ==========================

        // ==========================
        // ADMIN MODERATION
        // ==========================

        isSuspended: {
            type: Boolean,
            default: false,
            index: true
        },

        suspendedReason: {
            type: String,
            default: ""
        },

        suspendedAt: {
            type: Date
        },

        // people this user follows (followers = users whose
        // `following` contains this user's id)
        following: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                index: true
            }
        ],

        blockedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ]

    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "User",
    userSchema
);
