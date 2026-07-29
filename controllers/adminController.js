const Settings = require('../models/Settings');
const Product = require('../models/Product');
const User = require('../models/User'); // ইউজার মডেলটি ইম্পোর্ট করা হলো যাতে অ্যাডমিন প্যানেলে সব রেজিস্টার্ড অ্যাকাউন্ট দেখা যায়

// Initialize settings if empty
const getSettingsInstance = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings();
        await settings.save();
    }
    return settings;
};

// Update marketplace settings
exports.updateMarketplaceSettings = async (req, res) => {
    try {
        const { maxSellerImages, vatPercentage, activePaymentGateway } = req.body;
        let settings = await getSettingsInstance();

        if (maxSellerImages !== undefined) settings.maxSellerImages = maxSellerImages;
        if (vatPercentage !== undefined) settings.vatPercentage = vatPercentage;
        if (activePaymentGateway !== undefined) settings.activePaymentGateway = activePaymentGateway;

        await settings.save();
        res.status(200).json({ message: 'Settings updated successfully', settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Approve product
exports.approveProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await Product.findByIdAndUpdate(productId, { isApproved: true }, { new: true });
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.status(200).json({ message: 'Product approved successfully', product });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// View all registered accounts for the admin panel
exports.getAllRegisteredUsers = async (req, res) => {
    try {
        // ডাটাবেজ থেকে সমস্ত ইউজারের তালিকা সংগ্রহ করা হচ্ছে (পাসওয়ার্ড বাদে)
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            totalUsers: users.length,
            users
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
