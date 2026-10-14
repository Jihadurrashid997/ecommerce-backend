const mongoose = require("mongoose");
const GroupConversation = require("../models/GroupConversation");
const Message = require("../models/Message");
const User = require("../models/User");

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

        const messages = await Message.find({ groupId })
            .sort({ createdAt: -1 })
            .limit(1000)
            .populate(
                "sender",
                "name username fullName displayName profileImage avatar isVerified"
            )
            .populate({
                path: "replyTo",
                select: "message fileUrl fileName fileType sender createdAt",
                populate: {
                    path: "sender",
                    select: "name username fullName displayName"
                }
            })
            .populate("reactions.user", "name username fullName displayName");

        messages.reverse();

        await Message.updateMany(
            { groupId, sender: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        return res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error("GET GROUP MESSAGES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load group messages."
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

        group.participants.push(...newIds);
        await group.save();

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
                Message.deleteMany({ groupId })
            ]);

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
