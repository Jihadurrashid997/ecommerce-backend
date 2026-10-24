const express = require("express");
const auth = require("../middleware/auth");
const { storyUpload, homeStoryUpload, handleSingle } = require("../middleware/postUpload");
const { validateHomeImageContent } = require("../middleware/imageContentValidation");
const {
    createStory,
    getStories,
    markStoryViewed,
    getStoryViewers,
    deleteStory
} = require("../controllers/storyController");

const router = express.Router();

router.get("/", auth(), getStories);
router.post("/home", auth(), handleSingle(homeStoryUpload, "media"), validateHomeImageContent, createStory);
router.post("/", auth(), handleSingle(storyUpload, "media"), createStory);
router.get("/:id/viewers", auth(), getStoryViewers);
router.post("/:id/view", auth(), markStoryViewed);
router.delete("/:id", auth(), deleteStory);

module.exports = router;
