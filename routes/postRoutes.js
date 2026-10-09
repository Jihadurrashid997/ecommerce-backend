const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
    postUpload,
    reelUpload,
    handle
} = require("../middleware/postUpload");

const {
    createPost,
    createReel,
    getFeed,
    getReels,
    getUserPosts,
    toggleLike,
    getComments,
    addComment,
    addView,
    deletePost
} = require("../controllers/postController");

/*
=========================================================
POSTS & REELS   (mounted at /api/posts)
=========================================================
*/

// Home feed (photo posts)
router.get("/feed", auth(), getFeed);
router.post("/", auth(), handle(postUpload, "photos"), createPost);

// Reels
router.get("/reels", auth(), getReels);
router.post("/reels", auth(), handle(reelUpload, "video"), createReel);

// A user's posts / reels (profile)
router.get("/user/:userId", auth(), getUserPosts);

// Single post actions
router.post("/:id/like", auth(), toggleLike);
router.get("/:id/comments", auth(), getComments);
router.post("/:id/comments", auth(), addComment);
router.post("/:id/view", auth(), addView);
router.delete("/:id", auth(), deletePost);

module.exports = router;
