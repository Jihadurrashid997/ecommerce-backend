const mongoose = require("mongoose");

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
