const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Story = require("../models/Story");
const Community = require("../models/Community");
const Message = require("../models/Message");
const MessageRequest = require("../models/MessageRequest");
const ContentReport = require("../models/ContentReport");
const UserReport = require("../models/UserReport");
const AdminAuditLog = require("../models/AdminAuditLog");
const PlatformSettings = require("../models/PlatformSettings");
const auth = require("../middleware/auth");
const { writeAuditLog } = require("../services/adminAudit");

const isId = id => mongoose.Types.ObjectId.isValid(id);
const allowedTypes = new Set(["post", "reel", "community", "profile", "message"]);
const authorFields = "name email profileImage role isVerified";

const reportTarget = async (targetType, targetId) => {
    if (targetType === "post" || targetType === "reel") {
        const post = await Post.findById(targetId).select("kind author");
        if (!post || post.kind !== targetType) return null;
        return { owner: post.author };
    }
    if (targetType === "profile") {
        const user = await User.findById(targetId).select("_id");
        return user ? { owner: user._id } : null;
    }
    if (targetType === "community") {
        const community = await Community.findById(targetId).select("createdBy");
        return community ? { owner: community.createdBy } : null;
    }
    const message = await Message.findById(targetId).select("sender receiver");
    if (message) {
        return {
            owner: message.sender,
            participants: [message.sender, message.receiver].filter(Boolean)
        };
    }
    const request = await MessageRequest.findById(targetId).select("sender recipient");
    return request
        ? { owner: request.sender, participants: [request.sender, request.recipient].filter(Boolean) }
        : null;
};

exports.createReport = async (req, res) => {
    const { targetType } = req.body || {};
    const targetId = String(req.body?.targetId || "");
    const reason = String(req.body?.reason || "").trim();

    if (!allowedTypes.has(targetType) || !isId(targetId)) {
        return res.status(400).json({ success: false, message: "Choose a valid item to report." });
    }
    if (!reason || reason.length > 500) {
        return res.status(400).json({ success: false, message: "Report reason must be 1 to 500 characters." });
    }

    try {
        const target = await reportTarget(targetType, targetId);
        if (!target) {
            return res.status(404).json({ success: false, message: "Reported item not found." });
        }
        if (target.participants && !target.participants.some(id => String(id) === String(req.user.id))) {
            return res.status(403).json({ success: false, message: "You cannot report a message you are not part of." });
        }
        if (String(target.owner) === String(req.user.id)) {
            return res.status(400).json({ success: false, message: "You cannot report your own item." });
        }

        await ContentReport.create({
            reporter: req.user.id,
            targetType,
            targetId,
            targetOwner: target.owner,
            reason
        });
        return res.status(201).json({ success: true });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "You have already reported this item." });
        }
        console.error("CREATE CONTENT REPORT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not submit the report." });
    }
};

const enrichReport = async report => {
    if (report.legacy) {
        const request = await MessageRequest.findById(report.messageRequest)
            .select("_id sender recipient message isEncrypted fileName fileType createdAt")
            .lean();
        return {
            _id: report._id,
            targetType: "message",
            targetId: report.messageRequest,
            targetOwner: report.reportedUser,
            reporter: report.reporter,
            reason: report.reason,
            status: report.status === "open" ? "pending" : report.status === "dismissed" ? "dismissed" : "resolved",
            createdAt: report.createdAt,
            target: request ? {
                _id: request._id,
                sender: request.sender,
                recipient: request.recipient,
                isEncrypted: request.isEncrypted,
                fileName: request.fileName,
                fileType: request.fileType,
                createdAt: request.createdAt
            } : null,
            legacy: true
        };
    }

    const item = {
        _id: report.targetId,
        type: report.targetType
    };
    if (report.targetType === "post" || report.targetType === "reel") {
        const post = await Post.findById(report.targetId)
            .select("kind caption media moderationStatus createdAt")
            .populate("author", authorFields)
            .lean();
        if (post) Object.assign(item, post);
    } else if (report.targetType === "community") {
        const community = await Community.findById(report.targetId)
            .select("name description privacy createdBy isHidden isClosed createdAt")
            .populate("createdBy", authorFields)
            .lean();
        if (community) Object.assign(item, community);
    } else if (report.targetType === "profile") {
        const profile = await User.findById(report.targetId)
            .select("name email profileImage isVerified isSuspended createdAt")
            .lean();
        if (profile) Object.assign(item, profile);
    } else {
        const message = await Message.findById(report.targetId)
            .select("sender receiver isEncrypted createdAt")
            .populate("sender", authorFields)
            .populate("receiver", authorFields)
            .lean();
        if (message) Object.assign(item, message);
    }

    return { ...report, target: item };
};

