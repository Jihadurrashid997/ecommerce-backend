const mongoose = require("mongoose");
const Post = require("../models/Post");
const Community = require("../models/Community");
const User = require("../models/User");
const SavedPost = require("../models/SavedPost");
const { saveFile, deleteFile } = require("../services/mediaStorage");
const { notifyUser, notifyFollowers } = require("../services/platformNotifications");

const AUTHOR_FIELDS = "name username profileImage avatar role";
const POST_VISIBILITIES = new Set(["public", "followers", "private"]);
const REACTION_TYPES = new Set(["like", "love", "haha", "wow", "sad", "angry"]);

const isId = id => mongoose.Types.ObjectId.isValid(id);

const getReactionState = (post, userId) => {
    const counts = Object.fromEntries(
        [...REACTION_TYPES].map(type => [type, 0])
    );
    const reactionByUser = new Map();

    for (const reaction of post.reactions || []) {
        const reactionUserId = String(reaction.user?._id || reaction.user || "");
        if (reactionUserId && REACTION_TYPES.has(reaction.type)) {
            reactionByUser.set(reactionUserId, reaction.type);
        }
    }

    for (const likedUser of post.likes || []) {
        const likedUserId = String(likedUser?._id || likedUser || "");
        if (likedUserId && !reactionByUser.has(likedUserId)) {
            reactionByUser.set(likedUserId, "like");
        }
    }

    for (const reaction of reactionByUser.values()) {
        counts[reaction] += 1;
    }

    return {
        count: reactionByUser.size,
        counts,
        byMe: reactionByUser.get(String(userId)) || null
    };
};

/*
 * Shapes a lean Post for the client:
 *  - never ships the whole likes/reactions arrays
 *  - adds reaction counts and the viewer's reaction
 */
const shape = (post, userId, savedPostIds = new Set()) => {
    const reactionState = getReactionState(post, userId);
    const originalPost = post.originalPost?.author
        ? shape(post.originalPost, userId, savedPostIds)
        : null;

    return {
        _id: post._id,
        kind: post.kind,
        originalPost,
        community: post.community || null,
        visibility: post.visibility || "public",
        author: post.author,
        caption: post.caption,
        media: post.media,
        views: post.views || 0,
        likeCount: reactionState.count,
        commentCount: (post.comments || []).length,
        likedByMe: Boolean(reactionState.byMe),
        reactionByMe: reactionState.byMe,
        reactionCounts: reactionState.counts,
        isSavedByMe: savedPostIds.has(String(post._id)),
        createdAt: post.createdAt
    };

};

const canAccessPost = async (post, userId) => {
    const authorId = String(post?.author?._id || post?.author || "");

    if (post?.visibility === "private" && authorId !== String(userId)) {
        return false;
    }

    if (post?.visibility === "followers" && authorId !== String(userId)) {
        const viewer = await User.findById(userId).select("following").lean();
        const followsAuthor = (viewer?.following || []).some(
            followedId => String(followedId) === authorId
        );

        if (!followsAuthor) return false;
    }

    if (post?.originalPost && !await canAccessPost(post.originalPost, userId)) {
        return false;
    }

    if (!post?.community) {
        return true;
    }

    const community = await Community.findById(post.community)
        .select("privacy members")
        .lean();

    if (!community) {
        return false;
    }

    return community.privacy !== "private" ||
        (community.members || []).some(member => String(member) === String(userId));
};

const addVisibilityFilter = (filter, userId, following = []) => {
    filter.$or = [
        { visibility: { $exists: false } },
        { visibility: "public" },
        { author: userId },
        ...(following.length
            ? [{ visibility: "followers", author: { $in: following } }]
            : [])
    ];

    return filter;
};

const requirePostAccess = async (post, userId, res) => {
    if (await canAccessPost(post, userId)) {
        return true;
    }

    res.status(404).json({
        success: false,
        message: "Post not found."
    });
    return false;
};

