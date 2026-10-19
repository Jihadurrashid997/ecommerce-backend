const express = require("express");
const auth = require("../middleware/auth");
const {
    listGroups,
    createGroup,
    setGroupEncryption,
    getGroupMessages,
    createGroupCallToken,
    markGroupMessagesSeen,
    addGroupMembers,
    removeGroupMember
} = require("../controllers/groupController");

const router = express.Router();

router.use(auth());
router.get("/", listGroups);
router.post("/", createGroup);
router.put("/:groupId/encryption", setGroupEncryption);
router.post("/:groupId/call-token", createGroupCallToken);
router.get("/:groupId/messages", getGroupMessages);
router.put("/:groupId/seen", markGroupMessagesSeen);
router.post("/:groupId/members", addGroupMembers);
router.delete("/:groupId/members/:userId", removeGroupMember);
router.delete("/:groupId/leave", (req, res, next) => {
    req.params.userId = String(
        req.user?._id ||
        req.user?.id ||
        req.user?.userId ||
        ""
    );
    return removeGroupMember(req, res, next);
});

module.exports = router;
