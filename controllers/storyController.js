const mongoose = require("mongoose");
const Story = require("../models/Story");
const User = require("../models/User");
const { saveFile, deleteFile } = require("../services/mediaStorage");
const { purgeExpiredStories } = require("../services/storyCleanup");

const MAX_STORY_DURATION_SECONDS = 60;

const shapeStory = (story, userId) => ({
    _id: story._id,
    owner: story.owner,
    text: story.text || "",
    media: story.media || { url: "", type: "", publicId: "" },
    audience: story.audience,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
    isOwn: String(story.owner?._id || story.owner) === String(userId),
    viewedByMe: (story.viewers || []).some(
        viewer => String(viewer.user?._id || viewer.user) === String(userId)
    ),
    viewersCount: (story.viewers || []).length
});

const canViewStory = async (story, userId) => {
    const ownerId = String(story.owner?._id || story.owner);
    if (ownerId === String(userId)) {
        return true;
    }
    if (story.audience === "public") {
        return true;
    }

    const owner = await User.findById(ownerId).select("following blockedUsers").lean();
    const viewer = await User.findById(userId).select("blockedUsers").lean();
    const followsOwner = (viewer?.following || []).some(
        id => String(id) === ownerId
    );
    const ownerBlockedViewer = (owner?.blockedUsers || []).some(
        id => String(id) === String(userId)
    );
    const viewerBlockedOwner = (viewer?.blockedUsers || []).some(
        id => String(id) === ownerId
    );

    return followsOwner && !ownerBlockedViewer && !viewerBlockedOwner;
};

exports.createStory = async (req, res) => {
    let savedMedia;
    let storySaved = false;
    try {
        await purgeExpiredStories();
        const owner = req.user?._id || req.user?.id;
        const text = String(req.body?.text || "").trim();
        const audience = req.body?.audience || "followers";
        const file = req.file;

        if (!owner) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }
        if (audience !== "followers" && audience !== "public") {
            return res.status(400).json({
                success: false,
                message: "Choose followers or public story privacy."
            });
        }
        if (!text && !file) {
            return res.status(400).json({
                success: false,
                message: "Write a status or add a photo/video."
            });
        }
        if (text.length > 700) {
            return res.status(400).json({
                success: false,
                message: "Status text must be 700 characters or fewer."
            });
        }

        if (file) {
            savedMedia = await saveFile(file, "etop/messenger-status");
            if (
                savedMedia.type === "video" &&
                savedMedia.duration > MAX_STORY_DURATION_SECONDS
            ) {
                await deleteFile(savedMedia);
                return res.status(400).json({
                    success: false,
                    message: "Status videos can be up to 60 seconds long."
                });
            }
        }

        const story = await Story.create({
            owner,
            text,
            audience,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            media: savedMedia
                ? {
                      url: savedMedia.url,
                      type: savedMedia.type,
                      publicId: savedMedia.publicId
                  }
                : undefined
        });
        storySaved = true;
        const populated = await Story.findById(story._id)
            .populate("owner", "name username profileImage avatar")
            .lean();

        return res.status(201).json({
            success: true,
            data: shapeStory(populated, owner)
        });
    } catch (error) {
        if (savedMedia && !storySaved) {
            await deleteFile(savedMedia);
        }
        console.error("CREATE MESSENGER STORY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not publish the status."
        });
    }
};

exports.getStories = async (req, res) => {
    try {
        await purgeExpiredStories();
        const userId = req.user?._id || req.user?.id;
        const user = await User.findById(userId)
            .select("following blockedUsers")
            .lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const blockedByViewer = (user.blockedUsers || []).map(String);
        const blockedViewer = await User.find({ blockedUsers: userId })
            .select("_id")
            .lean();
        const blockedOwnerIds = [
            ...blockedByViewer,
            ...blockedViewer.map(item => String(item._id))
        ];
        const followedIds = (user.following || []).map(String);
        const ownerIds = [...new Set([String(userId), ...followedIds])];

        const stories = await Story.find({
            expiresAt: { $gt: new Date() },
            $and: [
                { owner: { $nin: blockedOwnerIds } },
                {
                    $or: [
                        { owner: { $in: ownerIds } },
                        { audience: "public" }
                    ]
                }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("owner", "name username profileImage avatar")
            .lean();

        return res.json({
            success: true,
            data: stories.map(story => shapeStory(story, userId))
        });
    } catch (error) {
        console.error("GET MESSENGER STORIES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load statuses."
        });
    }
};

exports.markStoryViewed = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status."
            });
        }

        const story = await Story.findOne({
            _id: req.params.id,
            expiresAt: { $gt: new Date() }
        }).populate("owner", "name username profileImage avatar");
        if (!story || !await canViewStory(story, userId)) {
            return res.status(404).json({
                success: false,
                message: "Status not found."
            });
        }

        if (String(story.owner._id) !== String(userId)) {
            const alreadyViewed = (story.viewers || []).some(
                viewer => String(viewer.user?._id || viewer.user) === String(userId)
            );
            if (!alreadyViewed) {
                await Story.updateOne(
                    {
                        _id: story._id,
                        "viewers.user": { $ne: userId }
                    },
                    {
                        $push: {
                            viewers: { user: userId, viewedAt: new Date() }
                        }
                    }
                );
                story.viewers = [
                    ...story.viewers,
                    { user: userId, viewedAt: new Date() }
                ];
            }
        }

        return res.json({
            success: true,
            data: shapeStory(story.toObject(), userId)
        });
    } catch (error) {
        console.error("MARK MESSENGER STORY VIEW ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not mark the status as viewed."
        });
    }
};

exports.getStoryViewers = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status."
            });
        }

        const story = await Story.findOne({
            _id: req.params.id,
            owner: userId,
            expiresAt: { $gt: new Date() }
        })
            .populate("viewers.user", "name username profileImage avatar")
            .lean();
        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Status not found."
            });
        }

        return res.json({
            success: true,
            data: (story.viewers || [])
                .filter(viewer => viewer.user)
                .map(viewer => ({
                    user: viewer.user,
                    viewedAt: viewer.viewedAt
                }))
        });
    } catch (error) {
        console.error("GET MESSENGER STORY VIEWERS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load status viewers."
        });
    }
};

exports.deleteStory = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status."
            });
        }

        const story = await Story.findOne({
            _id: req.params.id,
            owner: userId
        });
        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Status not found."
            });
        }

        if (story.media?.url) {
            const deletedMedia = await deleteFile(story.media);
            if (!deletedMedia) {
                return res.status(502).json({
                    success: false,
                    message: "Status media could not be deleted. Please try again."
                });
            }
        }

        await story.deleteOne();
        return res.json({ success: true, message: "Status deleted." });
    } catch (error) {
        console.error("DELETE MESSENGER STORY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not delete the status."
        });
    }
};
