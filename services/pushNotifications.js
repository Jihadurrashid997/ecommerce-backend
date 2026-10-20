const DeviceSession = require("../models/DeviceSession");

let webPush;

exports.isPushConfigured = () =>
    Boolean(
        process.env.VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
    );

const getWebPush = () => {
    if (webPush) {
        return webPush;
    }

    if (
        !exports.isPushConfigured()
    ) {
        return null;
    }

    webPush = require("web-push");
    webPush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    return webPush;
};

exports.sendPushToUsers = async ({
    userIds,
    title = "New message",
    url = "/messenger",
    tag = "messenger-message"
}) => {
    const push = getWebPush();
    if (!push) {
        return;
    }

    const recipients = [...new Set(
        (userIds || []).map(id => String(id)).filter(Boolean)
    )];
    if (!recipients.length) {
        return;
    }

    const devices = await DeviceSession.find({
        user: { $in: recipients },
        pushSubscription: { $exists: true }
    }).select("_id pushSubscription");

    await Promise.all(devices.map(async device => {
        try {
            await push.sendNotification(
                device.pushSubscription,
                JSON.stringify({
                    title,
                    body: "Open Messenger to view your message.",
                    url,
                    tag
                }),
                { TTL: 60 * 60 }
            );
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await DeviceSession.updateOne(
                    { _id: device._id },
                    { $unset: { pushSubscription: 1 } }
                );
                return;
            }
            console.error("SEND MESSENGER PUSH ERROR:", error);
        }
    }));
};
