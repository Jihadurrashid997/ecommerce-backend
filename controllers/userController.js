const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Message = require("../models/Message");
const MessageRequest = require("../models/MessageRequest");
const Post = require("../models/Post");
const { saveFile, deleteFile } = require("../services/mediaStorage");
const { notifyUser } = require("../services/platformNotifications");
const {
    getEligibleConversationPeerIds
} = require("../services/messengerConversationAccess");

const refreshMessengerPresence = req => {
    const refresh = req.app?.get("refreshPresence");
    if (typeof refresh === "function") {
        Promise.resolve(refresh()).catch(error => {
            console.error("Refresh Messenger presence error:", error);
        });
    }
};

// ======================================================
// HELPERS
// ======================================================

const safeUserFields = [
    "_id",
    "name",
    "role",
    "bio",
    "location",
    "profileImage",
    "isVerified",
    "avatar",
    "image",
    "lastSeen",
    "accountVisibility",
    "createdAt"
];

const normalizeUser = (user) => {

    if (!user) {
        return null;
    }

    const object =
        typeof user.toObject === "function"
            ? user.toObject()
            : user;

    return {
        _id: object._id,
        name: object.name || "",
        email: object.email || "",
        role: object.role || "customer",
        bio: object.bio || "",
        location: object.location || "",
        isVerified: Boolean(object.isVerified),
        accountVisibility: object.accountVisibility === "private"
            ? "private"
            : "public",
        profileImage:
            object.profileImage ||
            object.avatar ||
            object.image ||
            "",
        createdAt: object.createdAt
    };
};

