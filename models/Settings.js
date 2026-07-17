const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    maxSellerImages: {
        type: Number,
        default: 3
    },
    vatPercentage: {
        type: Number,
        default: 15
    },
    activePaymentGateway: {
        type: String,
        enum: ['COD', 'SSLCommerz', 'bKash', 'Stripe'],
        default: 'COD'
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);