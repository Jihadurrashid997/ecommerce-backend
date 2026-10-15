const mongoose = require("mongoose");

const marketplaceSettingsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: "global"
    },
    marketplaceEnabled: {
        type: Boolean,
        default: true
    },
    requireProductApproval: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model(
    "MarketplaceSettings",
    marketplaceSettingsSchema
);
