const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Product = require("../models/Product");
const Community = require("../models/Community");
const ContentReport = require("../models/ContentReport");
const UserReport = require("../models/UserReport");
const auth = require("../middleware/auth");
const fs = require("fs").promises;
const path = require("path");
const { deleteFile, isCloudinaryConfigured } = require("../services/mediaStorage");
const { writeAuditLog } = require("../services/adminAudit");

const getLocalUploadBytes = async directory => {
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        const sizes = await Promise.all(entries.map(async entry => {
            const filePath = path.join(directory, entry.name);
            if (entry.isDirectory()) return getLocalUploadBytes(filePath);
            const metadata = await fs.stat(filePath);
            return metadata.size;
        }));
        return sizes.reduce((total, size) => total + size, 0);
    } catch (error) {
        if (error.code === "ENOENT") return 0;
        throw error;
    }
};

/*
=========================================================
ADMIN CONTROL  (mounted behind auth(["admin"]))

PRIVACY NOTE: passwords are stored only as one-way bcrypt
hashes - nobody (admins included) can read a user's
password. An admin can RESET it to a temporary one.
=========================================================
*/

const isId = id => mongoose.Types.ObjectId.isValid(id);

const escapeRegex = text =>
    String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const AUTHOR = "name email profileImage role";

exports.getOverview = async (req, res) => {

    try {

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const storageUsedBytes = isCloudinaryConfigured()
            ? null
            : await getLocalUploadBytes(path.join(__dirname, "..", "uploads"));

        const [
            totalUsers, customers, sellers, admins, suspended, newUsers7d, newUsersToday,
            posts, reels, commentsAgg, messages, products, communities,
            contentReports, messageReports
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "customer" }),
            User.countDocuments({ role: "seller" }),
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ isSuspended: true }),
            User.countDocuments({ createdAt: { $gte: weekAgo } }),
            User.countDocuments({ createdAt: { $gte: todayStart } }),
            Post.countDocuments({ kind: "post" }),
            Post.countDocuments({ kind: "reel" }),
            Post.aggregate([{ $group: { _id: null, n: { $sum: { $size: "$comments" } } } }]),
            Message.estimatedDocumentCount(),
            Product.estimatedDocumentCount(),
            Community.countDocuments(),
            ContentReport.countDocuments({ status: "pending" }),
            UserReport.countDocuments({ status: "open" })
        ]);

        return res.json({
            success: true,
            overview: {
                users: {
                    total: totalUsers,
                    customers,
                    sellers,
                    admins,
                    suspended,
                    newThisWeek: newUsers7d,
                    newToday: newUsersToday
                },
                content: { posts, reels, comments: commentsAgg[0]?.n || 0 },
                messages,
                products,
                communities,
                pendingReports: contentReports + messageReports,
                mediaStorage: isCloudinaryConfigured() ? "cloudinary" : "server-disk (temporary)",
                storageUsedBytes
            }
        });

    } catch (error) {
        console.error("ADMIN OVERVIEW ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load overview." });
    }

};

exports.listUsers = async (req, res) => {

    try {

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

        const filter = {};

        const search = String(req.query.search || "").trim();

        if (search) {
            const rx = new RegExp(escapeRegex(search), "i");
            filter.$or = [{ name: rx }, { email: rx }];
        }

        if (["customer", "seller", "admin"].includes(req.query.role)) {
            filter.role = req.query.role;
        }

        if (req.query.status === "suspended") filter.isSuspended = true;
        if (req.query.status === "banned") filter.isBanned = true;
        if (req.query.status === "active") {
            filter.isSuspended = { $ne: true };
            filter.isBanned = { $ne: true };
        }

        const [items, total] = await Promise.all([
            User.find(filter)
                .select("name email role adminRole profileImage location createdAt lastSeen isSuspended isBanned isVerified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        const ids = items.map(u => u._id);

        const counts = await Post.aggregate([
            { $match: { author: { $in: ids } } },
            { $group: { _id: { a: "$author", k: "$kind" }, n: { $sum: 1 } } }
        ]);

        const byUser = {};

        counts.forEach(c => {
            const key = String(c._id.a);
            byUser[key] = byUser[key] || { posts: 0, reels: 0 };
            byUser[key][c._id.k === "reel" ? "reels" : "posts"] = c.n;
        });

        return res.json({
            success: true,
            items: items.map(u => ({
                ...u,
                postsCount: byUser[String(u._id)]?.posts || 0,
                reelsCount: byUser[String(u._id)]?.reels || 0
            })),
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit))
        });

    } catch (error) {
        console.error("ADMIN LIST USERS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load users." });
    }

};

