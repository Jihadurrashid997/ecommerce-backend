const mongoose = require("mongoose");
const GroupConversation = require("../models/GroupConversation");
const GroupCallKey = require("../models/GroupCallKey");
const Message = require("../models/Message");
const User = require("../models/User");
const {
    AccessToken,
    RoomServiceClient
} = require("livekit-server-sdk");

const getUserId = req =>
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    null;

const isValidObjectId = id =>
    mongoose.Types.ObjectId.isValid(id);

const groupPopulation = query =>
    query
        .populate("participants", "name username fullName displayName profileImage avatar")
        .populate("admins", "name username fullName displayName")
        .populate("createdBy", "name username fullName displayName");

const findMemberGroup = (groupId, userId) =>
    GroupConversation.findOne({
        _id: groupId,
        participants: userId
    });

const hasRegisteredEncryptionKey = user => {
    if (!user?.messengerEncryptionPublicKey) {
        return false;
    }

    try {
        const key = JSON.parse(user.messengerEncryptionPublicKey);
        return key?.kty === "EC" &&
            key?.crv === "P-256" &&
            typeof key.x === "string" &&
            /^[A-Za-z0-9_-]{40,50}$/.test(key.x) &&
            typeof key.y === "string" &&
            /^[A-Za-z0-9_-]{40,50}$/.test(key.y) &&
            key.d === undefined;
    } catch (error) {
        console.error("INVALID GROUP ENCRYPTION PUBLIC KEY:", error);
        return false;
    }
};

const notifyMembers = (req, groupId, memberIds) => {
    const io = req.app.get("io");

    if (!io) {
        return;
    }

    [...new Set(memberIds.map(String))].forEach(memberId => {
        io.to(`user:${memberId}`).emit("group-updated", {
            groupId: String(groupId)
        });
    });
};

const removeMemberFromRoom = (req, groupId, memberId) => {
    const io = req.app.get("io");

    if (io) {
        io.in(`user:${String(memberId)}`).socketsLeave(`group:${String(groupId)}`);
    }
};

const disconnectGroupCallParticipant = async (groupId, userId) => {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        return;
    }

    const roomName = `group-${String(groupId)}`;

    try {
        const roomService = new RoomServiceClient(
            LIVEKIT_URL
                .replace(/^wss:/i, "https:")
                .replace(/^ws:/i, "http:"),
            LIVEKIT_API_KEY,
            LIVEKIT_API_SECRET
        );
        const rooms = await roomService.listRooms([roomName]);

        if (rooms.some(room => room.name === roomName)) {
            await roomService.removeParticipant(
                roomName,
                String(userId)
            );
        }
    } catch (error) {
        console.error("REMOVE GROUP CALL PARTICIPANT ERROR:", error);
    }
};

const endGroupCallRoom = async groupId => {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        return;
    }

    const roomName = `group-${String(groupId)}`;

    try {
        const roomService = new RoomServiceClient(
            LIVEKIT_URL
                .replace(/^wss:/i, "https:")
                .replace(/^ws:/i, "http:"),
            LIVEKIT_API_KEY,
            LIVEKIT_API_SECRET
        );
        const rooms = await roomService.listRooms([roomName]);

        if (rooms.some(room => room.name === roomName)) {
            await roomService.deleteRoom(roomName);
        }
    } catch (error) {
        console.error("END GROUP CALL ROOM ERROR:", error);
    }
};

const hasActiveGroupCall = async groupId => {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        throw new Error("Group call service is not configured.");
    }

    const roomName = `group-${String(groupId)}`;
    const roomService = new RoomServiceClient(
        LIVEKIT_URL
            .replace(/^wss:/i, "https:")
            .replace(/^ws:/i, "http:"),
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    );
    const rooms = await roomService.listRooms([roomName]);

    if (!rooms.some(room => room.name === roomName)) {
        return false;
    }

    const participants = await roomService.listParticipants(roomName);
    return participants.length > 0;
};