const escapeRegex = (value) => {

    return String(value || "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};


// ======================================================
// GET ALL USERS - ADMIN
// ======================================================

exports.getUsers = async (req, res) => {

    try {

        const page =
            Math.max(
                parseInt(req.query.page, 10) || 1,
                1
            );

        const limit =
            Math.min(
                Math.max(
                    parseInt(req.query.limit, 10) || 50,
                    1
                ),
                100
            );

        const search =
            String(
                req.query.search ||
                req.query.q ||
                ""
            ).trim();

        const role =
            String(
                req.query.role ||
                ""
            ).trim();

        const filter = {};

        if (search) {

            const regex =
                new RegExp(
                    escapeRegex(search),
                    "i"
                );

            filter.$or = [
                { name: regex },
                { email: regex },
                { bio: regex },
                { location: regex }
            ];

        }

        if (
            role &&
            ["customer", "seller", "admin"].includes(role)
        ) {

            filter.role = role;

        }

        const total =
            await User.countDocuments(filter);

        const users =
            await User.find(filter)
                .select(`${safeUserFields.join(" ")} email`)
                .sort({
                    createdAt: -1
                })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

        res.json({

            success: true,

            users:
                users.map(normalizeUser),

            pagination: {

                page,
                limit,
                total,

                totalPages:
                    Math.ceil(total / limit)

            }

        });

    } catch (err) {

        console.error(
            "GET USERS ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load users."

        });

    }

};


// ======================================================
// GET CHAT USERS
// ======================================================

exports.getChatUsers = async (req, res) => {

    try {

        const currentUserId =
            req.user.id;
        const searchTerm = String(req.query?.q || "").trim().slice(0, 100);
        const searchPattern = new RegExp(escapeRegex(searchTerm), "i");
        const searchFilter = {
            _id: { $ne: currentUserId },
            $or: [
                { name: searchPattern },
                { username: searchPattern }
            ]
        };
        const userSearch = searchTerm.length >= 2
            ? Promise.all([
                  User.find({
                      ...searchFilter,
                      accountVisibility: { $ne: "private" }
                  })
                      .select("_id accountVisibility following")
                      .limit(50)
                      .lean(),
                  User.find({
                      ...searchFilter,
                      accountVisibility: "private"
                  })
                      .select("_id accountVisibility following")
                      .limit(50)
                      .lean()
              ]).then(([publicUsers, privateUsers]) => [
                  ...publicUsers,
                  ...privateUsers
              ])
            : Promise.resolve([]);

        const [
            currentUser,
            publicUsers,
            sentToUsers,
            receivedFromUsers
        ] = await Promise.all([
            User.findById(currentUserId)
                .select("blockedUsers following")
                .lean(),
            userSearch,
            Message.distinct("receiver", {
                sender: currentUserId,
                receiver: { $ne: null },
                groupId: null
            }),
            Message.distinct("sender", {
                receiver: currentUserId,
                groupId: null
            })

        ]);

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const existingConversationIds = new Set([
            ...sentToUsers,
            ...receivedFromUsers
        ].map(String));
        const eligibleIds = new Set(getEligibleConversationPeerIds({
            currentUserId,
            users: publicUsers.filter(
                user => user.accountVisibility !== "private"
            ),
            following: currentUser.following || [],
            existingConversationPeers: [...existingConversationIds]
        }));
        const currentFollowing = new Set(
            (currentUser.following || []).map(String)
        );
        publicUsers
            .filter(user =>
                user.accountVisibility === "private" &&
                !currentFollowing.has(String(user._id)) &&
                !existingConversationIds.has(String(user._id))
            )
            .forEach(user => eligibleIds.add(String(user._id)));

        const users = await User.find({
            _id: { $in: [...eligibleIds] }
        })
            .select(`${safeUserFields.join(" ")} blockedUsers`)
            .sort({ name: 1 })
            .lean();

        const myBlockedSet =
            new Set(
                (
                    currentUser?.blockedUsers ||
                    []
                ).map(String)
            );

        res.json({

            success: true,

            users: users
                .map(user => {
                    const userId = String(user._id);
                    const isBlockedByMe = myBlockedSet.has(userId);
                    const hasBlockedMe = (user.blockedUsers || [])
                        .map(String)
                        .includes(String(currentUserId));
                    const hasExistingConversation =
                        existingConversationIds.has(userId);
                    if (
                        (isBlockedByMe || hasBlockedMe) &&
                        !hasExistingConversation
                    ) {
                        return null;
                    }

                    const canStartConversation =
                        user.accountVisibility !== "private" ||
                        currentFollowing.has(userId);
                    const canViewPresence =
                        !isBlockedByMe &&
                        !hasBlockedMe &&
                        (
                            user.accountVisibility !== "private" ||
                            canStartConversation ||
                            hasExistingConversation
                        );

                    return {
                        ...normalizeUser(user),
                        ...(canViewPresence
                            ? { lastSeen: user.lastSeen }
                            : {}),
                        isBlockedByMe,
                        canStartConversation,
                        ...(hasExistingConversation
                            ? { hasExistingConversation: true }
                            : {}),
                        ...(hasBlockedMe ? { hasBlockedMe: true } : {}),
                        ...(
                            user.accountVisibility === "private" &&
                            !canStartConversation &&
                            !hasExistingConversation
                                ? { requiresMessageRequest: true }
                                : {}
                        )
                    };
                })
                .filter(Boolean)

        });

    } catch (err) {

        console.error(
            "GET CHAT USERS ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load chat users."

        });

    }

};

exports.getMessengerPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("+messengerPreferences")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const entries = user.messengerPreferences instanceof Map
            ? [...user.messengerPreferences.entries()]
            : Object.entries(user.messengerPreferences || {});
        const preferences = Object.fromEntries(
            entries.map(([conversationId, preference]) => [
                conversationId,
                {
                    pinned: Boolean(preference?.pinned),
                    archived: Boolean(preference?.archived),
                    muted: Boolean(preference?.muted)
                }
            ])
        );

        return res.json({
            success: true,
            preferences
        });
    } catch (error) {
        console.error("GET MESSENGER PREFERENCES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load Messenger preferences."
        });
    }
};

