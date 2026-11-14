const crypto = require("crypto");
const AndroidAppRelease = require("../models/AndroidAppRelease");
const PlatformSettings = require("../models/PlatformSettings");
const mediaStorage = require("../services/mediaStorage");
const {
    DEFAULT_MESSAGE,
    MAINTENANCE_SECTIONS,
    getPlatformSettings
} = require("../services/platformSettings");

exports.getSettings = async (_req, res) => {
    try {
        return res.json({
            success: true,
            ...await getPlatformSettings()
        });
    } catch (error) {
        console.error("GET PLATFORM SETTINGS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load platform availability."
        });
    }
};

exports.updateMaintenance = async (req, res) => {
    const section = req.body?.section;
    const enabled = req.body?.enabled;
    const message = typeof req.body?.message === "string"
        ? req.body.message.trim()
        : DEFAULT_MESSAGE;

    if (!MAINTENANCE_SECTIONS.includes(section)) {
        return res.status(400).json({
            success: false,
            message: "Choose a valid platform section."
        });
    }
    if (typeof enabled !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "enabled must be true or false."
        });
    }
    if (!message || message.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Enter a maintenance message with at most 500 characters."
        });
    }

    try {
        await PlatformSettings.findOneAndUpdate(
            { _id: "global" },
            {
                $set: {
                    [`maintenance.${section}`]: { enabled, message }
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.json({
            success: true,
            ...await getPlatformSettings()
        });
    } catch (error) {
        console.error("UPDATE PLATFORM MAINTENANCE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not update platform maintenance."
        });
    }
};

exports.getLatestAndroidRelease = async (_req, res) => {
    try {
        const release = await AndroidAppRelease.findById("android").lean();
        if (!release) {
            return res.status(404).json({
                success: false,
                message: "No Android update is currently available."
            });
        }

        return res.json({
            success: true,
            release: {
                packageId: release.packageId,
                versionName: release.versionName,
                versionCode: release.versionCode,
                releaseNotes: release.releaseNotes,
                forceUpdate: release.forceUpdate,
                downloadUrl: release.fileUrl,
                fileSize: release.fileSize,
                sha256: release.sha256,
                publishedAt: release.updatedAt
            }
        });
    } catch (error) {
        console.error("GET ANDROID RELEASE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not check for Android updates."
        });
    }
};

exports.getAndroidReleaseUploadSignature = async (_req, res) => {
    if (!mediaStorage.isCloudinaryConfigured()) {
        return res.status(503).json({
            success: false,
            message: "Configure persistent Cloudinary storage before publishing Android updates."
        });
    }

    try {
        const publicId = `etop_android_release_${crypto.randomUUID()}.apk`;
        const upload = mediaStorage.createSignedRawUpload(
            "etop/android-releases",
            publicId
        );
        if (!upload) {
            return res.status(503).json({
                success: false,
                message: "Could not create a secure Android upload."
            });
        }

        return res.json({
            success: true,
            upload: {
                ...upload,
                uploadUrl: `https://api.cloudinary.com/v1_1/${upload.cloudName}/raw/upload`
            }
        });
    } catch (error) {
        console.error("CREATE ANDROID RELEASE UPLOAD SIGNATURE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not prepare the Android update upload."
        });
    }
};

exports.publishAndroidRelease = async (req, res) => {
    const versionName = typeof req.body?.versionName === "string"
        ? req.body.versionName.trim()
        : "";
    const versionCode = Number(req.body?.versionCode);
    const releaseNotes = typeof req.body?.releaseNotes === "string"
        ? req.body.releaseNotes.trim()
        : "";
    const forceUpdateValue = req.body?.forceUpdate;
    const forceUpdate = forceUpdateValue === true || forceUpdateValue === "true";
    const publicId = typeof req.body?.publicId === "string"
        ? req.body.publicId.trim()
        : "";
    const fileUrl = typeof req.body?.fileUrl === "string"
        ? req.body.fileUrl.trim()
        : "";
    const fileSize = Number(req.body?.fileSize);
    const sha256 = typeof req.body?.sha256 === "string"
        ? req.body.sha256.trim().toLowerCase()
        : "";

    try {
        if (!/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/.test(versionName)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid version name."
            });
        }
        if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
            return res.status(400).json({
                success: false,
                message: "Version code must be a positive whole number."
            });
        }
        if (releaseNotes.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Release notes must be at most 2000 characters."
            });
        }
        if (forceUpdateValue !== undefined &&
            ![true, false, "true", "false"].includes(forceUpdateValue)) {
            return res.status(400).json({
                success: false,
                message: "forceUpdate must be true or false."
            });
        }
        if (!mediaStorage.isCloudinaryConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Configure persistent Cloudinary storage before publishing Android updates."
            });
        }
        if (
            !/^etop_android_release_[a-f\d-]{36}\.apk$/i.test(publicId) ||
            !/^https:\/\/res\.cloudinary\.com\/[^/]+\/raw\/upload\//i.test(fileUrl) ||
            !Number.isSafeInteger(fileSize) ||
            fileSize < 1 ||
            fileSize > 500 * 1024 * 1024 ||
            !/^[a-f\d]{64}$/.test(sha256)
        ) {
            return res.status(400).json({
                success: false,
                message: "The uploaded Android APK metadata is invalid."
            });
        }

        const current = await AndroidAppRelease.findById("android").lean();
        if (current && versionCode <= current.versionCode) {
            return res.status(409).json({
                success: false,
                message: "Each Android release must use a version code higher than the current release."
            });
        }

        const stored = await mediaStorage.getRawUploadResource(publicId);
        if (
            !stored ||
            stored.resource_type !== "raw" ||
            stored.public_id !== publicId ||
            stored.secure_url !== fileUrl ||
            Number(stored.bytes) !== fileSize
        ) {
            return res.status(400).json({
                success: false,
                message: "The uploaded APK could not be verified in persistent storage."
            });
        }

        const release = await AndroidAppRelease.findOneAndUpdate(
            { _id: "android" },
            {
                $set: {
                    packageId: "com.etop.app",
                    versionName,
                    versionCode,
                    releaseNotes,
                    forceUpdate,
                    fileUrl,
                    fileSize,
                    sha256
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        ).lean();

        return res.status(201).json({
            success: true,
            release: {
                versionName: release.versionName,
                versionCode: release.versionCode,
                fileSize: release.fileSize,
                forceUpdate: release.forceUpdate,
                publishedAt: release.updatedAt
            }
        });
    } catch (error) {
        console.error("PUBLISH ANDROID RELEASE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not publish the Android update."
        });
    }
};
