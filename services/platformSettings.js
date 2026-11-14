const PlatformSettings = require("../models/PlatformSettings");

const MAINTENANCE_SECTIONS = ["app", "home", "reels", "messenger", "shop", "profile"];
const DEFAULT_MESSAGE = "This section is temporarily unavailable while we make updates.";

const DEFAULT_MAINTENANCE = Object.fromEntries(
    MAINTENANCE_SECTIONS.map(section => [
        section,
        { enabled: false, message: DEFAULT_MESSAGE }
    ])
);

const getPlatformSettings = async () => {
    const settings = await PlatformSettings.findOneAndUpdate(
        { _id: "global" },
        { $setOnInsert: { maintenance: DEFAULT_MAINTENANCE } },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
        }
    ).lean();

    return {
        maintenance: Object.fromEntries(
            MAINTENANCE_SECTIONS.map(section => [
                section,
                {
                    ...DEFAULT_MAINTENANCE[section],
                    ...(settings.maintenance?.[section] || {})
                }
            ])
        )
    };
};

module.exports = {
    DEFAULT_MAINTENANCE,
    DEFAULT_MESSAGE,
    MAINTENANCE_SECTIONS,
    getPlatformSettings
};
