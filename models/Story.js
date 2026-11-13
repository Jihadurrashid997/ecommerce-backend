const mongoose = require("mongoose");

const pollSchema = new mongoose.Schema(
    {
        question: { type: String, trim: true, maxlength: 120, required: true },
        options: {
            type: [{
                text: { type: String, trim: true, maxlength: 60, required: true }
            }],
            validate: {
                validator: options => options.length >= 2 && options.length <= 4,
                message: "A poll needs 2–4 options."
            }
        },
        votes: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            optionIndex: { type: Number, min: 0, max: 3, required: true }
        }]
    },
    { _id: false }
);

const storySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        text: {
            type: String,
            trim: true,
            maxlength: 700,
            default: "",
            validate: {
                validator(value) {
                    return Boolean(value?.trim() || this.media?.url);
                },
                message: "A status needs text or media."
            }
        },
        media: {
            url: { type: String, default: "" },
            type: {
                type: String,
                enum: ["", "image", "video"],
                default: ""
            },
            publicId: { type: String, default: "" }
        },
        audio: {
            url: { type: String, default: "" },
            type: { type: String, enum: ["", "audio"], default: "" },
            publicId: { type: String, default: "" },
            title: { type: String, trim: true, maxlength: 100, default: "" },
            startSeconds: { type: Number, min: 0, default: 0 },
            durationSeconds: { type: Number, min: 0, max: 15, default: 0 }
        },
        poll: { type: pollSchema, default: undefined },
        audience: {
            type: String,
            enum: ["followers", "public"],
            default: "followers",
            index: true
        },
        viewers: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },
                viewedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        expiresAt: {
            type: Date,
            required: true,
            index: true
        }
    },
    { timestamps: true }
);

storySchema.index({ expiresAt: 1, owner: 1 });

module.exports = mongoose.model("Story", storySchema);
