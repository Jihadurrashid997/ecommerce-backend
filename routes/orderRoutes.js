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
    approveSellerPayout,
    markSellerPayoutPaid,
    openDeliveryDispute,
    respondToDeliveryDispute,
    getOpenDeliveryDisputes,
    resolveDeliveryDispute,
    requestOrderRefund,
    getRequestedOrderRefunds,
    rejectOrderRefund,
    recordOrderRefund,
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

router.post(
    "/:id/refund-request",
    auth(),
    requestOrderRefund
);

router.post(
    "/:id/shipments/:fulfillmentId/dispute",
    auth(),
    openDeliveryDispute
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

router.put(
    "/seller/:id/shipments/:fulfillmentId/dispute-response",
    auth(["seller"]),
    respondToDeliveryDispute
);

router.get(
    "/admin/payouts/ready",
    auth(["admin"]),
    getReadySellerPayouts
);

router.get(
    "/admin/disputes/open",
    auth(["admin"]),
    getOpenDeliveryDisputes
);

router.put(
    "/admin/:id/disputes/resolve",
    auth(["admin"]),
    resolveDeliveryDispute
);

router.get(
    "/admin/refunds/requested",
    auth(["admin"]),
    getRequestedOrderRefunds
);

router.put(
    "/admin/:id/payout/approve",
    auth(["admin"]),
    approveSellerPayout
);

router.put(
    "/admin/:id/payout",
    auth(["admin"]),
    markSellerPayoutPaid
);

router.put(
    "/admin/:id/refund/reject",
    auth(["admin"]),
    rejectOrderRefund
);

router.put(
    "/admin/:id/refund/complete",
    auth(["admin"]),
    recordOrderRefund
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
