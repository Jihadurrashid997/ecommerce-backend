const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        reportedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        messageRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MessageRequest",
            required: true,
            index: true
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        status: {
            type: String,
            enum: ["open", "reviewed", "dismissed"],
            default: "open",
            index: true
        }
    },
    { timestamps: true }
);

userReportSchema.index(
    { reporter: 1, messageRequest: 1 },
    { unique: true }
);

module.exports = mongoose.model("UserReport", userReportSchema);
