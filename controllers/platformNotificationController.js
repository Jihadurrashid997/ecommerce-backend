const mongoose = require("mongoose");
const PlatformNotification = require("../models/PlatformNotification");

const getPlatformNotifications = async (req, res) => {
    try {
        const requestedLimit = Number(req.query.limit) || 20;
        const limit = Math.max(1, Math.min(requestedLimit, 50));
        const filter = { recipient: req.user.id };

        if (req.query.before) {
            const before = new Date(req.query.before);
            if (Number.isNaN(before.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid notification cursor."
                });
            }
            filter.createdAt = { $lt: before };
        }

        const items = await PlatformNotification.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .populate("actor", "name profileImage")
            .lean();

        const hasMore = items.length > limit;
        const notifications = items.slice(0, limit);

        return res.json({
            success: true,
            notifications,
            unreadCount: await PlatformNotification.countDocuments({
                recipient: req.user.id,
                readAt: null
            }),
            nextCursor: hasMore
                ? notifications[notifications.length - 1].createdAt
                : null
        });
    } catch (error) {
        console.error("GET PLATFORM NOTIFICATIONS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load notifications."
        });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await PlatformNotification.countDocuments({
            recipient: req.user.id,
            readAt: null
        });
        return res.json({ success: true, unreadCount });
    } catch (error) {
        console.error("GET PLATFORM NOTIFICATION COUNT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load the notification count."
        });
    }
};

const markRead = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification."
            });
        }

        const notification = await PlatformNotification.findOneAndUpdate(
            {
                _id: req.params.id,
                recipient: req.user.id,
                readAt: null
            },
            { $set: { readAt: new Date() } },
            { new: true }
        );

        if (!notification) {
            const exists = await PlatformNotification.exists({
                _id: req.params.id,
                recipient: req.user.id
            });

            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found."
                });
            }
        }

        return res.json({ success: true, notification });
    } catch (error) {
        console.error("MARK PLATFORM NOTIFICATION READ ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update this notification."
        });
    }
};

const markAllRead = async (req, res) => {
    try {
        const result = await PlatformNotification.updateMany(
            { recipient: req.user.id, readAt: null },
            { $set: { readAt: new Date() } }
        );
        return res.json({ success: true, updatedCount: result.modifiedCount });
    } catch (error) {
        console.error("MARK ALL PLATFORM NOTIFICATIONS READ ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not mark notifications as read."
        });
    }
};

const clearNotifications = async (req, res) => {
    try {
        const result = await PlatformNotification.deleteMany({
            recipient: req.user.id
        });
        return res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error("CLEAR PLATFORM NOTIFICATIONS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not clear notifications."
        });
    }
};

module.exports = {
    getPlatformNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
    clearNotifications
};
