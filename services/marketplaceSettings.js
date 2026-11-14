const MarketplaceSettings = require("../models/MarketplaceSettings");

const DEFAULT_SETTINGS = {
    shopLive: false,
    marketplaceEnabled: true,
    requireProductApproval: false
};

const getMarketplaceSettings = async () => {
    const settings = await MarketplaceSettings.findOneAndUpdate(
        { _id: "global" },
        { $setOnInsert: DEFAULT_SETTINGS },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    ).lean();

    return {
        ...settings,
        marketplaceEnabled:
            settings.shopLive === true && settings.marketplaceEnabled === true
    };
};

module.exports = {
    DEFAULT_SETTINGS,
    getMarketplaceSettings
};
