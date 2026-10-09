const mongoose = require("mongoose");

/*
=========================================================
POST  (used for both Home feed photo posts and Reels)

kind = "post"  -> Home feed. Photos only (1-5 images) + caption.
kind = "reel"  -> Reels. Exactly one video, max 60 seconds.
=========================================================
*/

const commentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        }
    },
    { timestamps: true }
);

const mediaSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true },
        publicId: { type: String, default: "" },
        duration: { type: Number, default: 0 }
    },
    { _id: false }
);

const postSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        kind: {
            type: String,
            enum: ["post", "reel"],
            required: true,
            index: true
        },

        caption: {
            type: String,
            trim: true,
            maxlength: 2200,
            default: ""
        },

        media: {
            type: [mediaSchema],
            validate: v => Array.isArray(v) && v.length > 0
        },

        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        comments: [commentSchema],

        views: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

postSchema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