const getGroupCallKeyResponse = (keyRecord, userId) => {
    const envelope = keyRecord.envelopes.find(
        item => String(item.userId) === String(userId)
    );

    if (!envelope) {
        return null;
    }

    return {
        keyId: keyRecord.keyId,
        senderId: String(keyRecord.createdBy),
        envelope: {
            iv: envelope.iv,
            wrappedKey: envelope.wrappedKey
        },
        expiresAt: keyRecord.expiresAt
    };
};

const groupCallKeyHasCurrentMembers = (keyRecord, group) => {
    const keyMembers = keyRecord.participants.map(String).sort();
    const groupMembers = group.participants.map(String).sort();

    return keyMembers.length === groupMembers.length &&
        keyMembers.every((memberId, index) => memberId === groupMembers[index]);
};

exports.setGroupEncryption = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;
        const isEncrypted = req.body?.isEncrypted;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        if (typeof isEncrypted !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Encryption must be enabled or disabled explicitly."
            });
        }

        const group = await findMemberGroup(groupId, userId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        if (!group.admins.some(id => String(id) === String(userId))) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can change encryption settings."
            });
        }

        if (isEncrypted) {
            const users = await User.find({
                _id: { $in: group.participants }
            })
                .select("+messengerEncryptionPublicKey")
                .lean();
            const readyUserIds = new Set(
                users.filter(hasRegisteredEncryptionKey).map(user =>
                    String(user._id)
                )
            );
            const missingKeys = group.participants
                .map(String)
                .filter(participantId => !readyUserIds.has(participantId));

            if (missingKeys.length) {
                return res.status(409).json({
                    success: false,
                    message: "Every group member must open Messenger and set up encryption before group encryption can be enabled.",
                    membersWithoutKeys: missingKeys
                });
            }
        }

        const encryptionChanged = group.isEncrypted !== isEncrypted;
        group.isEncrypted = isEncrypted;
        await group.save();

        if (encryptionChanged) {
            await GroupCallKey.deleteOne({ groupId: group._id });
            void endGroupCallRoom(group._id);
        }

        notifyMembers(req, group._id, group.participants);

        return res.json({
            success: true,
            data: await groupPopulation(
                GroupConversation.findById(group._id)
            )
        });
    } catch (error) {
        console.error("SET GROUP ENCRYPTION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update group encryption."
        });
    }
};

exports.listGroups = async (req, res) => {
    try {
        const userId = getUserId(req);
        const groups = await groupPopulation(
            GroupConversation.find({
                participants: userId
            }).sort({ updatedAt: -1 })
        );

        const unreadRows = groups.length
            ? await Message.aggregate([
                  {
                      $match: {
                          groupId: { $in: groups.map(group => group._id) },
                          sender: { $ne: new mongoose.Types.ObjectId(String(userId)) },
                          readBy: { $ne: new mongoose.Types.ObjectId(String(userId)) }
                      }
                  },
                  {
                      $group: {
                          _id: "$groupId",
                          count: { $sum: 1 }
                      }
                  }
              ])
            : [];
        const unreadByGroup = new Map(
            unreadRows.map(row => [String(row._id), row.count])
        );

        return res.json({
            success: true,
            data: groups.map(group => ({
                ...group.toObject(),
                unreadCount: unreadByGroup.get(String(group._id)) || 0
            }))
        });
    } catch (error) {
        console.error("LIST GROUPS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load groups."
        });
    }
};

exports.createGroup = async (req, res) => {
    try {
        const creatorId = getUserId(req);
        const name = String(req.body?.name || "").trim();
        const memberIds = Array.isArray(req.body?.memberIds)
            ? req.body.memberIds
            : [];

        if (!name || name.length > 80) {
            return res.status(400).json({
                success: false,
                message: "Group name must be between 1 and 80 characters."
            });
        }

        if (memberIds.length > 99 || memberIds.some(id => !isValidObjectId(id))) {
            return res.status(400).json({
                success: false,
                message: "Choose up to 99 valid group members."
            });
        }

        const participantIds = [
            ...new Set([String(creatorId), ...memberIds.map(String)])
        ];

        if (participantIds.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Add at least one person to create a group."
            });
        }

        const validUsers = await User.countDocuments({
            _id: { $in: participantIds }
        });

        if (validUsers !== participantIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more selected users could not be found."
            });
        }

        const group = await GroupConversation.create({
            name,
            createdBy: creatorId,
            admins: [creatorId],
            participants: participantIds
        });

        const populated = await groupPopulation(
            GroupConversation.findById(group._id)
        );

        notifyMembers(req, group._id, participantIds);

        return res.status(201).json({
            success: true,
            data: populated
        });
    } catch (error) {
        console.error("CREATE GROUP ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to create group."
        });
    }
};

