const mongoose = require("mongoose");

const contentReportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        targetType: {
            type: String,
            enum: ["post", "reel", "community", "profile", "message"],
            required: true,
            index: true
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        targetOwner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 500,
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "resolved", "dismissed"],
            default: "pending",
            index: true
        },
        resolution: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

contentReportSchema.index(
    { reporter: 1, targetType: 1, targetId: 1 },
    { unique: true, partialFilterExpression: { status: "pending" } }
);

module.exports = mongoose.model("ContentReport", contentReportSchema);
