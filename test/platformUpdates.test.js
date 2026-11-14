const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const AndroidAppRelease = require("../models/AndroidAppRelease");
const PlatformSettings = require("../models/PlatformSettings");
const mediaStorage = require("../services/mediaStorage");
const platformSettings = require("../services/platformSettings");
const platformController = require("../controllers/platformController");

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("platform settings default every module to available", () => {
    const settings = new PlatformSettings();

    for (const section of platformSettings.MAINTENANCE_SECTIONS) {
        assert.equal(settings.maintenance[section].enabled, false);
        assert.equal(
            settings.maintenance[section].message,
            platformSettings.DEFAULT_MESSAGE
        );
    }
});

test("platform settings service fills missing sections in legacy settings", async () => {
    const originalFindOneAndUpdate = PlatformSettings.findOneAndUpdate;
    PlatformSettings.findOneAndUpdate = () => ({
        lean: async () => ({
            _id: "global",
            maintenance: {
                home: { enabled: true, message: "Updating Home" }
            }
        })
    });

    try {
        const settings = await platformSettings.getPlatformSettings();
        assert.deepEqual(settings.maintenance.home, {
            enabled: true,
            message: "Updating Home"
        });
        assert.equal(settings.maintenance.reels.enabled, false);
        assert.equal(settings.maintenance.app.enabled, false);
        assert.deepEqual(settings.maintenance.community, {
            enabled: false,
            message: platformSettings.DEFAULT_MESSAGE
        });
    } finally {
        PlatformSettings.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("admin can set one module's maintenance status and message", async () => {
    const originalFindOneAndUpdate = PlatformSettings.findOneAndUpdate;
    let update;
    PlatformSettings.findOneAndUpdate = (_filter, nextUpdate) => {
        if (!update) update = nextUpdate;
        return {
            lean: async () => ({
                _id: "global",
                maintenance: {
                    ...platformSettings.DEFAULT_MAINTENANCE,
                    community: { enabled: true, message: "Community update in progress." }
                }
            })
        };
    };

    try {
        const response = makeResponse();
        await platformController.updateMaintenance(
            {
                body: {
                    section: "community",
                    enabled: true,
                    message: "  Community update in progress.  "
                }
            },
            response
        );

        assert.deepEqual(update.$set, {
            "maintenance.community": {
                enabled: true,
                message: "Community update in progress."
            }
        });
        assert.equal(response.body.maintenance.community.enabled, true);
    } finally {
        PlatformSettings.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("admin maintenance rejects unknown modules and invalid booleans", async () => {
    const invalidSectionResponse = makeResponse();
    await platformController.updateMaintenance(
        { body: { section: "payments", enabled: true } },
        invalidSectionResponse
    );
    assert.equal(invalidSectionResponse.statusCode, 400);

    const invalidValueResponse = makeResponse();
    await platformController.updateMaintenance(
        { body: { section: "home", enabled: "true" } },
        invalidValueResponse
    );
    assert.equal(invalidValueResponse.statusCode, 400);
});

test("public Android release endpoint returns version and download metadata", async () => {
    const originalFindById = AndroidAppRelease.findById;
    AndroidAppRelease.findById = () => ({
        lean: async () => ({
            _id: "android",
            packageId: "com.etop.app",
            versionName: "1.1.0",
            versionCode: 2,
            releaseNotes: "Stability improvements.",
            forceUpdate: false,
            fileUrl: "https://cdn.example.com/etop.apk",
            fileSize: 1024,
            sha256: "a".repeat(64),
            updatedAt: new Date("2026-11-14T00:00:00.000Z")
        })
    });

    try {
        const response = makeResponse();
        await platformController.getLatestAndroidRelease({}, response);
        assert.equal(response.body.release.versionCode, 2);
        assert.equal(response.body.release.fileSize, 1024);
        assert.equal(response.body.release.sha256, "a".repeat(64));
    } finally {
        AndroidAppRelease.findById = originalFindById;
    }
});

test("Android release upload requires increasing version codes and valid APK archives", async () => {
    const originalFindById = AndroidAppRelease.findById;
    const originalFindOneAndUpdate = AndroidAppRelease.findOneAndUpdate;
    const originalIsCloudinaryConfigured = mediaStorage.isCloudinaryConfigured;
    const originalGetRawUploadResource = mediaStorage.getRawUploadResource;
    let storedUpdate;
    const publicId = "etop_android_release_123e4567-e89b-12d3-a456-426614174000.apk";
    const fileUrl = "https://res.cloudinary.com/test/raw/upload/v1/etop_android_release.apk";
    const fileSize = 1024;
    const sha256 = crypto.createHash("sha256").update("signed apk test").digest("hex");

    AndroidAppRelease.findById = () => ({
        lean: async () => null
    });
    AndroidAppRelease.findOneAndUpdate = (_filter, update) => {
        storedUpdate = update.$set;
        return {
            lean: async () => ({
            ...storedUpdate,
            updatedAt: new Date("2026-11-14T00:00:00.000Z")
        })
        };
    };
    mediaStorage.isCloudinaryConfigured = () => true;
    mediaStorage.getRawUploadResource = async () => ({
        resource_type: "raw",
        public_id: publicId,
        secure_url: fileUrl,
        bytes: fileSize
    });

    try {
        const response = makeResponse();
        await platformController.publishAndroidRelease(
            {
                body: {
                    versionName: "1.0.1",
                    versionCode: "2",
                    releaseNotes: "Update",
                    forceUpdate: false,
                    publicId,
                    fileUrl,
                    fileSize: String(fileSize),
                    sha256
                }
            },
            response
        );

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.release.versionCode, 2);
        assert.equal(response.body.release.fileSize, fileSize);
        assert.equal(storedUpdate.sha256, sha256);
    } finally {
        AndroidAppRelease.findById = originalFindById;
        AndroidAppRelease.findOneAndUpdate = originalFindOneAndUpdate;
        mediaStorage.isCloudinaryConfigured = originalIsCloudinaryConfigured;
        mediaStorage.getRawUploadResource = originalGetRawUploadResource;
    }
});
