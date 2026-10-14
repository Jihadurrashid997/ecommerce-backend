const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {
    getPaymentStatus,
    initPayment,
    paymentSuccess,
    paymentFail,
    paymentCancel,
    paymentIPN
} = require("../controllers/paymentController");

router.get(
    "/status/:transactionId",
    auth(),
    getPaymentStatus
);

// Start payment
router.post(
    "/sslcommerz",
    auth(),
    initPayment
);


// Customer redirect callbacks
router.post(
    "/success",
    paymentSuccess
);

router.post(
    "/fail",
    paymentFail
);

router.post(
    "/cancel",
    paymentCancel
);


// Server-to-server IPN
router.post(
    "/ipn",
    paymentIPN
);


module.exports = router;