exports.getGroupMessages = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        const group = await findMemberGroup(groupId, userId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const page = Number(req.query?.page ?? 1);
        const requestedLimit = Number(req.query?.limit ?? 50);

        if (
            !Number.isSafeInteger(page) ||
            page < 1 ||
            !Number.isSafeInteger(requestedLimit) ||
            requestedLimit < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive integers."
            });
        }

        const limit = Math.min(requestedLimit, 100);
        const skip = (page - 1) * limit;

        if (!Number.isSafeInteger(skip)) {
            return res.status(400).json({
                success: false,
                message: "Page is too large."
            });
        }

        const messages = await Message.find({
            groupId,
            deletedFor: { $ne: userId }
        })
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit + 1)
            .populate(
                "sender",
                "name username fullName displayName profileImage avatar isVerified"
            )
            .populate({
                path: "replyTo",
                select: "message fileUrl fileName fileType sender createdAt isEncrypted",
                populate: {
                    path: "sender",
                    select: "name username fullName displayName"
                }
            })
            .populate("reactions.user", "name username fullName displayName");

        const hasMore = messages.length > limit;
        const pageMessages = messages
            .slice(0, limit)
            .reverse();

        await Message.updateMany(
            {
                groupId,
                sender: { $ne: userId },
                deletedFor: { $ne: userId }
            },
            { $addToSet: { readBy: userId } }
        );

        return res.json({
            success: true,
            data: pageMessages,
            page,
            limit,
            hasMore
        });
    } catch (error) {
        console.error("GET GROUP MESSAGES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load group messages."
        });
    }
};

exports.createGroupCallLog = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;
        const {
            callId,
            callType,
            duration,
            participantCount
        } = req.body || {};

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        if (
            typeof callId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId) ||
            !["voice", "video"].includes(callType) ||
            !Number.isSafeInteger(duration) ||
            duration < 0 ||
            duration > 24 * 60 * 60 ||
            !Number.isSafeInteger(participantCount) ||
            participantCount < 1 ||
            participantCount > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid group call details."
            });
        }

        const group = await findMemberGroup(groupId, userId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const durationText = duration > 0
            ? ` • ${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`
            : "";
        const callLabel = callType === "video" ? "video" : "voice";
        const message = `📞 Group ${callLabel} call ended${durationText}`;
        const logData = {
            sender: userId,
            groupId,
            message,
            type: "call-log",
            callId,
            callType,
            callStatus: "ended",
            callDuration: duration,
            callParticipantCount: participantCount,
            readBy: [userId]
        };

        let callMessage;
        try {
            callMessage = await Message.findOneAndUpdate(
                { callId, groupId },
                { $setOnInsert: logData },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            );
        } catch (error) {
            if (error.code !== 11000) {
                throw error;
            }
            callMessage = await Message.findOne({ callId });
        }

        if (!callMessage) {
            throw new Error("The group call log could not be created.");
        }

        if (String(callMessage.groupId) !== String(groupId)) {
            return res.status(409).json({
                success: false,
                message: "This call ID belongs to a different conversation."
            });
        }

        group.lastMessage = {
            message: callMessage.message,
            sender: callMessage.sender,
            createdAt: callMessage.createdAt
        };
        await group.save();

        const populated = await Message.findById(callMessage._id)
            .populate(
                "sender",
                "name username fullName displayName profileImage avatar isVerified"
            );
        const io = req.app?.get("io");

        if (io && populated) {
            const serialized = {
                ...populated.toObject(),
                _id: String(populated._id),
                id: String(populated._id),
                groupId: String(groupId),
                roomId: `group:${String(groupId)}`,
                senderId: String(userId),
                senderName:
                    populated.sender?.name ||
                    populated.sender?.username ||
                    populated.sender?.fullName ||
                    populated.sender?.displayName ||
                    "Group member",
                receiver: null,
                receiverId: null,
                timestamp: new Date(populated.createdAt).getTime()
            };
            io.to(serialized.roomId).emit("group-message", serialized);
            group.participants.forEach(memberId => {
                io.to(`user:${String(memberId)}`).emit(
                    "group-message-notification",
                    serialized
                );
            });
        }

        return res.status(200).json({
            success: true,
            data: populated
        });
    } catch (error) {
        console.error("CREATE GROUP CALL LOG ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to save group call details."
        });
    }
};

