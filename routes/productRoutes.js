const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// সব অনুমোদিত (Approved) প্রোডাক্ট পাওয়ার জন্য রুট
router.get('/', async (req, res) => {
    try {
        const products = await Product.find({ isApproved: true });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// নতুন প্রোডাক্ট যোগ করার রুট (সেলারের জন্য)
router.post('/add', async (req, res) => {
    try {
        // রিকোয়েস্ট বডি থেকে ডেটা আসছে কি না চেক করা
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ message: "Product data is required!" });
        }

        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// যদি কেউ সরাসরি /api/products এ পোস্ট রিকোয়েস্ট পাঠায় (যদি /add ব্যবহার না করে)
router.post('/', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
