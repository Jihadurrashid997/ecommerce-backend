const mongoose = require("mongoose");
const PlatformNotification = require("../models/PlatformNotification");
const User = require("../models/User");

const preferenceForType = type => {
    if (type === "follow") return "follows";
    if (["post", "post_like", "post_comment"].includes(type)) return "posts";
    if (type === "community") return "communities";
    return "announcements";
};

const notifyUser = async (recipient, notification) => {
    if (mongoose.connection.readyState !== 1) {
        return false;
    }
    if (!recipient || String(recipient) === String(notification.actor || "")) {
        return false;
    }

    try {
        const user = await User.findById(recipient)
            .select("notificationPreferences")
            .lean();
        if (!user || user.notificationPreferences?.[preferenceForType(notification.type)] === false) {
            return false;
        }

        await PlatformNotification.create({
            ...notification,
            recipient
        });
        return true;
    } catch (error) {
        console.error("PLATFORM NOTIFICATION CREATE ERROR:", error);
        return false;
    }
};

const notifyUsers = async (recipients, notification) => {
    if (mongoose.connection.readyState !== 1) {
        return 0;
    }
    const actorId = String(notification.actor || "");
    const uniqueRecipients = [...new Set(
        (recipients || [])
            .map(recipient => String(recipient?._id || recipient))
            .filter(recipient => recipient && recipient !== actorId)
    )];

    if (!uniqueRecipients.length) {
        return 0;
    }

    try {
        const preference = preferenceForType(notification.type);
        const eligibleUsers = await User.find({
            _id: { $in: uniqueRecipients },
            [`notificationPreferences.${preference}`]: { $ne: false }
        }).select("_id").lean();
        const documents = eligibleUsers.map(user => ({
            ...notification,
            recipient: user._id
        }));

        for (let offset = 0; offset < documents.length; offset += 500) {
            await PlatformNotification.insertMany(
                documents.slice(offset, offset + 500),
                { ordered: false }
            );
        }
        return documents.length;
    } catch (error) {
        console.error("PLATFORM NOTIFICATION BROADCAST ERROR:", error);
        return null;
    }
};

const notifyFollowers = async (userId, notification) => {
    if (mongoose.connection.readyState !== 1) {
        return 0;
    }
    try {
        const user = await User.findById(userId).select("following").lean();
        return await notifyUsers(user?.following, {
            ...notification,
            actor: userId
        });
    } catch (error) {
        console.error("PLATFORM FOLLOWER NOTIFICATION ERROR:", error);
        return null;
    }
};

module.exports = {
    notifyUser,
    notifyUsers,
    notifyFollowers
};
