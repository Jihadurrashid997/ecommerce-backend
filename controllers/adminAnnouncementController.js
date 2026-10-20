const User = require("../models/User");
const { notifyUsers } = require("../services/platformNotifications");

const sendAnnouncement = async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const audience = req.body?.audience || "all";

    if (title.length < 3 || title.length > 100) {
        return res.status(400).json({
            success: false,
            message: "Announcement titles must be between 3 and 100 characters."
        });
    }

    if (message.length < 3 || message.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Announcement messages must be between 3 and 500 characters."
        });
    }

    if (!["all", "customer", "seller"].includes(audience)) {
        return res.status(400).json({
            success: false,
            message: "Choose a valid announcement audience."
        });
    }

    try {
        const filter = {
            isSuspended: { $ne: true },
            role: audience === "all"
                ? { $ne: "admin" }
                : audience
        };
        const recipients = await User.find(filter).select("_id").lean();

        const recipientCount = await notifyUsers(recipients, {
            actor: req.user.id,
            type: "announcement",
            title,
            message,
            link: "/"
        });

        if (recipientCount === null) {
            return res.status(500).json({
                success: false,
                message: "Could not send the announcement."
            });
        }

        return res.status(201).json({
            success: true,
            recipientCount
        });
    } catch (error) {
        console.error("SEND PLATFORM ANNOUNCEMENT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not send the announcement."
        });
    }
};

module.exports = { sendAnnouncement };
