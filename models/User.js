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
