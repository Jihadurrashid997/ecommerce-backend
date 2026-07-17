const Cart = require('../models/Cart');
const Product = require('../models/Product');

// ১. কার্টে প্রোডাক্ট যোগ করা
exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user.id; // auth middleware থেকে আসবে

        // প্রোডাক্ট আসলেই ডাটাবেজে আছে কিনা চেক করা
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // ইউজারের আগের কোনো কার্ট আছে কিনা দেখা
        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            // কার্ট না থাকলে নতুন কার্ট তৈরি করা
            cart = new Cart({
                user: userId,
                items: [{ product: productId, quantity: quantity || 1 }]
            });
        } else {
            // কার্ট থাকলে চেক করা প্রোডাক্টটি অলরেডি কার্টে আছে কিনা
            const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

            if (itemIndex > -1) {
                // অলরেডি থাকলে শুধু কোয়ান্টিটি বাড়িয়ে দেওয়া
                cart.items[itemIndex].quantity += (quantity || 1);
            } else {
                // না থাকলে নতুন আইটেম পুশ করা
                cart.items.push({ product: productId, quantity: quantity || 1 });
            }
        }

        await cart.save();
        res.status(200).json({ message: 'Product added to cart! 🛒', cart });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ২. ইউজারের কার্ট দেখা
exports.getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
        if (!cart) {
            return res.status(200).json({ items: [] });
        }
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};