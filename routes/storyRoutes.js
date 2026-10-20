const express = require("express");
const auth = require("../middleware/auth");
const { storyUpload, handleSingle } = require("../middleware/postUpload");
const {
    createStory,
    getStories,
    markStoryViewed,
    getStoryViewers,
    deleteStory
} = require("../controllers/storyController");

const router = express.Router();

router.get("/", auth(), getStories);
router.post("/", auth(), handleSingle(storyUpload, "media"), createStory);
router.get("/:id/viewers", auth(), getStoryViewers);
router.post("/:id/view", auth(), markStoryViewed);
router.delete("/:id", auth(), deleteStory);

module.exports = router;