exports.getUserDetail = async (req, res) => {

    try {

        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        const user = await User.findById(req.params.id)
            .select("-password -blockedUsers -following")
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const [followers, followingDoc, posts, reels, productsCount, recent] =
            await Promise.all([
                User.countDocuments({ following: user._id }),
                User.findById(user._id).select("following").lean(),
                Post.countDocuments({ author: user._id, kind: "post" }),
                Post.countDocuments({ author: user._id, kind: "reel" }),
                Product.countDocuments({ seller: user._id }),
                Post.find({ author: user._id })
                    .sort({ createdAt: -1 })
                    .limit(12)
                    .select("kind caption media createdAt moderationStatus moderationReason")
                    .lean()
            ]);

        return res.json({
            success: true,
            user,
            stats: {
                followers,
                following: (followingDoc?.following || []).length,
                posts,
                reels,
                products: productsCount
            },
            recent
        });

    } catch (error) {
        console.error("ADMIN USER DETAIL ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load this user." });
    }

};

exports.setSuspended = async (req, res) => {

    try {

        const { id } = req.params;

        if (!isId(id)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        if (String(id) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: "You can't suspend your own account." });
        }

        const target = await User.findById(id).select("role");

        if (!target) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (target.role === "admin") {
            return res.status(400).json({
                success: false,
                message: "Change this admin's role first, then suspend."
            });
        }

        const suspend = Boolean(req.body?.suspend);
        const reason = String(req.body?.reason || "").trim();
        if (suspend && !reason) {
            return res.status(400).json({ success: false, message: "A reason is required to suspend an account." });
        }

        await User.updateOne(
            { _id: id },
            suspend
                ? {
                    $set: {
                        isSuspended: true,
                        suspendedReason: reason.slice(0, 500),
                        suspendedAt: new Date()
                    }
                }
                : {
                    $set: { isSuspended: false, suspendedReason: "" },
                    $unset: { suspendedAt: "" }
                }
        );

        auth.invalidate(id);
        await writeAuditLog(req, {
            action: suspend ? "user.suspend" : "user.unsuspend",
            targetType: "user",
            targetId: id,
            reason
        });

        return res.json({ success: true, isSuspended: suspend });

    } catch (error) {
        console.error("ADMIN SUSPEND ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update this account." });
    }

};

exports.setAccountStatus = async (req, res) => {
    const { id } = req.params;
    const status = req.body?.status;
    const reason = String(req.body?.reason || "").trim();
    if (!isId(id) || !["active", "suspended", "banned"].includes(status)) {
        return res.status(400).json({ success: false, message: "Choose a valid account status." });
    }
    if (status !== "active" && !reason) {
        return res.status(400).json({ success: false, message: "A reason is required." });
    }
    if (String(id) === String(req.user.id)) {
        return res.status(400).json({ success: false, message: "You cannot change your own account status." });
    }
    try {
        const target = await User.findById(id).select("role");
        if (!target) return res.status(404).json({ success: false, message: "User not found." });
        if (target.role === "admin") {
            return res.status(400).json({ success: false, message: "Remove the admin role before changing this account status." });
        }
        await User.updateOne(
            { _id: id },
            {
                $set: {
                    isSuspended: status === "suspended",
                    suspendedReason: status === "suspended" ? reason : "",
                    suspendedAt: status === "suspended" ? new Date() : null,
                    isBanned: status === "banned",
                    bannedReason: status === "banned" ? reason : "",
                    bannedAt: status === "banned" ? new Date() : null
                }
            }
        );
        auth.invalidate(id);
        await writeAuditLog(req, {
            action: `user.${status}`,
            targetType: "user",
            targetId: id,
            reason
        });
        return res.json({ success: true, status });
    } catch (error) {
        console.error("ADMIN ACCOUNT STATUS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update this account." });
    }
};

exports.setRole = async (req, res) => {

    try {

        const { id } = req.params;

        const role = req.body?.role;

        if (!isId(id)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        if (!["customer", "seller", "admin"].includes(role)) {
            return res.status(400).json({ success: false, message: "Invalid role." });
        }

        if (String(id) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: "You can't change your own role." });
        }

        const update = {
            $set: {
                role,
                ...(role === "admin" ? { adminRole: "super_admin" } : {}),
                ...(role === "seller"
                    ? { "sellerApplication.status": "approved" }
                    : {})
            },
            ...(role === "admin" ? {} : { $unset: { adminRole: "" } })
        };
        const result = await User.updateOne({ _id: id }, update);

        if (!result.matchedCount) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        auth.invalidate(id);
        await writeAuditLog(req, {
            action: "user.role_changed",
            targetType: "user",
            targetId: id,
            details: { role }
        });

        return res.json({ success: true, role });

    } catch (error) {
        console.error("ADMIN SET ROLE ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not change the role." });
    }

};

