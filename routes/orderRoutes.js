const express = require("express");

const router = express.Router();

const {
    createOrder,
    getMyOrders,
    getOrder,
    cancelOrder,
    getAllOrders,
    updateOrderStatus
} = require("../controllers/orderController");

const auth = require("../middleware/auth");

// ========================================
// CUSTOMER ROUTES
// ========================================

router.post(
    "/",
    auth(),
    createOrder
);

router.get(
    "/",
    auth(),
    getMyOrders
);

router.get(
    "/:id",
    auth(),
    getOrder
);

router.put(
    "/:id/cancel",
    auth(),
    cancelOrder
);


// ========================================
// ADMIN ROUTES
// ========================================

router.get(
    "/admin/all",
    auth(["admin"]),
    getAllOrders
);

router.put(
    "/admin/:id/status",
    auth(["admin"]),
    updateOrderStatus
);

module.exports = router;
