const DeviceSession = require("../models/DeviceSession");
const { isPushConfigured } = require("../services/pushNotifications");

const getUserId = req => req.user?._id || req.user?.id;
const getSessionId = req => req.user?.sid;
const isSupportedPushEndpoint = value => {
    try {
        const endpoint = new URL(value);
        const hostname = endpoint.hostname.toLowerCase();
        const providerAllowed =
            hostname === "fcm.googleapis.com" ||
            hostname.endsWith(".push.services.mozilla.com") ||
            hostname === "push.services.mozilla.com" ||
            hostname.endsWith(".push.apple.com") ||
            hostname.endsWith(".notify.windows.com");
        return (
            endpoint.protocol === "https:" &&
            endpoint.port === "" &&
            !endpoint.username &&
            !endpoint.password &&
            providerAllowed
        );
    } catch {
        return false;
    }
};

exports.listDevices = async (req, res) => {
    try {
        const devices = await DeviceSession.find({
            user: getUserId(req)
        })
            .select(
                "deviceId name lastActiveAt createdAt sessionId pushSubscription.endpoint"
            )
            .sort({ lastActiveAt: -1 })
            .lean();

        return res.json({
            success: true,
            data: devices.map(device => ({
                deviceId: device.deviceId,
                name: device.name,
                lastActiveAt: device.lastActiveAt,
                createdAt: device.createdAt,
                isCurrent: device.sessionId === getSessionId(req),
                hasPushSubscription: Boolean(device.pushSubscription?.endpoint)
            }))
        });
    } catch (error) {
        console.error("LIST MESSENGER DEVICES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load linked devices."
        });
    }
};

exports.revokeDevice = async (req, res) => {
    try {
        const deviceId = String(req.params.deviceId || "");
        if (!/^[a-f\d-]{16,80}$/i.test(deviceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid device."
            });
        }

        const current = await DeviceSession.findOne({
            user: getUserId(req),
            sessionId: getSessionId(req)
        }).select("deviceId");
        if (current?.deviceId === deviceId) {
            return res.status(409).json({
                success: false,
                message: "Use log out on this device instead."
            });
        }

        const target = await DeviceSession.findOne({
            user: getUserId(req),
            deviceId
        });
        if (!target) {
            return res.status(404).json({
                success: false,
                message: "Linked device not found."
            });
        }
        await target.deleteOne();

        req.app.get("io")
            ?.in(`device:${target.sessionId}`)
            .disconnectSockets(true);

        return res.json({
            success: true,
            message: "Device access was revoked."
        });
    } catch (error) {
        console.error("REVOKE MESSENGER DEVICE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not revoke this device."
        });
    }
};

exports.savePushSubscription = async (req, res) => {
    try {
        const subscription = req.body?.subscription;
        if (
            !subscription ||
            typeof subscription.endpoint !== "string" ||
            !isSupportedPushEndpoint(subscription.endpoint) ||
            subscription.endpoint.length > 2048 ||
            typeof subscription.keys?.p256dh !== "string" ||
            subscription.keys.p256dh.length > 256 ||
            typeof subscription.keys?.auth !== "string" ||
            subscription.keys.auth.length > 128
        ) {
            return res.status(400).json({
                success: false,
                message: "The browser push subscription is invalid."
            });
        }

        if (!isPushConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Background notifications are not configured on the server yet."
            });
        }

        const saved = await DeviceSession.findOneAndUpdate(
            {
                user: getUserId(req),
                sessionId: getSessionId(req)
            },
            {
                $set: {
                    pushSubscription: {
                        endpoint: subscription.endpoint,
                        expirationTime: subscription.expirationTime || null,
                        keys: {
                            p256dh: subscription.keys.p256dh,
                            auth: subscription.keys.auth
                        }
                    }
                }
            },
            { new: true }
        );
        if (!saved) {
            return res.status(401).json({
                success: false,
                message: "This device session is no longer active."
            });
        }

        return res.json({
            success: true,
            message: "Background notifications are enabled on this device."
        });
    } catch (error) {
        console.error("SAVE PUSH SUBSCRIPTION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not enable background notifications."
        });
    }
};

exports.removePushSubscription = async (req, res) => {
    try {
        await DeviceSession.updateOne(
            {
                user: getUserId(req),
                sessionId: getSessionId(req)
            },
            { $unset: { pushSubscription: 1 } }
        );
        return res.json({
            success: true,
            message: "Background notifications are disabled on this device."
        });
    } catch (error) {
        console.error("REMOVE PUSH SUBSCRIPTION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not disable background notifications."
        });
    }
};

exports.logoutDevice = async (req, res) => {
    try {
        if (getSessionId(req)) {
            await DeviceSession.deleteOne({
                user: getUserId(req),
                sessionId: getSessionId(req)
            });
            req.app.get("io")
                ?.in(`device:${getSessionId(req)}`)
                .disconnectSockets(true);
        }
        return res.json({ success: true, message: "Logged out." });
    } catch (error) {
        console.error("LOGOUT DEVICE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not log out this device."
        });
    }
};