exports.updateMessengerPreference = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.conversationId;
        const allowedKeys = ["pinned", "archived", "muted"];
        const entries = Object.entries(req.body || {});

        if (
            !mongoose.Types.ObjectId.isValid(conversationId) ||
            String(conversationId) === String(userId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid conversation ID."
            });
        }

        if (
            entries.length === 0 ||
            entries.some(([key, value]) =>
                !allowedKeys.includes(key) || typeof value !== "boolean"
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Only Boolean pinned, archived, and muted preferences can be updated."
            });
        }

        const updates = Object.fromEntries(
            entries.map(([key, value]) => [
                `messengerPreferences.${conversationId}.${key}`,
                value
            ])
        );
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true }
        )
            .select("+messengerPreferences")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const stored = user.messengerPreferences instanceof Map
            ? user.messengerPreferences.get(conversationId)
            : user.messengerPreferences?.[conversationId];

        return res.json({
            success: true,
            preference: {
                pinned: Boolean(stored?.pinned),
                archived: Boolean(stored?.archived),
                muted: Boolean(stored?.muted)
            }
        });
    } catch (error) {
        console.error("UPDATE MESSENGER PREFERENCE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update Messenger preference."
        });
    }
};


// ======================================================
// BLOCK / UNBLOCK USER
// ======================================================

exports.blockUser = async (req, res) => {

    try {

        const targetId =
            req.params.id;

        if (
            !mongoose.Types.ObjectId.isValid(
                targetId
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });

        }

        if (
            String(targetId) ===
            String(req.user.id)
        ) {

            return res.status(400).json({
                success: false,
                message: "You cannot block yourself."
            });

        }

        await User.findByIdAndUpdate(
            req.user.id,
            {
                $addToSet: {
                    blockedUsers: targetId
                }
            }
        );

        const pendingRequests = await MessageRequest.find({
            status: "pending",
            $or: [
                { sender: req.user.id, recipient: targetId },
                { sender: targetId, recipient: req.user.id }
            ]
        })
            .select("_id fileUrl filePublicId fileStorageType")
            .lean();

        for (const pendingRequest of pendingRequests) {
            const blockedRequest = await MessageRequest.findOneAndUpdate(
                {
                    _id: pendingRequest._id,
                    status: "pending"
                },
                {
                    $set: { status: "blocked" },
                    $unset: {
                        message: "",
                        isEncrypted: "",
                        fileUrl: "",
                        fileName: "",
                        fileType: "",
                        filePublicId: "",
                        fileStorageType: ""
                    }
                },
                { new: false }
            ).lean();

            if (blockedRequest?.fileUrl || blockedRequest?.filePublicId) {
                const removed = await deleteFile({
                    url: blockedRequest.fileUrl,
                    publicId: blockedRequest.filePublicId,
                    type: blockedRequest.fileStorageType
                });
                if (!removed) {
                    console.error(
                        "Blocked Message Request attachment cleanup failed.",
                        { requestId: String(blockedRequest._id) }
                    );
                }
            }
        }

        refreshMessengerPresence(req);
        res.json({
            success: true,
            message: "User blocked."
        });

    } catch (err) {

        console.error(
            "BLOCK USER ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Failed to block user."
        });

    }

};


exports.unblockUser = async (req, res) => {

    try {

        const targetId =
            req.params.id;

        if (
            !mongoose.Types.ObjectId.isValid(
                targetId
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });

        }

        await User.findByIdAndUpdate(
            req.user.id,
            {
                $pull: {
                    blockedUsers: targetId
                }
            }
        );

        refreshMessengerPresence(req);
        res.json({
            success: true,
            message: "User unblocked."
        });

    } catch (err) {

        console.error(
            "UNBLOCK USER ERROR:",
            err
        );

        res.status(500).json({
            success: false,
            message: "Failed to unblock user."
        });

    }

};

exports.getBlockedUsers = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("blockedUsers")
            .populate("blockedUsers", "name profileImage")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            users: user.blockedUsers || []
        });
    } catch (error) {
        console.error("GET BLOCKED USERS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load blocked users."
        });
    }
};

