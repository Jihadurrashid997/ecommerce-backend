const express = require("express");
const auth = require("../middleware/auth");
const {
    getShopNotifications,
    getShopNotificationUnreadCount,
    getShopNotificationPreferences,
    updateShopNotificationPreferences,
    markShopNotificationRead,
    markAllShopNotificationsRead
} = require("../controllers/shopNotificationController");

const router = express.Router();

router.get("/", auth(), getShopNotifications);
router.get("/unread-count", auth(), getShopNotificationUnreadCount);
router.get("/preferences", auth(), getShopNotificationPreferences);
router.patch("/preferences", auth(), updateShopNotificationPreferences);
router.patch("/read-all", auth(), markAllShopNotificationsRead);
router.patch("/:id/read", auth(), markShopNotificationRead);

module.exports = router;