exports.setAdminRole = async (req, res) => {
    const { id } = req.params;
    const adminRole = req.body?.adminRole;
    if (!isId(id) || !["super_admin", "moderator", "support"].includes(adminRole)) {
        return res.status(400).json({ success: false, message: "Choose a valid admin role." });
    }
    if (String(id) === String(req.user.id)) {
        return res.status(400).json({ success: false, message: "You cannot change your own admin role." });
    }
    try {
        const result = await User.updateOne({ _id: id, role: "admin" }, { $set: { adminRole } });
        if (!result.matchedCount) {
            return res.status(404).json({ success: false, message: "Admin user not found." });
        }
        auth.invalidate(id);
        await writeAuditLog(req, {
            action: "admin.role_changed",
            targetType: "user",
            targetId: id,
            details: { adminRole }
        });
        return res.json({ success: true, adminRole });
    } catch (error) {
        console.error("ADMIN ROLE UPDATE ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not change the admin role." });
    }
};

exports.setVerification = async (req, res) => {

    try {

        const { id } = req.params;
        const isVerified = req.body?.isVerified;

        if (!isId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user."
            });
        }

        if (typeof isVerified !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Verification status must be true or false."
            });
        }

        const update = isVerified
            ? {
                  $set: {
                      isVerified: true,
                      verifiedAt: new Date(),
                      verifiedBy: req.user.id
                  }
              }
            : {
                  $set: { isVerified: false },
                  $unset: {
                      verifiedAt: "",
                      verifiedBy: ""
                  }
              };

        const result = await User.updateOne({ _id: id }, update);

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        await writeAuditLog(req, {
            action: `user.verification_${isVerified ? "granted" : "revoked"}`,
            targetType: "user",
            targetId: id
        });

        return res.json({
            success: true,
            isVerified
        });

    } catch (error) {
        console.error("ADMIN SET VERIFICATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update verification status."
        });
    }

};

exports.resetPassword = async (req, res) => {

    try {

        const { id } = req.params;

        if (!isId(id)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        const target = await User.findById(id).select("_id");

        if (!target) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const tempPassword = crypto.randomBytes(6).toString("base64url");

        await User.updateOne(
            { _id: id },
            { $set: { password: await bcrypt.hash(tempPassword, 12) } }
        );
        await writeAuditLog(req, {
            action: "user.password_reset",
            targetType: "user",
            targetId: id
        });

        // shown to the admin exactly once - never stored in plain text
        return res.json({ success: true, tempPassword });

    } catch (error) {
        console.error("ADMIN RESET PASSWORD ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not reset the password." });
    }

};

exports.deleteUser = async (req, res) => {

    try {

        const { id } = req.params;

        if (!isId(id)) {
            return res.status(400).json({ success: false, message: "Invalid user." });
        }

        if (String(id) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: "You can't delete your own account." });
        }

        const target = await User.findById(id).select("_id");

        if (!target) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const posts = await Post.find({ author: id }).select("media").lean();

        for (const post of posts) {
            for (const media of post.media || []) {
                await deleteFile(media);
            }
        }

        await Post.deleteMany({ author: id });

        await Post.updateMany(
            {},
            { $pull: { likes: id, comments: { user: id } } }
        );

        await User.updateMany({ following: id }, { $pull: { following: id } });

        await User.deleteOne({ _id: id });

        auth.invalidate(id);
        await writeAuditLog(req, {
            action: "user.deleted",
            targetType: "user",
            targetId: id,
            reason: String(req.body?.reason || "").slice(0, 500)
        });

        return res.json({ success: true });

    } catch (error) {
        console.error("ADMIN DELETE USER ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not delete this user." });
    }

};

exports.listContent = async (req, res) => {

    try {

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 24));

        const filter = {};

        if (["post", "reel"].includes(req.query.kind)) {
            filter.kind = req.query.kind;
        }

        if (isId(req.query.author)) {
            filter.author = req.query.author;
        }

        const [items, total] = await Promise.all([
            Post.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate("author", AUTHOR)
                .select("kind caption media createdAt views likes comments author")
                .lean(),
            Post.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            items: items.map(p => ({
                _id: p._id,
                kind: p.kind,
                caption: p.caption,
                media: p.media,
                createdAt: p.createdAt,
                moderationStatus: p.moderationStatus || "visible",
                moderationReason: p.moderationReason || "",
                views: p.views || 0,
                likeCount: (p.likes || []).length,
                commentCount: (p.comments || []).length,
                author: p.author
            })),
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit))
        });

    } catch (error) {
        console.error("ADMIN LIST CONTENT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load content." });
    }

};
