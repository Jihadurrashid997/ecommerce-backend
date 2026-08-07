const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {
    initPayment
} = require("../controllers/paymentController");

router.post(
    "/sslcommerz",
    auth(),
    initPayment
);

module.exports = router;
