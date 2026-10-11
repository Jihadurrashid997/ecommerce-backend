const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const { deleteFile, isCloudinaryConfigured } = require("../services/mediaStorage");

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

        const [
            totalUsers, customers, sellers, admins, suspended, newUsers7d,
            posts, reels, commentsAgg, messages, products
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "customer" }),
            User.countDocuments({ role: "seller" }),
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ isSuspended: true }),
            User.countDocuments({ createdAt: { $gte: weekAgo } }),
            Post.countDocuments({ kind: "post" }),
            Post.countDocuments({ kind: "reel" }),
            Post.aggregate([{ $group: { _id: null, n: { $sum: { $size: "$comments" } } } }]),
            Message.estimatedDocumentCount(),
            Product.estimatedDocumentCount()
        ]);

        return res.json({
            success: true,
            overview: {
                users: { total: totalUsers, customers, sellers, admins, suspended, newThisWeek: newUsers7d },
                content: { posts, reels, comments: commentsAgg[0]?.n || 0 },
                messages,
                products,
                mediaStorage: isCloudinaryConfigured() ? "cloudinary" : "server-disk (temporary)"
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
        if (req.query.status === "active") filter.isSuspended = { $ne: true };

        const [items, total] = await Promise.all([
            User.find(filter)
                .select("name email role profileImage location createdAt lastSeen isSuspended")
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
                    .select("kind caption media createdAt")
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

        await User.updateOne(
            { _id: id },
            suspend
                ? {
                    $set: {
                        isSuspended: true,
                        suspendedReason: String(req.body?.reason || "").slice(0, 300),
                        suspendedAt: new Date()
                    }
                }
                : {
                    $set: { isSuspended: false, suspendedReason: "" },
                    $unset: { suspendedAt: "" }
                }
        );

        auth.invalidate(id);

        return res.json({ success: true, isSuspended: suspend });

    } catch (error) {
        console.error("ADMIN SUSPEND ERROR:", error);
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

        const result = await User.updateOne({ _id: id }, { $set: { role } });

        if (!result.matchedCount) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        auth.invalidate(id);

        return res.json({ success: true, role });

    } catch (error) {
        console.error("ADMIN SET ROLE ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not change the role." });
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
