const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { updateMarketplaceSettings, approveProduct } = require('../controllers/adminController');

router.put('/settings', auth(['admin']), updateMarketplaceSettings);
router.put('/approve/:productId', auth(['admin']), approveProduct);

module.exports = router;