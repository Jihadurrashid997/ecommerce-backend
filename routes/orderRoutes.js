const express = require("express");

const router = express.Router();

const {
    createOrder,
    getMyOrders,
    getOrder,
    cancelOrder,
    getSellerOrders,
    updateSellerOrderStatus,
    getAllOrders,
    updateOrderStatus
} = require("../controllers/orderController");

const auth = require("../middleware/auth");


// ========================================
// CUSTOMER
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
// SELLER
// ========================================

router.get(
    "/seller/orders",
    auth(["seller"]),
    getSellerOrders
);

router.put(
    "/seller/:id/status",
    auth(["seller"]),
    updateSellerOrderStatus
);


// ========================================
// ADMIN
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