exports.listReports = async (req, res) => {
    try {
        const page = Math.min(500, Math.max(1, Number(req.query.page) || 1));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const status = ["pending", "resolved", "dismissed"].includes(req.query.status)
            ? req.query.status
            : "pending";
        const type = allowedTypes.has(req.query.type) ? req.query.type : "";

        const filter = { status };
        if (type) filter.targetType = type;
        const legacyFilter = {
            status: status === "pending" ? "open" : status === "dismissed" ? "dismissed" : "reviewed"
        };

        const includeLegacy = !type || type === "message";
        const [newReports, oldReports, newTotal, oldTotal] = await Promise.all([
            ContentReport.find(filter).populate("reporter", "name").sort({ createdAt: -1 }).limit(page * limit).lean(),
            includeLegacy
                ? UserReport.find(legacyFilter).populate("reporter", "name").sort({ createdAt: -1 }).limit(page * limit).lean()
                : [],
            ContentReport.countDocuments(filter),
            includeLegacy ? UserReport.countDocuments(legacyFilter) : 0
        ]);
        const rows = [
            ...newReports.map(report => ({ ...report, legacy: false })),
            ...oldReports.map(report => ({ ...report, legacy: true }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const total = newTotal + oldTotal;
        const pageRows = rows.slice((page - 1) * limit, page * limit);
        const items = await Promise.all(pageRows.map(enrichReport));

        return res.json({
            success: true,
            items,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (error) {
        console.error("ADMIN LIST REPORTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load reports." });
    }
};

exports.listRepeatedlyReportedUsers = async (_req, res) => {
    try {
        const [current, legacy] = await Promise.all([
            ContentReport.aggregate([
                { $match: { status: "pending", targetOwner: { $ne: null } } },
                { $group: { _id: "$targetOwner", reports: { $sum: 1 } } }
            ]),
            UserReport.aggregate([
                { $match: { status: "open" } },
                { $group: { _id: "$reportedUser", reports: { $sum: 1 } } }
            ])
        ]);
        const counts = new Map();
        [...current, ...legacy].forEach(row => {
            const key = String(row._id);
            counts.set(key, (counts.get(key) || 0) + row.reports);
        });
        const ranked = [...counts.entries()]
            .filter(([, reports]) => reports >= 3)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100);
        const users = await User.find({ _id: { $in: ranked.map(([id]) => id) } })
            .select("name email profileImage role isSuspended isBanned")
            .lean();
        const userById = new Map(users.map(user => [String(user._id), user]));
        return res.json({
            success: true,
            items: ranked.map(([id, reports]) => ({
                user: userById.get(id) || { _id: id, name: "Deleted user" },
                pendingReports: reports
            }))
        });
    } catch (error) {
        console.error("ADMIN REPEATED REPORTS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load repeatedly reported users." });
    }
};

exports.reviewReport = async (req, res) => {
    const { id } = req.params;
    const status = req.body?.status;
    const resolution = String(req.body?.resolution || "").trim();
    if (!isId(id) || !["resolved", "dismissed"].includes(status)) {
        return res.status(400).json({ success: false, message: "Choose a valid report status." });
    }
    if (resolution.length > 500) {
        return res.status(400).json({ success: false, message: "Resolution must be 500 characters or fewer." });
    }

    try {
        const report = await ContentReport.findByIdAndUpdate(
            id,
            { $set: { status, resolution, reviewedBy: req.user.id, reviewedAt: new Date() } },
            { new: true, runValidators: true }
        );
        if (!report) return res.status(404).json({ success: false, message: "Report not found." });

        await writeAuditLog(req, {
            action: `report.${status}`,
            targetType: "report",
            targetId: report._id,
            reason: resolution,
            details: { targetType: report.targetType, targetId: String(report.targetId) }
        });
        return res.json({ success: true, report });
    } catch (error) {
        console.error("ADMIN REVIEW REPORT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update this report." });
    }
};

exports.reviewLegacyMessageReport = async (req, res) => {
    if (!isId(req.params.id) || !["resolved", "dismissed"].includes(req.body?.status)) {
        return res.status(400).json({ success: false, message: "Choose a valid report status." });
    }
    try {
        const status = req.body.status === "dismissed" ? "dismissed" : "reviewed";
        const report = await UserReport.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true }
        );
        if (!report) return res.status(404).json({ success: false, message: "Report not found." });
        await writeAuditLog(req, {
            action: `message_report.${req.body.status}`,
            targetType: "user_report",
            targetId: report._id,
            reason: String(req.body?.resolution || "").slice(0, 500)
        });
        return res.json({ success: true });
    } catch (error) {
        console.error("ADMIN REVIEW LEGACY REPORT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update this report." });
    }
};

