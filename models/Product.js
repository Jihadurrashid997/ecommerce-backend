const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    seller: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: false // যদি সেলার আইডি ছাড়া টেস্ট করতে চান সাময়িকভাবে false রাখতে পারেন
    }, 
    title: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
