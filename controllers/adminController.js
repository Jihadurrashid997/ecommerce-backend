const Settings = require('../models/Settings');
const Product = require('../models/Product');

// Initialize settings if empty
const getSettingsInstance = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings();
        await settings.save();
    }
    return settings;
};

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