const express = require("express");
const auth = require("../middleware/auth");
const {
    storyUpload,
    homeStoryAudioUpload,
    handleSingle,
    handleFields
} = require("../middleware/postUpload");
const {
    validateHomeImageContent,
    validateUploadedAudioContent
} = require("../middleware/imageContentValidation");
const {
    createStory,
    getStories,
    markStoryViewed,
    getStoryViewers,
    deleteStory,
    voteStoryPoll
} = require("../controllers/storyController");

const router = express.Router();

router.get("/", auth(), getStories);
router.post(
    "/home",
    auth(),
    handleFields(homeStoryAudioUpload),
    validateHomeImageContent,
    validateUploadedAudioContent,
    createStory
);
router.post("/", auth(), handleSingle(storyUpload, "media"), createStory);
router.get("/:id/viewers", auth(), getStoryViewers);
router.post("/:id/view", auth(), markStoryViewed);
router.post("/:id/poll", auth(), voteStoryPoll);
router.delete("/:id", auth(), deleteStory);

module.exports = router;