const listQuery = async (filter, req, following = []) => {

    const requestedLimit = Number(req.query.limit) || 10;
    const limit = Math.max(1, Math.min(requestedLimit, 30));

    const before = req.query.before
        ? new Date(req.query.before)
        : null;

    if (before && !Number.isNaN(before.getTime())) {
        filter.createdAt = { $lt: before };
    }

    const queryFilter = filter.kind === "reel"
        ? filter
        : addVisibilityFilter(filter, req.user.id, following);

    const posts = await Post.find(queryFilter)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .populate("author", AUTHOR_FIELDS)
        .populate({
            path: "originalPost",
            populate: { path: "author", select: AUTHOR_FIELDS }
        })
        .lean();

    const hasMore = posts.length > limit;

    const page = posts.slice(0, limit);
    const visiblePage = [];
    for (const post of page) {
        if (!post.originalPost || await canAccessPost(post.originalPost, req.user.id)) {
            visiblePage.push(post);
        }
    }

    const postIds = visiblePage.flatMap(post => [
        post._id,
        ...(post.originalPost?._id ? [post.originalPost._id] : [])
    ]);
    const savedPostIds = postIds.length
        ? new Set((await SavedPost.find({
            user: req.user.id,
            post: { $in: postIds }
        }).select("post").lean()).map(saved => String(saved.post)))
        : new Set();

    return {
        success: true,
        data: visiblePage.map(post => shape(post, req.user.id, savedPostIds)),
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
        const caption = String(req.body?.caption || "").trim().slice(0, 2200);
        const communityId = req.params?.communityId || null;
        const visibility = req.body?.visibility === undefined
            ? "public"
            : req.body.visibility;

        if (typeof visibility !== "string" || !POST_VISIBILITIES.has(visibility)) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid post audience."
            });
        }

        if (communityId && visibility !== "public") {
            return res.status(400).json({
                success: false,
                message: "Community posts are visible to community members."
            });
        }

        if (files.length === 0 && !caption) {
            return res.status(400).json({
                success: false,
                message: "Write something or add at least one photo."
            });
        }

        if (files.length > 5) {
            return res.status(400).json({
                success: false,
                message: "You can add up to 5 photos."
            });
        }

        if (communityId) {
            if (!isId(communityId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid community."
                });
            }

            const community = await Community.findOne({
                _id: communityId,
                members: req.user.id
            }).select("_id");

            if (!community) {
                return res.status(403).json({
                    success: false,
                    message: "Join the community before publishing a post."
                });
            }
        }

        const media = [];

        for (const file of files) {
            media.push(await saveFile(file, "etop/posts"));
        }

        const post = await Post.create({
            author: req.user.id,
            community: communityId,
            kind: "post",
            visibility,
            caption,
            media
        });

        if (!communityId && visibility !== "private") {
            await notifyFollowers(req.user.id, {
                type: "post",
                title: "New post",
                message: "Someone you follow shared a new post.",
                link: `/user/${req.user.id}`
            });
        }

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

/* ------------------------------ CREATE REEL (1 video, max 5 min) */

const MAX_REEL_MINUTES = 5;
const MAX_REEL_SECONDS = MAX_REEL_MINUTES * 60;

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
                message: `Reels can be at most ${MAX_REEL_MINUTES} minutes.`
            });
        }

        const saved = await saveFile(file, "etop/reels");

        if (saved.duration > MAX_REEL_SECONDS + 1) {

            await deleteFile(saved);

            return res.status(400).json({
                success: false,
                message: `Reels can be at most ${MAX_REEL_MINUTES} minutes.`
            });

        }

        const reel = await Post.create({
            author: req.user.id,
            kind: "reel",
            caption: String(req.body?.caption || "").slice(0, 2200),
            media: [saved]
        });

        await notifyFollowers(req.user.id, {
            type: "post",
            title: "New reel",
            message: "Someone you follow shared a new reel.",
            link: `/user/${req.user.id}`
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
        const filter = { kind: "post", community: null };
        const viewer = await User
            .findById(req.user.id)
            .select("following")
            .lean();
        const following = viewer?.following || [];

        if (req.query.scope === "following") {
            filter.author = {
                $in: [
                    req.user.id,
                    ...following
                ]
            };
        }

        return res.json(await listQuery(filter, req, following));
    } catch (error) {
        console.error("GET FEED ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load the feed." });
    }

};

exports.getReels = async (req, res) => {

    try {
        return res.json(await listQuery({ kind: "reel", community: null }, req));
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

        const filter = { author: req.params.userId, community: null };
        const viewer = await User
            .findById(req.user.id)
            .select("following")
            .lean();

        if (["post", "reel"].includes(req.query.kind)) {
            filter.kind = req.query.kind;
        }

        return res.json(await listQuery(filter, req, viewer?.following || []));

    } catch (error) {
        console.error("GET USER POSTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load posts." });
    }

};

exports.getPost = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post."
            });
        }

        const post = await Post.findById(req.params.id)
            .populate("author", AUTHOR_FIELDS)
            .populate({
                path: "originalPost",
                populate: { path: "author", select: AUTHOR_FIELDS }
            })
            .lean();

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        if (!await requirePostAccess(post, req.user.id, res)) return;

        const postIds = [
            post._id,
            ...(post.originalPost?._id ? [post.originalPost._id] : [])
        ];
        const savedPosts = await SavedPost.find({
            user: req.user.id,
            post: { $in: postIds }
        }).select("post").lean();
        const savedPostIds = new Set(savedPosts.map(saved => String(saved.post)));

        return res.json({
            success: true,
            data: shape(post, req.user.id, savedPostIds)
        });
    } catch (error) {
        console.error("GET POST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load the post."
        });
    }
};

