const mongoose = require("mongoose");
const Community = require("../models/Community");

const USER_FIELDS = "name username profileImage avatar isVerified";
const isId = value => mongoose.Types.ObjectId.isValid(value);
const sameId = (first, second) => String(first?._id || first) === String(second?._id || second);

const isMember = (community, userId) =>
    (community.members || []).some(member => sameId(member, userId));

const isAdmin = (community, userId) =>
    (community.admins || []).some(admin => sameId(admin, userId));

const shapeCommunity = (community, userId) => {
    const member = isMember(community, userId);
    const requested = (community.pendingRequests || [])
        .some(request => sameId(request, userId));

    return {
        _id: community._id,
        name: community.name,
        description: community.description,
        privacy: community.privacy,
        createdBy: community.createdBy,
        admins: community.admins || [],
        membersCount: (community.members || []).length,
        isMember: member,
        isAdmin: isAdmin(community, userId),
        membershipStatus: member ? "member" : requested ? "requested" : "none",
        createdAt: community.createdAt,
        ...(isAdmin(community, userId)
            ? { pendingRequests: community.pendingRequests || [] }
            : {})
    };
};

const loadForUser = query =>
    query
        .populate("createdBy", USER_FIELDS)
        .populate("admins", USER_FIELDS)
        .populate("pendingRequests", USER_FIELDS)
        .lean();

const respondError = (res, error, message) => {
    console.error(message, error);
    return res.status(500).json({
        success: false,
        message
    });
};

exports.createCommunity = async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        const description = String(req.body?.description || "").trim();
        const privacy = req.body?.privacy || "public";

        if (name.length < 2 || name.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Community names must be between 2 and 60 characters."
            });
        }

        if (description.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Community descriptions can be up to 500 characters."
            });
        }

        if (!["public", "private"].includes(privacy)) {
            return res.status(400).json({
                success: false,
                message: "Choose a public or private community."
            });
        }

        const community = await Community.create({
            name,
            description,
            privacy,
            createdBy: req.user.id,
            admins: [req.user.id],
            members: [req.user.id]
        });

        const populated = await loadForUser(
            Community.findById(community._id)
        );

        return res.status(201).json({
            success: true,
            data: shapeCommunity(populated, req.user.id)
        });
    } catch (error) {
        return respondError(res, error, "Could not create the community.");
    }
};

exports.getMyCommunities = async (req, res) => {
    try {
        const communities = await loadForUser(
            Community.find({ members: req.user.id })
                .sort({ updatedAt: -1 })
                .limit(50)
        );

        return res.json({
            success: true,
            data: communities.map(item => shapeCommunity(item, req.user.id))
        });
    } catch (error) {
        return respondError(res, error, "Could not load your communities.");
    }
};

exports.discoverCommunities = async (req, res) => {
    try {
        const communities = await loadForUser(
            Community.find({ members: { $ne: req.user.id } })
                .sort({ createdAt: -1 })
                .limit(50)
        );

        return res.json({
            success: true,
            data: communities.map(item => shapeCommunity(item, req.user.id))
        });
    } catch (error) {
        return respondError(res, error, "Could not discover communities.");
    }
};

exports.getCommunity = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid community."
            });
        }

        const community = await loadForUser(
            Community.findById(req.params.id)
        );

        if (!community) {
            return res.status(404).json({
                success: false,
                message: "Community not found."
            });
        }

        return res.json({
            success: true,
            data: shapeCommunity(community, req.user.id)
        });
    } catch (error) {
        return respondError(res, error, "Could not load the community.");
    }
};

exports.joinCommunity = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid community." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (isMember(community, req.user.id)) {
            return res.json({
                success: true,
                membershipStatus: "member",
                message: "You are already a member."
            });
        }

        if (community.privacy === "private") {
            if (!community.pendingRequests.some(id => sameId(id, req.user.id))) {
                community.pendingRequests.push(req.user.id);
                await community.save();
            }

            return res.json({
                success: true,
                membershipStatus: "requested",
                message: "Your request was sent to the community admins."
            });
        }

        community.members.addToSet(req.user.id);
        await community.save();

        return res.json({
            success: true,
            membershipStatus: "member",
            message: "You joined the community."
        });
    } catch (error) {
        return respondError(res, error, "Could not join the community.");
    }
};

