const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { addToCart, getCart, placeOrder } = require('../controllers/orderController'); // 👈 এখানে placeOrder ইমপোর্ট যোগ করা হয়েছে

// ==========================================
// ১. কার্ট রাউটস
// ==========================================
router.post('/cart/add', auth(), addToCart);
router.get('/cart', auth(), getCart);

// ==========================================
// ২. অর্ডার রাউটস 🚀
// ==========================================
router.post('/checkout', auth(), placeOrder); // 👈 আপনার মিডলওয়্যার 'auth()' দিয়ে নতুন রাউট যোগ করা হলো

module.exports = router;