exports.getSavedPosts = async (req, res) => {
    try {
        const requestedLimit = Number(req.query.limit) || 10;
        const limit = Math.max(1, Math.min(requestedLimit, 30));
        const before = req.query.before ? new Date(req.query.before) : null;
        const filter = { user: req.user.id };

        if (before && !Number.isNaN(before.getTime())) {
            filter.createdAt = { $lt: before };
        }

        const savedPosts = await SavedPost.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate({
                path: "post",
                populate: [
                    { path: "author", select: AUTHOR_FIELDS },
                    {
                        path: "originalPost",
                        populate: { path: "author", select: AUTHOR_FIELDS }
                    }
                ]
            })
            .lean();
        const hasMore = savedPosts.length > limit;
        const page = savedPosts.slice(0, limit);
        const accessiblePosts = [];

        for (const saved of page) {
            if (saved.post && await canAccessPost(saved.post, req.user.id)) {
                accessiblePosts.push(saved.post);
            }
        }

        const savedPostIds = new Set(
            page.filter(saved => saved.post).map(saved => String(saved.post._id))
        );

        return res.json({
            success: true,
            data: accessiblePosts.map(post => shape(post, req.user.id, savedPostIds)),
            nextCursor: hasMore ? page[page.length - 1]?.createdAt || null : null
        });
    } catch (error) {
        console.error("GET SAVED POSTS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load saved posts."
        });
    }
};

exports.setSavedPost = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        if (typeof req.body?.saved !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Choose whether to save or remove this post."
            });
        }

        if (!req.body.saved) {
            await SavedPost.deleteOne({ user: req.user.id, post: req.params.id });
            return res.json({ success: true, isSavedByMe: false });
        }

        const post = await Post.findById(req.params.id)
            .select("author community visibility");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (!await requirePostAccess(post, req.user.id, res)) return;

        try {
            await SavedPost.updateOne(
                { user: req.user.id, post: post._id },
                { $setOnInsert: { user: req.user.id, post: post._id } },
                { upsert: true }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;
        }

        return res.json({ success: true, isSavedByMe: true });
    } catch (error) {
        console.error("SAVE POST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update saved posts."
        });
    }
};

exports.repostPost = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const originalPost = await Post.findById(req.params.id)
            .select("author community kind visibility originalPost");

        if (!originalPost) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (!await requirePostAccess(originalPost, req.user.id, res)) return;

        if (
            originalPost.kind !== "post" ||
            originalPost.community ||
            (originalPost.visibility && originalPost.visibility !== "public") ||
            originalPost.originalPost
        ) {
            return res.status(400).json({
                success: false,
                message: "Only public posts can be reposted."
            });
        }

        const existingRepost = await Post.findOne({
            author: req.user.id,
            originalPost: originalPost._id
        }).select("_id");

        if (existingRepost) {
            return res.status(409).json({
                success: false,
                message: "You have already reposted this post."
            });
        }

        const repost = await Post.create({
            author: req.user.id,
            kind: "post",
            visibility: "public",
            originalPost: originalPost._id,
            caption: "",
            media: []
        });

        if (String(originalPost.author) !== String(req.user.id)) {
            await notifyUser(originalPost.author, {
                actor: req.user.id,
                type: "post_repost",
                title: "Your post was reposted",
                message: "Someone reposted your post.",
                link: `/post/${repost._id}`
            });
        }

        const populated = await Post.findById(repost._id)
            .populate("author", AUTHOR_FIELDS)
            .populate({
                path: "originalPost",
                populate: { path: "author", select: AUTHOR_FIELDS }
            })
            .lean();

        return res.status(201).json({
            success: true,
            data: shape(populated, req.user.id)
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already reposted this post."
            });
        }

        console.error("REPOST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not repost this post."
        });
    }
};

exports.getCommunityPosts = async (req, res) => {
    try {
        const { communityId } = req.params;

        if (!isId(communityId)) {
            return res.status(400).json({ success: false, message: "Invalid community." });
        }

        const community = await Community.findById(communityId)
            .select("privacy members")
            .lean();

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (
            community.privacy === "private" &&
            !(community.members || []).some(member => String(member) === String(req.user.id))
        ) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        const viewer = await User
            .findById(req.user.id)
            .select("following")
            .lean();

        return res.json(await listQuery(
            { kind: "post", community: communityId },
            req,
            viewer?.following || []
        ));
    } catch (error) {
        console.error("GET COMMUNITY POSTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load community posts." });
    }
};

