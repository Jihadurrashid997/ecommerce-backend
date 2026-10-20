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

        payoutMethod: {
            type: String,
            trim: true,
            maxlength: 40,
            default: "",
            select: false
        },

        payoutAccount: {
            type: String,
            trim: true,
            maxlength: 120,
            default: "",
            select: false
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

        messengerEncryptionPublicKey: {
            type: String,
            default: "",
            maxlength: 2048,
            select: false
        },

        messengerEncryptionKeyBackup: {
            type: String,
            default: "",
            maxlength: 8192,
            select: false
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

        emailVerified: {
            type: Boolean,
            default: undefined,
            index: true
        },

        emailVerifiedAt: {
            type: Date,
            default: null
        },

        emailVerificationCodeHash: {
            type: String,
            select: false
        },

        emailVerificationExpires: {
            type: Date,
            select: false
        },

        emailVerificationAttempts: {
            type: Number,
            default: 0,
            select: false
        },

        emailVerificationLastSentAt: {
            type: Date,
            select: false
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

        resetPasswordAttempts: {
            type: Number,
            default: 0,
            select: false
        },

        resetPasswordLastSentAt: {
            type: Date,
            select: false
        },

        resetSessionTokenHash: {
            type: String,
            select: false
        },

        resetSessionExpires: {
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