exports.createGroupCallToken = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;
        const keyId = req.body?.keyId;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        const group = await GroupConversation.findOne({
            _id: groupId,
            participants: userId
        }).select("name isEncrypted participants");

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        if (group.isEncrypted) {
            const keyRecord = typeof keyId === "string"
                ? await GroupCallKey.findOne({ groupId, keyId })
                : null;
            const keyData = keyRecord &&
                keyRecord.expiresAt > new Date() &&
                groupCallKeyHasCurrentMembers(keyRecord, group)
                ? getGroupCallKeyResponse(keyRecord, userId)
                : null;

            if (!keyData) {
                return res.status(409).json({
                    success: false,
                    code: "GROUP_CALL_E2EE_KEY_REQUIRED",
                    message: "Set up end-to-end encryption before joining this group call."
                });
            }
        }

        const livekitUrl = process.env.LIVEKIT_URL;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (!livekitUrl || !apiKey || !apiSecret) {
            return res.status(503).json({
                success: false,
                message: "Group calling is not configured yet. Ask the administrator to set up the media server."
            });
        }

        const user = await User.findById(userId)
            .select("name")
            .lean();
        const token = new AccessToken(apiKey, apiSecret, {
            identity: String(userId),
            name: user?.name || "Group member",
            ttl: "10m"
        });
        token.addGrant({
            roomJoin: true,
            room: `group-${String(group._id)}`,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true
        });

        return res.json({
            success: true,
            data: {
                serverUrl: livekitUrl,
                token: await token.toJwt(),
                roomName: `group-${String(group._id)}`,
                groupName: group.name,
                isEncrypted: group.isEncrypted,
                participants: group.participants.map(String)
            }
        });
    } catch (error) {
        console.error("CREATE GROUP CALL TOKEN ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to start the group call."
        });
    }
};

exports.getGroupCallKey = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        const group = await GroupConversation.findOne({
            _id: groupId,
            participants: userId
        }).select("isEncrypted participants");

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        if (!group.isEncrypted) {
            return res.status(409).json({
                success: false,
                code: "GROUP_CALL_E2EE_DISABLED",
                message: "End-to-end call encryption is not enabled for this group."
            });
        }

        let keyRecord = await GroupCallKey.findOne({ groupId });

        if (keyRecord && !groupCallKeyHasCurrentMembers(keyRecord, group)) {
            await GroupCallKey.deleteOne({ _id: keyRecord._id });
            keyRecord = null;
        }

        if (!keyRecord) {
            return res.status(404).json({
                success: false,
                message: "A current group call encryption key is not available."
            });
        }

        if (keyRecord.expiresAt <= new Date()) {
            if (!await hasActiveGroupCall(groupId)) {
                await GroupCallKey.deleteOne({ _id: keyRecord._id });
                return res.status(404).json({
                    success: false,
                    message: "The previous group call encryption key has expired."
                });
            }

            keyRecord.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            await keyRecord.save();
        }

        const data = getGroupCallKeyResponse(keyRecord, userId);

        if (!data) {
            return res.status(409).json({
                success: false,
                code: "GROUP_CALL_KEY_UNAVAILABLE",
                message: "A group call key is not available for this member."
            });
        }

        return res.json({ success: true, data });
    } catch (error) {
        console.error("GET GROUP CALL KEY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load the group call encryption key."
        });
    }
};