const persistReaction = async (postId, userId, reaction) => {
    if (reaction === null) {
        return Post.updateOne(
            { _id: postId },
            { $pull: { likes: userId, reactions: { user: userId } } }
        );
    }

    let result = await Post.updateOne(
        { _id: postId, "reactions.user": userId },
        {
            $set: { "reactions.$.type": reaction },
            $pull: { likes: userId }
        }
    );
    const matched = result.matchedCount ?? result.n ?? 0;

    if (!matched) {
        result = await Post.updateOne(
            {
                _id: postId,
                reactions: { $not: { $elemMatch: { user: userId } } }
            },
            {
                $push: { reactions: { user: userId, type: reaction } },
                $pull: { likes: userId }
            }
        );

        const inserted = result.matchedCount ?? result.n ?? 0;
        if (!inserted) {
            return Post.updateOne(
                { _id: postId, "reactions.user": userId },
                {
                    $set: { "reactions.$.type": reaction },
                    $pull: { likes: userId }
                }
            );
        }
    }

    return result;
};

const updateReaction = async (post, userId, reaction, res) => {
    const current = getReactionState(post, userId);
    const nextCounts = { ...current.counts };

    if (current.byMe) nextCounts[current.byMe] -= 1;
    if (reaction) nextCounts[reaction] += 1;

    await persistReaction(post._id, userId, reaction);

    if (!current.byMe && reaction && String(post.author?._id || post.author) !== String(userId)) {
        await notifyUser(post.author, {
            actor: userId,
            type: "post_like",
            title: "New reaction",
            message: `Someone reacted to your ${post.kind === "reel" ? "reel" : "post"}.`,
            link: `/user/${post.author?._id || post.author}`
        });
    }

    const likeCount = current.count + Number(Boolean(reaction)) - Number(Boolean(current.byMe));
    return res.json({
        success: true,
        reaction,
        liked: Boolean(reaction),
        likeCount,
        reactionCounts: nextCounts
    });
};

exports.toggleLike = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const post = await Post.findById(req.params.id)
            .select("likes reactions community author kind visibility");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (!await requirePostAccess(post, req.user.id, res)) return;

        const current = getReactionState(post, req.user.id).byMe;
        return updateReaction(post, req.user.id, current === "like" ? null : "like", res);
    } catch (error) {
        console.error("LIKE ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update like." });
    }
};

exports.setReaction = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const reaction = req.body?.reaction;
        if (reaction !== null && !REACTION_TYPES.has(reaction)) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid reaction."
            });
        }

        const post = await Post.findById(req.params.id)
            .select("likes reactions community author kind visibility");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (!await requirePostAccess(post, req.user.id, res)) return;
        return updateReaction(post, req.user.id, reaction, res);
    } catch (error) {
        console.error("SET POST REACTION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update your reaction."
        });
    }
};

/* ------------------------------ COMMENTS */

exports.getComments = async (req, res) => {

    try {

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const post = await Post.findById(req.params.id)
            .select("comments community author visibility")
            .populate("comments.user", AUTHOR_FIELDS)
            .lean();

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (!await requirePostAccess(post, req.user.id, res)) {
            return;
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

        const post = await Post.findById(req.params.id)
            .select("comments community author kind visibility");

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (!await requirePostAccess(post, req.user.id, res)) {
            return;
        }

        post.comments.push({ user: req.user.id, text: text.slice(0, 1000) });

        // comments are sub-documents: validate only them, not the whole post
        await post.save({ validateModifiedOnly: true });

        await notifyUser(post.author, {
            actor: req.user.id,
            type: "post_comment",
            title: "New comment",
            message: `Someone commented on your ${post.kind === "reel" ? "reel" : "post"}.`,
            link: `/user/${post.author}`
        });

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

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid post." });
        }

        const post = await Post.findById(req.params.id)
            .select("community author visibility");
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }
        if (!await requirePostAccess(post, req.user.id, res)) return;

        await Post.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
        return res.json({ success: true });

    } catch (error) {
        console.error("ADD POST VIEW ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not record the view." });
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
        let isCommunityAdmin = false;

        if (post.community) {
            isCommunityAdmin = Boolean(await Community.exists({
                _id: post.community,
                admins: req.user.id
            }));
        }

        if (!isOwner && !isCommunityAdmin && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Not allowed." });
        }

        for (const media of post.media) {
            await deleteFile(media);
        }

        await Post.deleteOne({ _id: post._id });
        await Post.deleteMany({ originalPost: post._id });
        await SavedPost.deleteMany({ post: post._id });

        return res.json({ success: true });

    } catch (error) {
        console.error("DELETE POST ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not delete post." });
    }

};
