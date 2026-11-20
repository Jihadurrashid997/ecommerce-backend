const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema(
    {
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        adminRole: {
            type: String,
            enum: ["super_admin", "moderator", "support"],
            required: true
        },
        action: {
            type: String,
            required: true,
            maxlength: 100,
            index: true
        },
        targetType: {
            type: String,
            required: true,
            maxlength: 60
        },
        targetId: {
            type: String,
            default: ""
        },
        reason: {
            type: String,
            maxlength: 500,
            default: ""
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
