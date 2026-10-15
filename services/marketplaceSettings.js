const MarketplaceSettings = require("../models/MarketplaceSettings");

const DEFAULT_SETTINGS = {
    marketplaceEnabled: true,
    requireProductApproval: false
};

const getMarketplaceSettings = async () =>
    MarketplaceSettings.findOneAndUpdate(
        { _id: "global" },
        { $setOnInsert: DEFAULT_SETTINGS },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    ).lean();

module.exports = {
    DEFAULT_SETTINGS,
    getMarketplaceSettings
};