exports.getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("theme notificationPreferences accountVisibility")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            settings: {
                theme: user.theme || "dark",
                accountVisibility: user.accountVisibility === "private"
                    ? "private"
                    : "public",
                notifications: {
                    follows: user.notificationPreferences?.follows !== false,
                    posts: user.notificationPreferences?.posts !== false,
                    communities: user.notificationPreferences?.communities !== false,
                    announcements: user.notificationPreferences?.announcements !== false
                }
            }
        });
    } catch (error) {
        console.error("GET USER SETTINGS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load your settings."
        });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { theme, notifications, accountVisibility } = req.body || {};

        if (theme !== undefined && !["dark", "light"].includes(theme)) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid theme."
            });
        }

        if (
            accountVisibility !== undefined &&
            !["public", "private"].includes(accountVisibility)
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid account visibility."
            });
        }

        const allowedPreferences = [
            "follows",
            "posts",
            "communities",
            "announcements"
        ];
        if (
            notifications !== undefined &&
            (!notifications || typeof notifications !== "object" || Array.isArray(notifications) ||
                Object.keys(notifications).some(key =>
                    !allowedPreferences.includes(key) ||
                    typeof notifications[key] !== "boolean"
                ))
        ) {
            return res.status(400).json({
                success: false,
                message: "Notification preferences are invalid."
            });
        }

        const updates = {};
        if (theme !== undefined) updates.theme = theme;
        if (accountVisibility !== undefined) {
            updates.accountVisibility = accountVisibility;
        }
        for (const [key, value] of Object.entries(notifications || {})) {
            updates[`notificationPreferences.${key}`] = value;
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({
                success: false,
                message: "No settings were provided."
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("theme notificationPreferences accountVisibility").lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (accountVisibility !== undefined) {
            refreshMessengerPresence(req);
        }

        return res.json({
            success: true,
            settings: {
                theme: user.theme || "dark",
                accountVisibility: user.accountVisibility === "private"
                    ? "private"
                    : "public",
                notifications: {
                    follows: user.notificationPreferences?.follows !== false,
                    posts: user.notificationPreferences?.posts !== false,
                    communities: user.notificationPreferences?.communities !== false,
                    announcements: user.notificationPreferences?.announcements !== false
                }
            }
        });
    } catch (error) {
        console.error("UPDATE USER SETTINGS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not save your settings."
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const currentPassword = String(req.body?.currentPassword || "");
        const newPassword = String(req.body?.newPassword || "");

        if (newPassword.length < 8 || newPassword.length > 72) {
            return res.status(400).json({
                success: false,
                message: "Your new password must be between 8 and 72 characters."
            });
        }

        const user = await User.findById(req.user.id).select("+password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            return res.status(400).json({
                success: false,
                message: "Your current password is incorrect."
            });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        return res.json({
            success: true,
            message: "Password updated successfully."
        });
    } catch (error) {
        console.error("CHANGE PASSWORD ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update your password."
        });
    }
};


// ======================================================
// GET MY PROFILE
// ======================================================

exports.getProfile = async (req, res) => {

    try {

        const user =
            await User.findById(
                req.user.id
            )
                .select(
                    safeUserFields.join(" ")
                )
                .lean();

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        res.json({

            success: true,

            user:
                normalizeUser(user)

        });

    } catch (err) {

        console.error(
            "GET PROFILE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load profile."

        });

    }

};


// ======================================================
// UPDATE PROFILE
// ======================================================