exports.moderateContent = async (req, res) => {
    const { id } = req.params;
    const action = req.body?.action;
    const reason = String(req.body?.reason || "").trim();
    if (!isId(id) || !["hide", "restore", "delete"].includes(action)) {
        return res.status(400).json({ success: false, message: "Choose a valid moderation action." });
    }
    if (action !== "restore" && !reason) {
        return res.status(400).json({ success: false, message: "A reason is required." });
    }

    try {
        const post = await Post.findById(id).select("kind media moderationStatus");
        if (!post) return res.status(404).json({ success: false, message: "Content not found." });
        const now = new Date();
        if (action === "delete") {
            post.moderationStatus = "deleted";
            post.deletedAt = now;
            post.hiddenAt = now;
            post.moderationReason = reason;
        } else if (action === "hide") {
            post.moderationStatus = "hidden";
            post.hiddenAt = now;
            post.deletedAt = undefined;
            post.moderationReason = reason;
        } else {
            post.moderationStatus = "visible";
            post.hiddenAt = undefined;
            post.deletedAt = undefined;
            post.moderationReason = "";
        }
        post.moderatedBy = req.user.id;
        await post.save();
        await writeAuditLog(req, {
            action: `content.${action}`,
            targetType: post.kind,
            targetId: post._id,
            reason
        });
        return res.json({ success: true, moderationStatus: post.moderationStatus });
    } catch (error) {
        console.error("ADMIN MODERATE CONTENT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not moderate this content." });
    }
};

exports.listCommunities = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const search = String(req.query.search || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const filter = search ? { name: new RegExp(search, "i") } : {};
        const [items, total] = await Promise.all([
            Community.find(filter).populate("createdBy", "name email").sort({ createdAt: -1 })
                .skip((page - 1) * limit).limit(limit).lean(),
            Community.countDocuments(filter)
        ]);
        return res.json({ success: true, items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        console.error("ADMIN LIST COMMUNITIES ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load communities." });
    }
};

exports.moderateCommunity = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body || {};
    const reason = String(req.body?.reason || "").trim();
    if (!isId(id) || !["hide", "restore", "close", "open", "transfer"].includes(action)) {
        return res.status(400).json({ success: false, message: "Choose a valid community action." });
    }
    if (action !== "restore" && action !== "open" && !reason) {
        return res.status(400).json({ success: false, message: "A reason is required." });
    }
    if (action === "transfer" && !isId(req.body?.ownerId)) {
        return res.status(400).json({ success: false, message: "Choose a valid new owner." });
    }

    try {
        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found." });
        if (action === "transfer") {
            const owner = await User.findById(req.body.ownerId).select("_id");
            if (!owner) return res.status(404).json({ success: false, message: "New owner not found." });
            community.createdBy = owner._id;
            community.admins.addToSet(owner._id);
        } else if (action === "hide") {
            community.isHidden = true;
            community.moderationReason = reason;
        } else if (action === "restore") {
            community.isHidden = false;
            community.moderationReason = "";
        } else if (action === "close") {
            community.isClosed = true;
            community.moderationReason = reason;
        } else {
            community.isClosed = false;
            community.moderationReason = "";
        }
        community.moderatedBy = req.user.id;
        await community.save();
        await writeAuditLog(req, {
            action: `community.${action}`,
            targetType: "community",
            targetId: community._id,
            reason,
            details: action === "transfer" ? { ownerId: String(community.createdBy) } : {}
        });
        return res.json({ success: true, community });
    } catch (error) {
        console.error("ADMIN MODERATE COMMUNITY ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update this community." });
    }
};

