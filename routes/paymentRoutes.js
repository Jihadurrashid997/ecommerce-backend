const express = require('express');
const router = express.Router();
const { 
    initiatePayment, 
    dummyCheckoutPage, 
    paymentSuccess, 
    paymentFail, 
    paymentCancel, 
    paymentIPN 
} = require('../controllers/paymentController');
const auth = require('../middleware/auth'); 

// ১. পেমেন্ট ইনিশিয়েট রাউট (টোকেন লাগবে)
router.post('/initiate', auth(), initiatePayment);

// ২. ডামি গেটওয়ে পেজ দেখার রাউট
router.get('/dummy-checkout/:tranId', dummyCheckoutPage);

// ৩. পেমেন্ট রেসপন্স হ্যান্ডলারস (SSLCommerz বা ডামি ফর্ম থেকে POST আসবে)
router.post('/success/:tranId', paymentSuccess);
router.post('/fail/:tranId', paymentFail);
router.post('/cancel/:tranId', paymentCancel);

// ৪. IPN রাউট
router.post('/ipn', paymentIPN);

module.exports = router;