exports.updateProfile = async (req, res) => {

    let uploadedMedia = null;
    let profileSaved = false;

    try {

        const {
            name,
            bio,
            location,
            profileImage
        } = req.body;

        const user =
            await User.findById(
                req.user.id
            ).select(
                "+profileImagePublicId +profileImageType"
            );

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        const file = req.files?.[0];
        const previousImage = {
            url: user.profileImage,
            publicId: user.profileImagePublicId,
            type: user.profileImageType
        };

        if (file) {
            uploadedMedia = await saveFile(file, "etop/profiles");
        }

        if (
            typeof name === "string" &&
            name.trim()
        ) {

            user.name =
                name.trim();

        }

        if (
            typeof bio === "string"
        ) {

            user.bio =
                bio.trim();

        }

        if (
            typeof location === "string"
        ) {

            user.location =
                location.trim();

        }

        if (
            !file &&
            typeof profileImage === "string"
        ) {

            user.profileImage =
                profileImage.trim();

            if (user.profileImage !== previousImage.url) {
                user.profileImagePublicId = "";
                user.profileImageType = "";
            }

        }

        if (uploadedMedia) {
            user.profileImage = uploadedMedia.url;
            user.profileImagePublicId = uploadedMedia.publicId || "";
            user.profileImageType = uploadedMedia.type || "image";

        }

        await user.save();
        profileSaved = true;

        if (
            uploadedMedia &&
            previousImage.url &&
            previousImage.url !== uploadedMedia.url
        ) {
            await deleteFile(previousImage);
        }

        const updated =
            await User.findById(
                user._id
            )
                .select(
                    safeUserFields.join(" ")
                )
                .lean();

        res.json({

            success: true,

            message:
                "Profile updated successfully.",

            user:
                normalizeUser(updated)

        });

    } catch (err) {

        if (uploadedMedia && !profileSaved) {
            await deleteFile(uploadedMedia);
        }

        console.error(
            "UPDATE PROFILE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to update profile."

        });

    }

};


// ======================================================
// SEARCH USERS
// ======================================================

exports.searchUsers = async (req, res) => {

    try {

        const keyword =
            String(
                req.query.q ||
                req.query.search ||
                req.query.keyword ||
                ""
            ).trim();

        if (!keyword) {

            return res.json({

                success: true,

                users: [],

                total: 0

            });

        }

        const regex =
            new RegExp(
                escapeRegex(keyword),
                "i"
            );

        /*
         * IMPORTANT:
         * Only search real User fields.
         * Do not dynamically search schema fields.
         */

        const filter = {

            $or: [

                {
                    name: regex
                },

                {
                    email: regex
                },

                {
                    bio: regex
                },

                {
                    location: regex
                },

                {
                    role: regex
                }

            ]

        };

        const users =
            await User.find(filter)
                .select(
                    safeUserFields.join(" ")
                )
                .sort({
                    name: 1
                })
                .limit(50)
                .lean();

        res.status(200).json({

            success: true,

            users:
                users.map(normalizeUser),

            total:
                users.length

        });

    } catch (err) {

        console.error(
            "SEARCH USERS ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to search users."

        });

    }

};


// ======================================================
// PUBLIC USER PROFILE
// ======================================================

exports.getPublicProfile = async (req, res) => {

    try {

        const id =
            String(
                req.params.id || ""
            ).trim();

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user ID."

            });

        }

        const user =
            await User.findById(id)
                .select(
                    safeUserFields.join(" ")
                )
                .lean();

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        res.json({

            success: true,

            user:
                normalizeUser(user)

        });

    } catch (err) {

        console.error(
            "PUBLIC PROFILE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load user profile."

        });

    }

};


// ======================================================
// DELETE USER - ADMIN
// ======================================================

exports.deleteUser = async (req, res) => {

    try {

        const id =
            String(
                req.params.id || ""
            ).trim();

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user ID."

            });

        }

        if (
            id.toString() ===
            req.user.id.toString()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Admin cannot delete their own account."

            });

        }

        const user =
            await User.findById(id);

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        await User.findByIdAndDelete(id);

        res.json({

            success: true,

            message:
                "User deleted successfully."

        });

    } catch (err) {

        console.error(
            "DELETE USER ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to delete user."

        });

    }

};


// ======================================================
// SOCIAL: follow / unfollow + profile stats
// ======================================================