exports.listAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
        const [items, total] = await Promise.all([
            AdminAuditLog.find().populate("admin", "name email adminRole")
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            AdminAuditLog.countDocuments()
        ]);
        return res.json({ success: true, items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        console.error("ADMIN AUDIT LOG ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load audit logs." });
    }
};

exports.forceLogout = async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid user." });
    try {
        auth.invalidate(req.params.id);
        const DeviceSession = require("../models/DeviceSession");
        const result = await DeviceSession.deleteMany({ user: req.params.id });
        await writeAuditLog(req, {
            action: "user.force_logout",
            targetType: "user",
            targetId: req.params.id,
            reason: String(req.body?.reason || "").slice(0, 500)
        });
        return res.json({ success: true, revokedSessions: result.deletedCount || 0 });
    } catch (error) {
        console.error("ADMIN FORCE LOGOUT ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not revoke user sessions." });
    }
};

exports.getPlatformControls = async (_req, res) => {
    try {
        const settings = await PlatformSettings.findById("global").lean();
        return res.json({
            success: true,
            settings: {
                registrationEnabled: settings?.registrationEnabled !== false,
                reelMaxDurationSeconds: settings?.reelMaxDurationSeconds || 300,
                reelMaxSizeBytes: settings?.reelMaxSizeBytes || 80 * 1024 * 1024,
                prohibitedWords: settings?.prohibitedWords || []
            }
        });
    } catch (error) {
        console.error("GET ADMIN PLATFORM CONTROLS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load platform controls." });
    }
};

exports.updatePlatformControls = async (req, res) => {
    const { registrationEnabled, reelMaxDurationSeconds, reelMaxSizeBytes } = req.body || {};
    const prohibitedWords = req.body?.prohibitedWords;
    if (typeof registrationEnabled !== "boolean") {
        return res.status(400).json({ success: false, message: "Registration status must be true or false." });
    }
    if (!Number.isInteger(reelMaxDurationSeconds) || reelMaxDurationSeconds < 15 || reelMaxDurationSeconds > 300) {
        return res.status(400).json({ success: false, message: "Reel duration must be from 15 to 300 seconds." });
    }
    if (!Number.isInteger(reelMaxSizeBytes) || reelMaxSizeBytes < 1024 * 1024 || reelMaxSizeBytes > 80 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: "Reel size must be from 1 to 80 MB." });
    }
    if (!Array.isArray(prohibitedWords) || prohibitedWords.length > 200 ||
        prohibitedWords.some(word => typeof word !== "string" || !word.trim() || word.trim().length > 60)) {
        return res.status(400).json({ success: false, message: "Provide up to 200 prohibited words, each 1 to 60 characters." });
    }
    try {
        const settings = await PlatformSettings.findOneAndUpdate(
            { _id: "global" },
            { $set: { registrationEnabled, reelMaxDurationSeconds, reelMaxSizeBytes, prohibitedWords: prohibitedWords.map(word => word.trim()) } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).lean();
        await writeAuditLog(req, {
            action: "platform.settings_changed",
            targetType: "platform_settings",
            targetId: "global",
            details: { registrationEnabled, reelMaxDurationSeconds, reelMaxSizeBytes, prohibitedWordCount: prohibitedWords.length }
        });
        return res.json({
            success: true,
            settings: {
                registrationEnabled: settings.registrationEnabled,
                reelMaxDurationSeconds: settings.reelMaxDurationSeconds,
                reelMaxSizeBytes: settings.reelMaxSizeBytes,
                prohibitedWords: settings.prohibitedWords
            }
        });
    } catch (error) {
        console.error("UPDATE ADMIN PLATFORM CONTROLS ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not update platform controls." });
    }
};
