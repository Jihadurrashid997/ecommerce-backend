const express =
    require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const {

    getAnalytics,
    getMarketplaceSettings,
    updateMarketplaceSettings,
    approveProduct,
    getPendingProducts,
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
    getAnalytics
);


// DASHBOARD SUMMARY

router.get(
    "/summary",
    auth(["admin"]),
    getDashboardSummary
);


// USERS

router.get(
    "/users",
    auth(["admin"]),
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
    updateMarketplaceSettings
);


// PRODUCT APPROVAL

router.put(
    "/approve/:productId",
    auth(["admin"]),
    approveProduct
);

router.get(
    "/products/pending",
    auth(["admin"]),
    getPendingProducts
);


// ======================================================
// ADMIN CONTROL (users, moderation, content)
// ======================================================

const control =
    require("../controllers/adminControlController");

router.get("/control/overview", auth(["admin"]), control.getOverview);
router.get("/control/users", auth(["admin"]), control.listUsers);
router.get("/control/users/:id", auth(["admin"]), control.getUserDetail);
router.patch("/control/users/:id/suspend", auth(["admin"]), control.setSuspended);
router.patch("/control/users/:id/role", auth(["admin"]), control.setRole);
router.patch("/control/users/:id/verification", auth(["admin"]), control.setVerification);
router.post("/control/users/:id/reset-password", auth(["admin"]), control.resetPassword);
router.delete("/control/users/:id", auth(["admin"]), control.deleteUser);
router.get("/control/content", auth(["admin"]), control.listContent);


module.exports =
    router;