exports.createGroupCallKey = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;
        const { keyId, envelopes } = req.body || {};

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        const group = await GroupConversation.findOne({
            _id: groupId,
            participants: userId
        }).select("isEncrypted participants");

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        if (!group.isEncrypted) {
            return res.status(409).json({
                success: false,
                message: "End-to-end call encryption is not enabled for this group."
            });
        }

        const memberIds = group.participants.map(String).sort();
        const envelopeIds = Array.isArray(envelopes)
            ? envelopes.map(envelope => String(envelope?.userId)).sort()
            : [];

        if (
            typeof keyId !== "string" ||
            !/^[A-Za-z0-9_-]{22}$/.test(keyId) ||
            !Array.isArray(envelopes) ||
            envelopes.length !== memberIds.length ||
            new Set(envelopeIds).size !== envelopeIds.length ||
            envelopeIds.some((memberId, index) => memberId !== memberIds[index]) ||
            envelopes.some(envelope =>
                typeof envelope?.iv !== "string" ||
                !/^[A-Za-z0-9_-]{16}$/.test(envelope.iv) ||
                typeof envelope?.wrappedKey !== "string" ||
                !/^[A-Za-z0-9_-]{64}$/.test(envelope.wrappedKey)
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "The group call encryption key envelopes are invalid."
            });
        }

        const now = new Date();
        let keyRecord = await GroupCallKey.findOne({ groupId });

        if (keyRecord && !groupCallKeyHasCurrentMembers(keyRecord, group)) {
            await GroupCallKey.deleteOne({ _id: keyRecord._id });
            keyRecord = null;
        }

        if (keyRecord && keyRecord.expiresAt > now) {
            const data = getGroupCallKeyResponse(keyRecord, userId);

            return data
                ? res.json({ success: true, data })
                : res.status(409).json({
                      success: false,
                      message: "A group call key is not available for this member."
                  });
        }

        if (keyRecord && await hasActiveGroupCall(groupId)) {
            keyRecord.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            await keyRecord.save();
            const data = getGroupCallKeyResponse(keyRecord, userId);

            return data
                ? res.json({ success: true, data })
                : res.status(409).json({
                      success: false,
                      message: "A group call key is not available for this member."
                  });
        }

        const replacement = {
            groupId,
            keyId,
            createdBy: userId,
            participants: group.participants,
            envelopes,
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
        };

        if (keyRecord) {
            keyRecord = await GroupCallKey.findOneAndReplace(
                { _id: keyRecord._id, expiresAt: { $lte: now } },
                replacement,
                { new: true, runValidators: true }
            );
        } else {
            try {
                keyRecord = await GroupCallKey.create(replacement);
            } catch (error) {
                if (error.code !== 11000) {
                    throw error;
                }

                keyRecord = await GroupCallKey.findOne({ groupId });
            }
        }

        if (!keyRecord) {
            keyRecord = await GroupCallKey.findOne({ groupId });
        }

        if (!keyRecord || !groupCallKeyHasCurrentMembers(keyRecord, group)) {
            return res.status(409).json({
                success: false,
                message: "Could not establish a current group call encryption key."
            });
        }

        const data = getGroupCallKeyResponse(keyRecord, userId);

        return data
            ? res.json({ success: true, data })
            : res.status(409).json({
                  success: false,
                  message: "A group call key is not available for this member."
              });
    } catch (error) {
        console.error("CREATE GROUP CALL KEY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to establish the group call encryption key."
        });
    }
};

exports.markGroupMessagesSeen = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { groupId } = req.params;

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        const isMember = await GroupConversation.exists({
            _id: groupId,
            participants: userId
        });

        if (!isMember) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const result = await Message.updateMany(
            {
                groupId,
                sender: { $ne: userId },
                readBy: { $ne: userId }
            },
            { $addToSet: { readBy: userId } }
        );

        return res.json({
            success: true,
            modifiedCount: result.modifiedCount || 0
        });
    } catch (error) {
        console.error("MARK GROUP MESSAGES SEEN ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to mark group messages as seen."
        });
    }
};

