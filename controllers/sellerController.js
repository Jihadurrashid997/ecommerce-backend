const Product = require('../models/Product');
const User = require('../models/User');
exports.uploadProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock } = req.body;

        // মাল্টার থেকে আসা ছবিগুলো ধরার লজিক
        let imagePaths = [];
        
        // যদি ছবি রিকোয়েস্টে থাকে, তবে সেগুলোর পাথ বা নাম বের করে অ্যারেতে রাখবো
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file => file.filename || file.path); 
        } else if (req.file) {
            imagePaths.push(req.file.filename || req.file.path);
        }

        const newProduct = new Product({
            name,
            description,
            price,
            category,
            stock,
            images: imagePaths, // এখন আর ফাঁকা নেই, আসল ছবির নাম/পাথ বসবে!
            seller: req.user.id // টোকেন থেকে সেলার আইডি চলে আসবে
        });

        await newProduct.save();

        res.status(201).json({
            message: 'Product uploaded successfully with Image! 📸', // মেসেজ আপডেট করে দিলাম
            product: newProduct
        });
    } catch (error) {
        console.error('Error uploading product:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
// ১. সব প্রোডাক্ট তুলে আনার ফাংশন
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().populate('seller', 'name email');
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ২. আইডি দিয়ে নির্দিষ্ট একটা প্রোডাক্ট দেখার ফাংশন
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('seller', 'name email');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
// ৩. প্রোডাক্ট আপডেট করার ফাংশন (সেফ ভার্সন)
exports.updateProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock } = req.body;
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // সেফ চেক: যদি প্রোডাক্টে সেলার আইডি থাকে এবং সেটি যদি বর্তমান ইউজারের সাথে না মিলে
        if (product.seller && product.seller.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized to update this product' });
        }

        // ডাটা আপডেট
        product.name = name || product.name;
        product.description = description || product.description;
        product.price = price || product.price;
        product.category = category || product.category;
        product.stock = stock || product.stock;

        if (req.files && req.files.length > 0) {
            product.images = req.files.map(file => file.filename || file.path);
        }

        await product.save();
        res.status(200).json({ message: 'Product updated successfully! 🔄', product });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ৪. প্রোডাক্ট ডিলিট করার ফাংশন (সেফ ভার্সন)
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // সেফ চেক: যদি সেলার আইডি থাকে এবং সেটি যদি বর্তমান ইউজারের সাথে না মিলে
        if (product.seller && product.seller.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized to delete this product' });
        }

        await product.deleteOne();
        res.status(200).json({ message: 'Product deleted successfully! 🗑️' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};