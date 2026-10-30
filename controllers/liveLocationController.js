const mongoose = require("mongoose");
const LiveLocationShare = require("../models/LiveLocationShare");
const GroupConversation = require("../models/GroupConversation");
const Message = require("../models/Message");
const User = require("../models/User");
const {
    getDirectMessagePermission
} = require("../services/messengerConversationAccess");

const ALLOWED_DURATIONS_MINUTES = new Set([15, 60, 480]);
const getUserId = req =>
    req.user?._id || req.user?.id || req.user?.userId || null;
const isValidObjectId = id => mongoose.Types.ObjectId.isValid(id);
const validCoordinates = (latitude, longitude) =>
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

const serializeShare = share => ({
    _id: String(share._id),
    sender: String(share.sender),
    recipient: share.recipient ? String(share.recipient) : null,
    groupId: share.groupId ? String(share.groupId) : null,
    latitude: share.latitude,
    longitude: share.longitude,
    expiresAt: share.expiresAt,
    updatedAt: share.updatedAt
});

const emitToMembers = (req, memberIds, event, payload) => {
    const io = req.app?.get("io");
    if (!io) {
        return;
    }

    [...new Set(memberIds.map(String))].forEach(memberId => {
        io.to(`user:${memberId}`).emit(event, payload);
    });
};

const getSharePermission = async share => {
    if (share.groupId) {
        const group = await GroupConversation.findOne({
            _id: share.groupId
        }).select("participants").lean();
        const memberIds = (group?.participants || []).map(String);
        return {
            allowed: memberIds.includes(String(share.sender)),
            memberIds
        };
    }

    const permission = await getDirectMessagePermission({
        User,
        Message,
        senderId: share.sender,
        recipientId: share.recipient
    });
    return {
        allowed: permission.canSendMessage,
        memberIds: [String(share.sender), String(share.recipient)]
    };
};

exports.startLiveLocation = async (req, res) => {
    try {
        const senderId = getUserId(req);
        const durationMinutes = Number(req.body?.durationMinutes);
        const latitude = Number(req.body?.latitude);
        const longitude = Number(req.body?.longitude);
        const groupId = req.body?.groupId || null;
        const recipientId = req.body?.recipientId || null;

        if (
            !ALLOWED_DURATIONS_MINUTES.has(durationMinutes) ||
            !validCoordinates(latitude, longitude) ||
            Boolean(groupId) === Boolean(recipientId) ||
            (groupId && !isValidObjectId(groupId)) ||
            (recipientId &&
                (!isValidObjectId(recipientId) ||
                    String(senderId) === String(recipientId)))
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid recipient, duration, and location."
            });
        }

        let memberIds;
        let shareFilter;
        if (groupId) {
            const group = await GroupConversation.findOne({
                _id: groupId,
                participants: senderId
            }).select("participants").lean();
            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: "Group not found."
                });
            }
            memberIds = group.participants.map(String);
            shareFilter = {
                sender: senderId,
                recipient: null,
                groupId
            };
        } else {
            const permission = await getDirectMessagePermission({
                User,
                Message,
                senderId,
                recipientId
            });
            if (!permission.canSendMessage) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot share live location with this user."
                });
            }
            memberIds = [String(senderId), String(recipientId)];
            shareFilter = {
                sender: senderId,
                recipient: recipientId,
                groupId: null
            };
        }

        const expiresAt = new Date(
            Date.now() + durationMinutes * 60 * 1000
        );
        const approximateLatitude = Number(latitude.toFixed(4));
        const approximateLongitude = Number(longitude.toFixed(4));
        const share = await LiveLocationShare.findOneAndUpdate(
            shareFilter,
            {
                $set: {
                    latitude: approximateLatitude,
                    longitude: approximateLongitude,
                    expiresAt
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const payload = serializeShare(share);
        emitToMembers(req, memberIds, "live-location-updated", payload);

        return res.status(201).json({
            success: true,
            data: payload
        });
    } catch (error) {
        console.error("START LIVE LOCATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not start live location sharing."
        });
    }
};

