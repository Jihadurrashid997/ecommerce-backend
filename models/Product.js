const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    // String কেটে আবার সঠিক মঙ্গুজ অবজেক্ট আইডি করে দেওয়া হলো
    seller: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, 
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    images: [{ type: String, required: true }],
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);