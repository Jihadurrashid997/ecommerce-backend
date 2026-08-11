const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {
    initPayment,
    paymentSuccess,
    paymentFail,
    paymentCancel,
    paymentIPN
} = require("../controllers/paymentController");


// Start SSLCommerz Payment
router.post(
    "/sslcommerz",
    auth(),
    initPayment
);


// SSLCommerz Success Callback
router.post(
    "/success",
    paymentSuccess
);


// SSLCommerz Failed Callback
router.post(
    "/fail",
    paymentFail
);


// SSLCommerz Cancel Callback
router.post(
    "/cancel",
    paymentCancel
);


// SSLCommerz IPN
router.post(
    "/ipn",
    paymentIPN
);


module.exports = router;
