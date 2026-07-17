const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// সব অনুমোদিত (Approved) প্রোডাক্ট পাওয়ার জন্য রুট
router.get('/', async (req, res) => {
    try {
        // আমরা শুধু সেই প্রোডাক্টগুলোই দেখাবো যেগুলো অ্যাডমিন অ্যাপ্রুভ করেছে
        const products = await Product.find({ isApproved: true });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// নতুন প্রোডাক্ট যোগ করার রুট (সেলারের জন্য)
router.post('/add', async (req, res) => {
    const newProduct = new Product(req.body);
    try {
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;