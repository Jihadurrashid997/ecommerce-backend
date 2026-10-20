const express = require("express");
const auth = require("../middleware/auth");
const controller = require("../controllers/platformNotificationController");

const router = express.Router();

router.use(auth());
router.get("/", controller.getPlatformNotifications);
router.get("/unread-count", controller.getUnreadCount);
router.patch("/read-all", controller.markAllRead);
router.delete("/", controller.clearNotifications);
router.patch("/:id/read", controller.markRead);

module.exports = router;
