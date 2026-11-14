const mongoose = require("mongoose");

const maintenanceSectionSchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: false
    },
    message: {
        type: String,
        default: "This section is temporarily unavailable while we make updates.",
        maxlength: 500
    }
}, {
    _id: false
});

const platformSettingsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: "global"
    },
    maintenance: {
        app: { type: maintenanceSectionSchema, default: () => ({}) },
        home: { type: maintenanceSectionSchema, default: () => ({}) },
        reels: { type: maintenanceSectionSchema, default: () => ({}) },
        messenger: { type: maintenanceSectionSchema, default: () => ({}) },
        shop: { type: maintenanceSectionSchema, default: () => ({}) },
        profile: { type: maintenanceSectionSchema, default: () => ({}) }
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
