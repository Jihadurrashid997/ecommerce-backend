const express = require("express");

const router = express.Router();

const {
    createOrder,
    getMyOrders,
    getOrder,
    cancelOrder,
    getSellerOrders,
    updateSellerOrderStatus,
    confirmSellerPayout,
    confirmOrderReceipt,
    getReadySellerPayouts,
    markSellerPayoutPaid,
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

router.put(
    "/:id/confirm-received/:fulfillmentId",
    auth(),
    confirmOrderReceipt
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

router.put(
    "/seller/:id/confirm-payout/:fulfillmentId",
    auth(["seller"]),
    confirmSellerPayout
);

router.get(
    "/admin/payouts/ready",
    auth(["admin"]),
    getReadySellerPayouts
);

router.put(
    "/admin/:id/payout",
    auth(["admin"]),
    markSellerPayoutPaid
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
