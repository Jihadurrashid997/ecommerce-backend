const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
    updateMarketplaceSettings, 
    approveProduct, 
    getAllRegisteredUsers 
} = require('../controllers/adminController');

// Marketplace settings update (Admin only)
router.put('/settings', auth(['admin']), updateMarketplaceSettings);

// Product approval (Admin only)
router.put('/approve/:productId', auth(['admin']), approveProduct);

// View all registered accounts/users (Admin only)
router.get('/users', auth(['admin']), getAllRegisteredUsers);

module.exports = router;