exports.getSocialStats = async (req, res) => {

    try {

        const targetId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        const [target, me, followersCount, postsCount, reelsCount] =
            await Promise.all([
                User.findById(targetId)
                    .select("following accountVisibility pendingFollowRequests blockedUsers")
                    .lean(),
                User.findById(req.user.id)
                    .select("following blockedUsers")
                    .lean(),
                User.countDocuments({ following: targetId }),
                Post.countDocuments({ author: targetId, kind: "post" }),
                Post.countDocuments({ author: targetId, kind: "reel" })
            ]);

        if (!target) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.json({
            success: true,
            followersCount,
            followingCount: (target.following || []).length,
            postsCount,
            reelsCount,
            accountVisibility: target.accountVisibility === "private"
                ? "private"
                : "public",
            isFollowing: (me?.following || []).some(
                id => String(id) === String(targetId)
            ),
            isFollowRequestPending: (target.pendingFollowRequests || []).some(
                request => String(request.user) === String(req.user.id)
            ),
            isBlocked: (me?.blockedUsers || []).some(
                id => String(id) === String(targetId)
            ) || (target.blockedUsers || []).some(
                id => String(id) === String(req.user.id)
            )
        });

    } catch (err) {

        console.error("SOCIAL STATS ERROR:", err);

        return res.status(500).json({ success: false, message: "Could not load profile stats." });

    }

};

exports.toggleFollow = async (req, res) => {

    try {

        const targetId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        if (String(targetId) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: "You can't follow yourself." });
        }

        const session = await mongoose.startSession();
        let action;
        let followersCount;
        try {
            await session.withTransaction(async () => {
                action = undefined;
                followersCount = undefined;
                const [target, me] = await Promise.all([
                    User.findById(targetId)
                        .select("accountVisibility pendingFollowRequests blockedUsers")
                        .session(session)
                        .lean(),
                    User.findById(req.user.id)
                        .select("following blockedUsers")
                        .session(session)
                        .lean()
                ]);

                if (!target || !me) {
                    action = "not-found";
                    return;
                }

                const targetIdString = String(targetId);
                const currentIdString = String(req.user.id);
                const already = (me.following || []).some(
                    id => String(id) === targetIdString
                );
                const blocked = (me.blockedUsers || []).some(
                    id => String(id) === targetIdString
                ) || (target.blockedUsers || []).some(
                    id => String(id) === currentIdString
                );

                if (blocked) {
                    action = "blocked";
                    return;
                }

                if (already) {
                    await User.updateOne(
                        { _id: req.user.id },
                        { $pull: { following: targetId } },
                        { session }
                    );
                    action = "unfollowed";
                } else if (target.accountVisibility === "private") {
                    const hasPending = (target.pendingFollowRequests || []).some(
                        request => String(request.user) === currentIdString
                    );
                    if (hasPending) {
                        await User.updateOne(
                            { _id: targetId },
                            { $pull: { "pendingFollowRequests": { user: req.user.id } } },
                            { session }
                        );
                        action = "request-cancelled";
                    } else {
                        await User.updateOne(
                            { _id: targetId },
                            {
                                $push: {
                                    pendingFollowRequests: {
                                        user: req.user.id,
                                        createdAt: new Date()
                                    }
                                },
                                $set: { accountVisibility: "private" }
                            },
                            { session }
                        );
                        action = "request-sent";
                    }
                } else {
                    await User.updateOne(
                        { _id: targetId },
                        { $set: { accountVisibility: "public" } },
                        { session }
                    );
                    await User.updateOne(
                        { _id: req.user.id },
                        { $addToSet: { following: targetId } },
                        { session }
                    );
                    action = "followed";
                }

                followersCount = await User.countDocuments(
                    { following: targetId }
                ).session(session);
            });
        } finally {
            await session.endSession();
        }

        if (action === "not-found") {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        if (action === "blocked") {
            return res.status(403).json({
                success: false,
                message: "You cannot follow or request to follow this user."
            });
        }

        if (action === "followed") {
            await notifyUser(targetId, {
                actor: req.user.id,
                type: "follow",
                title: "New follower",
                message: "Someone started following you.",
                link: `/user/${req.user.id}`
            });
        }

        if (action === "followed" || action === "unfollowed") {
            refreshMessengerPresence(req);
        }

        return res.json({
            success: true,
            isFollowing: action === "followed" || action === "unfollowed"
                ? action === "followed"
                : false,
            isFollowRequestPending: action === "request-sent",
            action,
            followersCount
        });

    } catch (err) {

        console.error("TOGGLE FOLLOW ERROR:", err);

        return res.status(500).json({ success: false, message: "Could not update follow." });

    }

};

