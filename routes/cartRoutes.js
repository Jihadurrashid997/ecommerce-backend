const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { addToCart, getCart } = require('../controllers/cartController');

// কার্টের সব অপারেশনে লগইন করা মাস্ট, তাই শুধু auth() দিলেই হবে (কোনো নির্দিষ্ট রোল লাগবে না)
router.post('/add', auth(), addToCart);
router.get('/', auth(), getCart);

module.exports = router;