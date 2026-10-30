const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const messageUpload = require("../middleware/messageUpload");
const {
    listGroups,
    createGroup,
    updateGroupDetails,
    getGroupPhoto,
    setGroupEncryption,
    getGroupMessages,
    createGroupCallLog,
    createGroupCallToken,
    getGroupCallKey,
    createGroupCallKey,
    markGroupMessagesSeen,
    addGroupMembers,
    removeGroupMember
} = require("../controllers/groupController");

const router = express.Router();
const groupPhotoMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif"
]);
const groupPhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, callback) {
        const mimeType = String(file.mimetype || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
        if (!groupPhotoMimeTypes.has(mimeType)) {
            return callback(new Error("Choose a supported image for the group photo."));
        }
        return callback(null, true);
    }
});
const handleGroupPhotoUpload = (req, res, next) => {
    groupPhotoUpload.single("file")(req, res, error => {
        if (error instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: error.code === "LIMIT_FILE_SIZE"
                    ? "Group photos must be 5 MB or smaller."
                    : `Upload error: ${error.message}`
            });
        }
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message || "Choose a supported group photo."
            });
        }
        return messageUpload.validateContent(req, res, next);
    });
};

router.use(auth());
router.get("/", listGroups);
router.post("/", createGroup);
router.get("/:groupId/photo", getGroupPhoto);
router.put("/:groupId/details", handleGroupPhotoUpload, updateGroupDetails);
router.put("/:groupId/encryption", setGroupEncryption);
router.post("/:groupId/call-log", createGroupCallLog);
router.post("/:groupId/call-token", createGroupCallToken);
router.get("/:groupId/call-key", getGroupCallKey);
router.post("/:groupId/call-key", createGroupCallKey);
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
