const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 60
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        privacy: {
            type: String,
            enum: ["public", "private"],
            default: "public",
            index: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        admins: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        members: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        pendingRequests: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },
    { timestamps: true }
);

communitySchema.index({ members: 1, updatedAt: -1 });

module.exports = mongoose.model("Community", communitySchema);
