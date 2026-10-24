const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
    postUpload,
    reelUpload,
    handle
} = require("../middleware/postUpload");
const { validateHomeImageContent } = require("../middleware/imageContentValidation");

const {
    createPost,
    createReel,
    getFeed,
    getCommunityPosts,
    getReels,
    getPost,
    updatePost,
    getSavedPosts,
    setSavedPost,
    repostPost,
    undoRepost,
    getUserPosts,
    toggleLike,
    setReaction,
    getComments,
    addComment,
    deleteComment,
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
router.get("/community/:communityId/feed", auth(), getCommunityPosts);
router.post(
    "/community/:communityId",
    auth(),
    handle(postUpload, "photos"),
    validateHomeImageContent,
    createPost
);
router.post("/", auth(), handle(postUpload, "photos"), validateHomeImageContent, createPost);

// Reels
router.get("/reels", auth(), getReels);
router.post("/reels", auth(), handle(reelUpload, "video"), createReel);

// A user's posts / reels (profile)
router.get("/user/:userId", auth(), getUserPosts);
router.get("/saved", auth(), getSavedPosts);

// Single post actions
router.patch("/:id", auth(), updatePost);
router.get("/:id", auth(), getPost);
router.put("/:id/saved", auth(), setSavedPost);
router.put("/:id/reaction", auth(), setReaction);
router.post("/:id/repost", auth(), repostPost);
router.delete("/:id/repost", auth(), undoRepost);
router.post("/:id/like", auth(), toggleLike);
router.get("/:id/comments", auth(), getComments);
router.post("/:id/comments", auth(), addComment);
router.delete("/:id/comments/:commentId", auth(), deleteComment);
router.post("/:id/view", auth(), addView);
router.delete("/:id", auth(), deletePost);

module.exports = router;
