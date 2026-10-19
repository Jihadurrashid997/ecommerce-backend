const mongoose = require("mongoose");

const GroupCallKeyEnvelopeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        iv: {
            type: String,
            required: true,
            match: /^[A-Za-z0-9_-]{16}$/
        },
        wrappedKey: {
            type: String,
            required: true,
            match: /^[A-Za-z0-9_-]{64}$/
        }
    },
    { _id: false }
);

const GroupCallKeySchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupConversation",
            required: true,
            unique: true
        },
        keyId: {
            type: String,
            required: true,
            match: /^[A-Za-z0-9_-]{22}$/
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }],
        envelopes: {
            type: [GroupCallKeyEnvelopeSchema],
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("GroupCallKey", GroupCallKeySchema);
