const mongoose = require("mongoose");
const Post = require("../models/Post");
const { saveFile, deleteFile } = require("../services/mediaStorage");

const AUTHOR_FIELDS = "name username profileImage avatar role";

const isId = id => mongoose.Types.ObjectId.isValid(id);

/*
 * Shapes a lean Post for the client:
 *  - never ships the whole likes array (could be huge)
 *  - adds likeCount / commentCount / likedByMe
 */
const shape = (post, userId) => {

    const likes = post.likes || [];

    return {
        _id: post._id,
        kind: post.kind,
        author: post.author,
        caption: post.caption,
        media: post.media,
        views: post.views || 0,
        likeCount: likes.length,
        commentCount: (post.comments || []).length,
        likedByMe: likes.some(id => String(id) === String(userId)),
        createdAt: post.createdAt
    };

};

const listQuery = async (filter, req) => {

    const limit = Math.min(Number(req.query.limit) || 10, 30);

    const before = req.query.before
        ? new Date(req.query.before)
        : null;

    if (before && !Number.isNaN(before.getTime())) {
        filter.createdAt = { $lt: before };
    }

    const posts = await Post.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate("author", AUTHOR_FIELDS)
        .lean();

    const hasMore = posts.length > limit;

    const page = posts.slice(0, limit);

    return {
        success: true,
        data: page.map(p => shape(p, req.user.id)),
        nextCursor:
            hasMore
                ? page[page.length - 1].createdAt
                : null
    };

};

/* ------------------------------ CREATE POST (photos) */

exports.createPost = async (req, res) => {

    try {

        const files = req.files || [];

        if (files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please add at least one photo."
            });
        }

        const media = [];

        for (const file of files) {
            media.push(await saveFile(file, "etop/posts"));
        }

        const post = await Post.create({
            author: req.user.id,
            kind: "post",
            caption: String(req.body?.caption || "").slice(0, 2200),
            media
        });

        const populated = await Post.findById(post._id)
            .populate("author", AUTHOR_FIELDS)
            .lean();

        return res.status(201).json({
            success: true,
            data: shape(populated, req.user.id)
        });

    } catch (error) {

        console.error("CREATE POST ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Could not publish your post."
        });

    }

};

/* ------------------------------ CREATE REEL (1 video, max 60s) */

const MAX_REEL_SECONDS = 60;

exports.createReel = async (req, res) => {

    try {

        const file = (req.files || [])[0];

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "Please choose a video."
            });
        }

        // The browser measures the length before upload.
        // (Cloudinary measures it again below, for real.)
        const clientDuration = Number(req.body?.duration || 0);

        if (clientDuration > MAX_REEL_SECONDS + 0.5) {
            return res.status(400).json({
                success: false,
                message: `Reels can be at most ${MAX_REEL_SECONDS} seconds.`
            });
        }

        const saved = await saveFile(file, "etop/reels");

        if (saved.duration > MAX_REEL_SECONDS + 1) {

            await deleteFile(saved);

            return res.status(400).json({
                success: false,
                message: `Reels can be at most ${MAX_REEL_SECONDS} seconds.`
            });

        }

        const reel = await Post.create({
            author: req.user.id,
            kind: "reel",
            caption: String(req.body?.caption || "").slice(0, 2200),
            media: [saved]
        });

        const populated = await Post.findById(reel._id)
            .populate("author", AUTHOR_FIELDS)
            .lean();

        return res.status(201).json({
            success: true,
            data: shape(populated, req.user.id)
        });

    } catch (error) {

        console.error("CREATE REEL ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Could not publish your reel."
        });

    }

};

/* ------------------------------ LISTS */

exports.getFeed = async (req, res) => {

    try {
        return res.json(await listQuery({ kind: "post" }, req));
    } catch (error) {
        console.error("GET FEED ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load the feed." });
    }

};

exports.getReels = async (req, res) => {

    try {
        return res.json(await listQuery({ kind: "reel" }, req));
    } catch (error) {
        console.error("GET REELS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load reels." });
    }

};

exports.getUserPosts = async (req, res) => {

    try {

        if (!isId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        const filter = { author: req.params.userId };

        if (["post", "reel"].includes(req.query.kind)) {
            filter.kind = req.query.kind;
        }

        return res.json(await listQuery(filter, req));

    } catch (error) {
        console.error("GET USER POSTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load posts." });
    }

};

/* ------------------------------ LIKE (toggle) */

exports.toggleLike = async (req, res) => {

    try {

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const post = await Post.findById(req.params.id).select("likes");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        const userId = String(req.user.id);

        const already = post.likes.some(id => String(id) === userId);

        await Post.updateOne(
            { _id: post._id },
            already
                ? { $pull: { likes: req.user.id } }
                : { $addToSet: { likes: req.user.id } }
        );

        return res.json({
            success: true,
            liked: !already,
            likeCount: post.likes.length + (already ? -1 : 1)
        });

    } catch (error) {
        console.error("LIKE ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update like." });
    }

};

/* ------------------------------ COMMENTS */

exports.getComments = async (req, res) => {

    try {

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const post = await Post.findById(req.params.id)
            .select("comments")
            .populate("comments.user", AUTHOR_FIELDS)
            .lean();

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        return res.json({
            success: true,
            data: post.comments
        });

    } catch (error) {
        console.error("GET COMMENTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load comments." });
    }

};

exports.addComment = async (req, res) => {

    try {

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const text = String(req.body?.text || "").trim();

        if (!text) {
            return res.status(400).json({ success: false, message: "Comment can't be empty." });
        }

        const post = await Post.findById(req.params.id).select("comments");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        post.comments.push({ user: req.user.id, text: text.slice(0, 1000) });

        // comments are sub-documents: validate only them, not the whole post
        await post.save({ validateModifiedOnly: true });

        const saved = post.comments[post.comments.length - 1];

        const populated = await Post.findById(post._id)
            .select("comments")
            .populate("comments.user", AUTHOR_FIELDS)
            .lean();

        const comment =
            populated.comments.find(
                c => String(c._id) === String(saved._id)
            );

        return res.status(201).json({
            success: true,
            data: comment,
            commentCount: populated.comments.length
        });

    } catch (error) {
        console.error("ADD COMMENT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not add comment." });
    }

};

/* ------------------------------ VIEW (reels) */

exports.addView = async (req, res) => {

    try {

        if (isId(req.params.id)) {
            await Post.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
        }

        return res.json({ success: true });

    } catch (error) {
        return res.json({ success: false });
    }

};

/* ------------------------------ DELETE */

exports.deletePost = async (req, res) => {

    try {

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        const isOwner = String(post.author) === String(req.user.id);

        if (!isOwner && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Not allowed." });
        }

        for (const media of post.media) {
            await deleteFile(media);
        }

        await Post.deleteOne({ _id: post._id });

        return res.json({ success: true });

    } catch (error) {
        console.error("DELETE POST ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not delete post." });
    }

};