exports.addGroupMembers = async (req, res) => {
    try {
        const actorId = getUserId(req);
        const { groupId } = req.params;
        const memberIds = Array.isArray(req.body?.memberIds)
            ? req.body.memberIds
            : [];

        if (!isValidObjectId(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID."
            });
        }

        if (!memberIds.length || memberIds.length > 99 ||
            memberIds.some(id => !isValidObjectId(id))) {
            return res.status(400).json({
                success: false,
                message: "Choose between 1 and 99 valid members."
            });
        }

        const group = await findMemberGroup(groupId, actorId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        if (!group.admins.some(id => String(id) === String(actorId))) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can add members."
            });
        }

        const uniqueIds = [...new Set(memberIds.map(String))];
        const existing = new Set(group.participants.map(String));
        const newIds = uniqueIds.filter(id => !existing.has(id));

        if (group.participants.length + newIds.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Groups can have up to 100 members."
            });
        }

        const validUsers = await User.countDocuments({
            _id: { $in: newIds }
        });

        if (validUsers !== newIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more selected users could not be found."
            });
        }

        if (group.isEncrypted && newIds.length) {
            const newUsers = await User.find({
                _id: { $in: newIds }
            })
                .select("+messengerEncryptionPublicKey")
                .lean();
            const readyUserIds = new Set(
                newUsers.filter(hasRegisteredEncryptionKey).map(user =>
                    String(user._id)
                )
            );
            const missingKeys = newIds.filter(
                memberId => !readyUserIds.has(memberId)
            );

            if (missingKeys.length) {
                return res.status(409).json({
                    success: false,
                    message: "New members must open Messenger and set up encryption before joining this encrypted group.",
                    membersWithoutKeys: missingKeys
                });
            }
        }

        group.participants.push(...newIds);
        await group.save();

        if (newIds.length) {
            await GroupCallKey.deleteOne({ groupId: group._id });
            void endGroupCallRoom(group._id);
        }

        notifyMembers(req, group._id, group.participants);

        return res.json({
            success: true,
            data: await groupPopulation(
                GroupConversation.findById(group._id)
            )
        });
    } catch (error) {
        console.error("ADD GROUP MEMBERS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to add group members."
        });
    }
};

exports.removeGroupMember = async (req, res) => {
    try {
        const actorId = getUserId(req);
        const { groupId, userId } = req.params;

        if (!isValidObjectId(groupId) || !isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group or user ID."
            });
        }

        const group = await findMemberGroup(groupId, actorId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const isAdmin = group.admins.some(id => String(id) === String(actorId));
        const isSelf = String(actorId) === String(userId);
        const previousMemberIds = group.participants.map(String);

        if (!isSelf && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can remove members."
            });
        }

        if (!group.participants.some(id => String(id) === String(userId))) {
            return res.status(404).json({
                success: false,
                message: "That user is not a group member."
            });
        }

        group.participants = group.participants.filter(
            id => String(id) !== String(userId)
        );
        group.admins = group.admins.filter(
            id => String(id) !== String(userId)
        );

        if (String(group.createdBy) === String(userId) &&
            group.participants.length > 0) {
            group.createdBy = group.participants[0];
            if (!group.admins.length) {
                group.admins.push(group.participants[0]);
            }
        }

        if (!group.participants.length) {
            await Promise.all([
                GroupConversation.deleteOne({ _id: groupId }),
                GroupCallKey.deleteOne({ groupId }),
                Message.deleteMany({ groupId })
            ]);

            void endGroupCallRoom(groupId);
            previousMemberIds.forEach(memberId => {
                void disconnectGroupCallParticipant(groupId, memberId);
            });
            previousMemberIds.forEach(memberId =>
                removeMemberFromRoom(req, groupId, memberId)
            );
            notifyMembers(req, groupId, previousMemberIds);

            return res.json({
                success: true,
                deleted: true
            });
        }

        await group.save();

        await GroupCallKey.deleteOne({ groupId: group._id });
        void endGroupCallRoom(group._id);
        void disconnectGroupCallParticipant(groupId, userId);
        removeMemberFromRoom(req, groupId, userId);
        notifyMembers(req, groupId, previousMemberIds);

        return res.json({
            success: true,
            data: await groupPopulation(
                GroupConversation.findById(group._id)
            )
        });
    } catch (error) {
        console.error("REMOVE GROUP MEMBER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to remove group member."
        });
    }
};
