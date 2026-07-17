const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order'); // 👈 অর্ডার মডেল ইমপোর্ট করা হলো

// ==========================================
// ১. কার্টে প্রোডাক্ট যোগ করার ফাংশন
// ==========================================
exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user.id;

        // সেফ চেক: টোকেনের ভেতরের ইউজার আইডি মঙ্গুজের সঠিক ObjectId কি না যাচাই করবে
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID inside token. Please login again!' });
        }

        // সেফ চেক: পাঠানো প্রোডাক্ট আইডি মঙ্গুজের সঠিক ObjectId কি না যাচাই করবে
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid Product ID format!' });
        }

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({ user: userId, items: [{ product: productId, quantity: quantity || 1 }] });
        } else {
            const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += (quantity || 1);
            } else {
                cart.items.push({ product: productId, quantity: quantity || 1 });
            }
        }

        await cart.save();
        res.status(200).json({ message: 'Product added to cart! 🛒', cart });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ==========================================
// ২. ইউজারের কার্ট দেখার ফাংশন
// ==========================================
exports.getCart = async (req, res) => {
    try {
        const userId = req.user.id;

        // সেফ চেক: ইউজার আইডি ভ্যালিডেশন
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID inside token!' });
        }

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart) return res.status(200).json({ items: [] });
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ==========================================
// ৩. কার্ট থেকে অর্ডার প্লেস করার ফাংশন (Checkout) 🚀
// ==========================================
exports.placeOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { shippingAddress } = req.body;

        if (!shippingAddress) {
            return res.status(400).json({ message: 'Shipping address is required!' });
        }

        // ইউজারের কার্ট খুঁজে বের করা
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty! Cannot place order.' });
        }

        // মোট অর্ডারের দাম (Total Amount) হিসাব করা
        let totalAmount = 0;
        const orderItems = cart.items.map(item => {
            if (item.product) {
                totalAmount += item.product.price * item.quantity;
                return {
                    product: item.product._id,
                    quantity: item.quantity
                };
            }
        }).filter(Boolean); // কোনো কারণে প্রোডাক্ট ডিলেট হয়ে থাকলে সেটা ফিল্টার করবে

        // নতুন অর্ডার তৈরি করা
        const newOrder = new Order({
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress
        });

        await newOrder.save();

        // অর্ডার সফল হওয়ার পর ইউজারের কার্টটি ডিলিট/খালি করে দেওয়া
        await Cart.findOneAndDelete({ user: userId });

        res.status(201).json({ 
            message: 'Order placed successfully! 📦✈️', 
            order: newOrder 
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};