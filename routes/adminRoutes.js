const express =
    require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");
const { requirePermission } = require("../middleware/adminPermissions");

const {

    getAnalytics,
    getMarketplaceSettings,
    updateMarketplaceSettings,
    approveProduct,
    rejectProduct,
    getPendingProducts,
    getSellerApplications,
    reviewSellerApplication,
    getAllRegisteredUsers,
    getDashboardSummary

} =
    require("../controllers/adminController");


// ======================================================
// Marketplace status is public; all administrative changes remain protected.
// ======================================================


// ANALYTICS

router.get(
    "/analytics",
    auth(["admin"]),
    requirePermission("overview"),
    getAnalytics
);


// DASHBOARD SUMMARY

router.get(
    "/summary",
    auth(["admin"]),
    requirePermission("overview"),
    getDashboardSummary
);


// USERS

router.get(
    "/users",
    auth(["admin"]),
    requirePermission("users_read"),
    getAllRegisteredUsers
);


// MARKETPLACE SETTINGS

router.get(
    "/settings",
    getMarketplaceSettings
);

router.put(
    "/settings",
    auth(["admin"]),
    requirePermission("settings_write"),
    updateMarketplaceSettings
);

router.patch(
    "/platform/maintenance",
    auth(["admin"]),
    requirePermission("settings_write"),
    require("../controllers/platformController").updateMaintenance
);

router.post(
    "/android-release/upload-signature",
    auth(["admin"]),
    requirePermission("settings_write"),
    require("../controllers/platformController").getAndroidReleaseUploadSignature
);

router.post(
    "/android-release",
    auth(["admin"]),
    requirePermission("settings_write"),
    require("../controllers/platformController").publishAndroidRelease
);


// PRODUCT APPROVAL

router.put(
    "/approve/:productId",
    auth(["admin"]),
    requirePermission("settings_write"),
    approveProduct
);

router.put(
    "/reject/:productId",
    auth(["admin"]),
    requirePermission("settings_write"),
    rejectProduct
);

router.get(
    "/products/pending",
    auth(["admin"]),
    requirePermission("settings_write"),
    getPendingProducts
);

router.get(
    "/seller-applications",
    auth(["admin"]),
    requirePermission("settings_write"),
    getSellerApplications
);

router.put(
    "/seller-applications/:userId",
    auth(["admin"]),
    requirePermission("settings_write"),
    reviewSellerApplication
);


// ======================================================
// ADMIN CONTROL (users, moderation, content)
// ======================================================

const control =
    require("../controllers/adminControlController");
const moderation = require("../controllers/adminModerationController");

router.get("/control/overview", auth(["admin"]), requirePermission("overview"), control.getOverview);
router.get("/control/users", auth(["admin"]), requirePermission("users_read"), control.listUsers);
router.get("/control/users/:id", auth(["admin"]), requirePermission("users_read"), control.getUserDetail);
router.patch("/control/users/:id/suspend", auth(["admin"]), requirePermission("user_moderate"), control.setSuspended);
router.patch("/control/users/:id/status", auth(["admin"]), requirePermission("user_moderate"), control.setAccountStatus);
router.patch("/control/users/:id/role", auth(["admin"]), requirePermission("user_moderate"), control.setRole);
router.patch("/control/users/:id/admin-role", auth(["admin"]), requirePermission("user_moderate"), control.setAdminRole);
router.patch("/control/users/:id/verification", auth(["admin"]), requirePermission("user_moderate"), control.setVerification);
router.post("/control/users/:id/reset-password", auth(["admin"]), requirePermission("user_support"), control.resetPassword);
router.post("/control/users/:id/force-logout", auth(["admin"]), requirePermission("user_moderate"), moderation.forceLogout);
router.delete("/control/users/:id", auth(["admin"]), requirePermission("user_moderate"), control.deleteUser);
router.get("/control/content", auth(["admin"]), requirePermission("content_read"), control.listContent);
router.patch("/control/content/:id/moderation", auth(["admin"]), requirePermission("content_moderate"), moderation.moderateContent);
router.get("/control/reports", auth(["admin"]), requirePermission("reports_read"), moderation.listReports);
router.get("/control/repeated-reports", auth(["admin"]), requirePermission("reports_read"), moderation.listRepeatedlyReportedUsers);
router.patch("/control/reports/:id", auth(["admin"]), requirePermission("reports_moderate"), moderation.reviewReport);
router.patch("/control/message-reports/:id", auth(["admin"]), requirePermission("reports_moderate"), moderation.reviewLegacyMessageReport);
router.get("/control/communities", auth(["admin"]), requirePermission("communities_read"), moderation.listCommunities);
router.patch("/control/communities/:id", auth(["admin"]), requirePermission("communities_moderate"), moderation.moderateCommunity);
router.get("/control/audit-logs", auth(["admin"]), requirePermission("audit_read"), moderation.listAuditLogs);
router.get("/control/platform-settings", auth(["admin"]), requirePermission("settings_write"), moderation.getPlatformControls);
router.put("/control/platform-settings", auth(["admin"]), requirePermission("settings_write"), moderation.updatePlatformControls);
router.post(
    "/control/announcements",
    auth(["admin"]),
    requirePermission("announcements_write"),
    require("../controllers/adminAnnouncementController").sendAnnouncement
);


module.exports =
    router;
