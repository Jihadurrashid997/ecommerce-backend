const mongoose = require("mongoose");

const androidAppReleaseSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: "android"
    },
    packageId: {
        type: String,
        required: true,
        default: "com.etop.app"
    },
    versionName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40
    },
    versionCode: {
        type: Number,
        required: true,
        min: 1
    },
    releaseNotes: {
        type: String,
        default: "",
        maxlength: 2000
    },
    forceUpdate: {
        type: Boolean,
        default: false
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true,
        min: 1
    },
    sha256: {
        type: String,
        required: true,
        match: /^[a-f\d]{64}$/i
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("AndroidAppRelease", androidAppReleaseSchema);
