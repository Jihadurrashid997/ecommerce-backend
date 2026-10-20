const mongoose = require("mongoose");
const ShopNotification = require("../models/ShopNotification");
const User = require("../models/User");

const SHOP_NOTIFICATION_PREFERENCES = [
    "orders",
    "refundsAndPayouts",
    "products"
];

exports.getShopNotificationPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("shopNotificationPreferences")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const preferences = user.shopNotificationPreferences || {};
        return res.json({
            success: true,
            preferences: {
                orders: preferences.orders !== false,
                refundsAndPayouts: preferences.refundsAndPayouts !== false,
                products: preferences.products !== false
            }
        });
    } catch (error) {
        console.error("GET SHOP NOTIFICATION PREFERENCES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load Shop notification settings."
        });
    }
};

exports.updateShopNotificationPreferences = async (req, res) => {
    const preferences = req.body?.preferences;

    if (
        !preferences ||
        typeof preferences !== "object" ||
        Array.isArray(preferences) ||
        Object.keys(preferences).length === 0 ||
        Object.keys(preferences).some(key =>
            !SHOP_NOTIFICATION_PREFERENCES.includes(key) ||
            typeof preferences[key] !== "boolean"
        )
    ) {
        return res.status(400).json({
            success: false,
            message: "Choose valid Shop notification preferences."
        });
    }

    try {
        const updates = Object.fromEntries(
            Object.entries(preferences).map(([key, value]) => [
                `shopNotificationPreferences.${key}`,
                value
            ])
        );
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("shopNotificationPreferences").lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const saved = user.shopNotificationPreferences || {};
        return res.json({
            success: true,
            preferences: {
                orders: saved.orders !== false,
                refundsAndPayouts: saved.refundsAndPayouts !== false,
                products: saved.products !== false
            }
        });
    } catch (error) {
        console.error("UPDATE SHOP NOTIFICATION PREFERENCES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not save Shop notification settings."
        });
    }
};

exports.getShopNotificationUnreadCount = async (req, res) => {
    try {
        const unreadCount = await ShopNotification.countDocuments({
            recipient: req.user.id,
            readAt: null
        });
        return res.json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error("GET SHOP NOTIFICATION COUNT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load the Shop notification count."
        });
    }
};

exports.getShopNotifications = async (req, res) => {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 50)
        : 30;
    const filter = { recipient: req.user.id };

    if (req.query.before) {
        const cursor = String(req.query.before);
        const separator = cursor.lastIndexOf("_");
        const before = separator > 0
            ? new Date(cursor.slice(0, separator))
            : null;
        const beforeId = separator > 0
            ? cursor.slice(separator + 1)
            : "";
        if (
            !before ||
            Number.isNaN(before.getTime()) ||
            !mongoose.Types.ObjectId.isValid(beforeId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification cursor."
            });
        }
        filter.$or = [
            { createdAt: { $lt: before } },
            { createdAt: before, _id: { $lt: beforeId } }
        ];
    }

    try {
        const [notifications, unreadCount, total] = await Promise.all([
            ShopNotification.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .lean(),
            ShopNotification.countDocuments({
                recipient: req.user.id,
                readAt: null
            }),
            ShopNotification.countDocuments(filter)
        ]);
        const hasMore = notifications.length > limit;
        const items = hasMore ? notifications.slice(0, limit) : notifications;

        return res.json({
            success: true,
            notifications: items,
            unreadCount,
            hasMore,
            nextCursor: hasMore
                ? `${items[items.length - 1].createdAt.toISOString()}_${items[items.length - 1]._id}`
                : null,
            total
        });
    } catch (error) {
        console.error("GET SHOP NOTIFICATIONS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load Shop notifications."
        });
    }
};

exports.markShopNotificationRead = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid notification ID."
        });
    }

    try {
        const notification = await ShopNotification.findOneAndUpdate(
            {
                _id: req.params.id,
                recipient: req.user.id
            },
            { $set: { readAt: new Date() } },
            { new: true }
        ).lean();

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Shop notification not found."
            });
        }

        return res.json({ success: true, notification });
    } catch (error) {
        console.error("MARK SHOP NOTIFICATION READ ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update this Shop notification."
        });
    }
};

exports.markAllShopNotificationsRead = async (req, res) => {
    try {
        const result = await ShopNotification.updateMany(
            {
                recipient: req.user.id,
                readAt: null
            },
            { $set: { readAt: new Date() } }
        );

        return res.json({
            success: true,
            updatedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("MARK ALL SHOP NOTIFICATIONS READ ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not mark Shop notifications as read."
        });
    }
};