exports.updateLiveLocation = async (req, res) => {
    try {
        const senderId = getUserId(req);
        const { shareId } = req.params;
        const latitude = Number(req.body?.latitude);
        const longitude = Number(req.body?.longitude);

        if (!isValidObjectId(shareId) || !validCoordinates(latitude, longitude)) {
            return res.status(400).json({
                success: false,
                message: "A valid active share and location are required."
            });
        }

        const share = await LiveLocationShare.findOneAndUpdate(
            {
                _id: shareId,
                sender: senderId,
                expiresAt: { $gt: new Date() }
            },
            {
                $set: {
                    latitude: Number(latitude.toFixed(4)),
                    longitude: Number(longitude.toFixed(4))
                }
            },
            { new: true }
        );
        if (!share) {
            return res.status(404).json({
                success: false,
                message: "Live location sharing has ended."
            });
        }

        const access = await getSharePermission(share);
        if (!access.allowed) {
            await LiveLocationShare.deleteOne({ _id: share._id });
            emitToMembers(
                req,
                access.memberIds,
                "live-location-stopped",
                { shareId: String(share._id) }
            );
            return res.status(403).json({
                success: false,
                message: "You can no longer share location in this conversation."
            });
        }

        const payload = serializeShare(share);
        emitToMembers(req, access.memberIds, "live-location-updated", payload);
        return res.json({
            success: true,
            data: payload
        });
    } catch (error) {
        console.error("UPDATE LIVE LOCATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update live location."
        });
    }
};

exports.stopLiveLocation = async (req, res) => {
    try {
        const senderId = getUserId(req);
        const { shareId } = req.params;
        if (!isValidObjectId(shareId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid live location share."
            });
        }

        const share = await LiveLocationShare.findOneAndDelete({
            _id: shareId,
            sender: senderId
        });
        if (!share) {
            return res.status(404).json({
                success: false,
                message: "Live location share not found."
            });
        }

        const access = await getSharePermission(share);
        emitToMembers(
            req,
            access.memberIds,
            "live-location-stopped",
            { shareId: String(share._id) }
        );
        return res.json({ success: true });
    } catch (error) {
        console.error("STOP LIVE LOCATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not stop live location sharing."
        });
    }
};

exports.getLiveLocations = async (req, res) => {
    try {
        const userId = getUserId(req);
        const groupId = req.query?.groupId || null;
        const peerId = req.query?.peerId || null;
        if (
            Boolean(groupId) === Boolean(peerId) ||
            (groupId && !isValidObjectId(groupId)) ||
            (peerId && !isValidObjectId(peerId))
        ) {
            return res.status(400).json({
                success: false,
                message: "Choose a valid group or conversation."
            });
        }

        let shares;
        if (groupId) {
            const group = await GroupConversation.findOne({
                _id: groupId,
                participants: userId
            }).select("_id participants").lean();
            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: "Group not found."
                });
            }
            shares = await LiveLocationShare.find({
                groupId,
                sender: { $in: group.participants },
                expiresAt: { $gt: new Date() }
            }).lean();
        } else {
            const permission = await getDirectMessagePermission({
                User,
                Message,
                senderId: userId,
                recipientId: peerId
            });
            if (!permission.canSendMessage) {
                return res.status(403).json({
                    success: false,
                    message: "This conversation is unavailable."
                });
            }
            shares = await LiveLocationShare.find({
                recipient: { $in: [userId, peerId] },
                sender: { $in: [userId, peerId] },
                groupId: null,
                expiresAt: { $gt: new Date() }
            }).lean();
        }

        const permittedShares = [];
        for (const share of shares) {
            const permission = await getSharePermission(share);
            if (permission.allowed) {
                permittedShares.push(serializeShare(share));
            } else {
                await LiveLocationShare.deleteOne({ _id: share._id });
                emitToMembers(
                    req,
                    permission.memberIds,
                    "live-location-stopped",
                    { shareId: String(share._id) }
                );
            }
        }

        return res.json({
            success: true,
            data: permittedShares
        });
    } catch (error) {
        console.error("GET LIVE LOCATIONS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load live locations."
        });
    }
};
