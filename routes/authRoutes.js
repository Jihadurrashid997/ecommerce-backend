const express =
    require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const {

    getAnalytics,
    updateMarketplaceSettings,
    approveProduct,
    getAllRegisteredUsers,
    getDashboardSummary

} =
    require("../controllers/adminController");


// ======================================================
// ALL ADMIN ROUTES ARE PROTECTED
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


module.exports =
    router;