exports.getFollowRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("pendingFollowRequests")
            .populate("pendingFollowRequests.user", "name profileImage avatar image")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            requests: (user.pendingFollowRequests || [])
                .filter(request => request.user)
                .map(request => ({
                    user: {
                        _id: request.user._id,
                        name: request.user.name || "",
                        profileImage:
                            request.user.profileImage ||
                            request.user.avatar ||
                            request.user.image ||
                            ""
                    },
                    createdAt: request.createdAt
                }))
        });
    } catch (error) {
        console.error("GET FOLLOW REQUESTS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load follow requests."
        });
    }
};

exports.respondToFollowRequest = async (req, res) => {
    const requesterId = req.params.id;
    const accept = req.body?.action === "accept";
    if (!["accept", "reject"].includes(req.body?.action)) {
        return res.status(400).json({
            success: false,
            message: "Choose accept or reject."
        });
    }
    if (
        !mongoose.Types.ObjectId.isValid(requesterId) ||
        String(requesterId) === String(req.user.id)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid follow request."
        });
    }

    let responseStatus = 200;
    let responseBody;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const target = await User.findOne({
                _id: req.user.id,
                "pendingFollowRequests.user": requesterId
            })
                .select("blockedUsers")
                .session(session)
                .lean();
            if (!target) {
                responseStatus = 404;
                responseBody = {
                    success: false,
                    message: "Follow request not found."
                };
                return;
            }

            if (accept) {
                const requester = await User.findById(requesterId)
                    .select("blockedUsers")
                    .session(session)
                    .lean();
                if (!requester) {
                    await User.updateOne(
                        { _id: req.user.id },
                        { $pull: { pendingFollowRequests: { user: requesterId } } },
                        { session }
                    );
                    responseStatus = 404;
                    responseBody = {
                        success: false,
                        message: "Requester not found."
                    };
                    return;
                }

                const blocked =
                    (target.blockedUsers || []).some(id => String(id) === String(requesterId)) ||
                    (requester.blockedUsers || []).some(id => String(id) === String(req.user.id));
                if (blocked) {
                    await User.updateOne(
                        { _id: req.user.id },
                        { $pull: { pendingFollowRequests: { user: requesterId } } },
                        { session }
                    );
                    responseStatus = 403;
                    responseBody = {
                        success: false,
                        message: "This follow request cannot be approved."
                    };
                    return;
                }

                await User.updateOne(
                    { _id: requesterId },
                    { $addToSet: { following: req.user.id } },
                    { session }
                );
            }

            await User.updateOne(
                { _id: req.user.id },
                { $pull: { pendingFollowRequests: { user: requesterId } } },
                { session }
            );
            responseBody = {
                success: true,
                action: accept ? "accepted" : "rejected"
            };
        });
    } catch (error) {
        console.error("RESPOND TO FOLLOW REQUEST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update the follow request."
        });
    } finally {
        await session.endSession();
    }

    if (responseStatus === 200 && accept) {
        refreshMessengerPresence(req);
    }

    return res.status(responseStatus).json(responseBody);
};

exports.getFollowing = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("following")
            .populate("following", "name role profileImage")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            users: (user.following || []).filter(Boolean)
        });
    } catch (error) {
        console.error("GET FOLLOWING ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load the people you follow."
        });
    }
};
