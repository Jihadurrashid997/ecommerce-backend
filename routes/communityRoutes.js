const express = require("express");
const auth = require("../middleware/auth");
const {
    createCommunity,
    getMyCommunities,
    discoverCommunities,
    getCommunity,
    joinCommunity,
    leaveCommunity,
    getCommunityMembers,
    getJoinRequests,
    approveJoinRequest,
    removeMember,
    promoteAdmin,
    demoteAdmin,
    declineJoinRequest
} = require("../controllers/communityController");

const router = express.Router();

router.get("/mine", auth(), getMyCommunities);
router.get("/discover", auth(), discoverCommunities);
router.post("/", auth(), createCommunity);
router.get("/:id/join-requests", auth(), getJoinRequests);
router.post("/:id/join-requests/:userId/approve", auth(), approveJoinRequest);
router.delete("/:id/join-requests/:userId", auth(), declineJoinRequest);
router.get("/:id/members", auth(), getCommunityMembers);
router.delete("/:id/members/:userId", auth(), removeMember);
router.post("/:id/admins/:userId", auth(), promoteAdmin);
router.delete("/:id/admins/:userId", auth(), demoteAdmin);
router.post("/:id/join", auth(), joinCommunity);
router.post("/:id/leave", auth(), leaveCommunity);
router.get("/:id", auth(), getCommunity);

module.exports = router;
