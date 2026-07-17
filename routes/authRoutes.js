const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const auth = require('../middleware/auth'); // 🛡️ মিডলওয়্যারটি ইম্পোর্ট করলাম

// পাবলিক রাউটস (টোকেন লাগবে না)
router.post('/register', register);
router.post('/login', login);

// প্রোটেক্টেড রাউট (এই রাউট অ্যাক্সেস করতে অবশ্যই টোকেন লাগবে)
router.get('/profile', auth(), (req, res) => {
    // মিডলওয়্যার টোকেন ভেরিফাই করে req.user এর ভেতর ডেটা দিয়ে দেয়
    res.status(200).json({
        message: "Welcome to your profile!",
        user: req.user // এখানে আপনার ডিকোড হওয়া টোকেনের ভেতরের ডেটা (id, role) দেখাবে
    });
});

module.exports = router;