exports.leaveCommunity = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid community." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!isMember(community, req.user.id)) {
            community.pendingRequests.pull(req.user.id);
            await community.save();
            return res.json({ success: true, membershipStatus: "none" });
        }

        if (sameId(community.createdBy, req.user.id)) {
            return res.status(400).json({
                success: false,
                message: "The community creator cannot leave this community."
            });
        }

        if (
            isAdmin(community, req.user.id) &&
            community.admins.filter(admin => !sameId(admin, req.user.id)).length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Promote another admin before leaving this community."
            });
        }

        community.members.pull(req.user.id);
        community.admins.pull(req.user.id);
        community.pendingRequests.pull(req.user.id);
        await community.save();

        return res.json({ success: true, membershipStatus: "none" });
    } catch (error) {
        return respondError(res, error, "Could not leave the community.");
    }
};

exports.getJoinRequests = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid community." });
        }

        const community = await loadForUser(
            Community.findById(req.params.id)
        );

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!isAdmin(community, req.user.id)) {
            return res.status(403).json({ success: false, message: "Admin access is required." });
        }

        return res.json({
            success: true,
            data: community.pendingRequests || []
        });
    } catch (error) {
        return respondError(res, error, "Could not load membership requests.");
    }
};

exports.getCommunityMembers = async (req, res) => {
    try {
        if (!isId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid community." });
        }

        const community = await Community.findById(req.params.id)
            .select("privacy members admins createdBy")
            .populate("members", USER_FIELDS)
            .lean();

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (
            community.privacy === "private" &&
            !(community.members || []).some(member => sameId(member, req.user.id))
        ) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        return res.json({
            success: true,
            data: (community.members || []).slice(0, 100).map(member => ({
                ...member,
                isAdmin: (community.admins || []).some(admin => sameId(admin, member)),
                isCreator: sameId(community.createdBy, member)
            }))
        });
    } catch (error) {
        return respondError(res, error, "Could not load community members.");
    }
};

exports.promoteAdmin = async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Invalid community or user." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!sameId(community.createdBy, req.user.id)) {
            return res.status(403).json({ success: false, message: "Only the community creator can manage admins." });
        }

        if (!isMember(community, req.params.userId)) {
            return res.status(400).json({ success: false, message: "Only community members can become admins." });
        }

        community.admins.addToSet(req.params.userId);
        await community.save();

        return res.json({ success: true });
    } catch (error) {
        return respondError(res, error, "Could not promote the community admin.");
    }
};

exports.demoteAdmin = async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Invalid community or user." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!sameId(community.createdBy, req.user.id)) {
            return res.status(403).json({ success: false, message: "Only the community creator can manage admins." });
        }

        if (sameId(community.createdBy, req.params.userId)) {
            return res.status(400).json({ success: false, message: "The creator cannot be removed as an admin." });
        }

        community.admins.pull(req.params.userId);
        await community.save();

        return res.json({ success: true });
    } catch (error) {
        return respondError(res, error, "Could not remove the community admin.");
    }
};

exports.approveJoinRequest = async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Invalid community or user." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!isAdmin(community, req.user.id)) {
            return res.status(403).json({ success: false, message: "Admin access is required." });
        }

        const requested = community.pendingRequests.some(
            id => sameId(id, req.params.userId)
        );

        if (!requested) {
            return res.status(404).json({ success: false, message: "Join request not found." });
        }

        community.pendingRequests.pull(req.params.userId);
        community.members.addToSet(req.params.userId);
        await community.save();

        return res.json({ success: true, membershipStatus: "member" });
    } catch (error) {
        return respondError(res, error, "Could not approve the join request.");
    }
};

exports.removeMember = async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Invalid community or user." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!isAdmin(community, req.user.id)) {
            return res.status(403).json({ success: false, message: "Admin access is required." });
        }

        if (sameId(community.createdBy, req.params.userId)) {
            return res.status(400).json({ success: false, message: "The community creator cannot be removed." });
        }

        if (
            isAdmin(community, req.params.userId) &&
            !sameId(community.createdBy, req.user.id)
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the community creator can remove another admin."
            });
        }

        if (
            isAdmin(community, req.params.userId) &&
            community.admins.filter(admin => !sameId(admin, req.params.userId)).length === 0
        ) {
            return res.status(400).json({ success: false, message: "Promote another admin first." });
        }

        community.members.pull(req.params.userId);
        community.admins.pull(req.params.userId);
        community.pendingRequests.pull(req.params.userId);
        await community.save();

        return res.json({ success: true });
    } catch (error) {
        return respondError(res, error, "Could not remove the community member.");
    }
};

exports.declineJoinRequest = async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Invalid community or user." });
        }

        const community = await Community.findById(req.params.id);

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found." });
        }

        if (!isAdmin(community, req.user.id)) {
            return res.status(403).json({ success: false, message: "Admin access is required." });
        }

        community.pendingRequests.pull(req.params.userId);
        await community.save();

        return res.json({ success: true });
    } catch (error) {
        return respondError(res, error, "Could not decline the join request.");
    }
};
