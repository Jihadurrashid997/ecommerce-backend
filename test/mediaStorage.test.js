const assert = require("node:assert/strict");
const test = require("node:test");
const cloudinary = require("cloudinary").v2;
const { deleteFile, saveFile } = require("../services/mediaStorage");

test("voice uploads use durable Cloudinary audio storage and delete as video resources", async () => {
    const previousEnvironment = {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    };
    const originalUploadStream = cloudinary.uploader.upload_stream;
    const originalDestroy = cloudinary.uploader.destroy;
    let uploadOptions;
    let destroyOptions;

    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.uploader.upload_stream = (options, callback) => {
        uploadOptions = options;
        return {
            end: buffer => {
                assert.equal(buffer.toString(), "voice-data");
                callback(null, {
                    secure_url: "https://media.example/voice.webm",
                    public_id: "etop/messenger/voice",
                    duration: 2
                });
            }
        };
    };
    cloudinary.uploader.destroy = async (publicId, options) => {
        destroyOptions = { publicId, ...options };
        return { result: "ok" };
    };

    try {
        const saved = await saveFile({
            buffer: Buffer.from("voice-data"),
            mimetype: "audio/webm",
            originalname: "voice-note.webm"
        }, "etop/messenger");

        assert.equal(uploadOptions.resource_type, "video");
        assert.equal(uploadOptions.folder, "etop/messenger");
        assert.equal(saved.type, "audio");
        assert.equal(saved.url, "https://media.example/voice.webm");

        await deleteFile(saved);
        assert.deepEqual(destroyOptions, {
            publicId: "etop/messenger/voice",
            resource_type: "video"
        });
    } finally {
        cloudinary.uploader.upload_stream = originalUploadStream;
        cloudinary.uploader.destroy = originalDestroy;

        if (previousEnvironment.cloudName === undefined) {
            delete process.env.CLOUDINARY_CLOUD_NAME;
        } else {
            process.env.CLOUDINARY_CLOUD_NAME = previousEnvironment.cloudName;
        }
        if (previousEnvironment.apiKey === undefined) {
            delete process.env.CLOUDINARY_API_KEY;
        } else {
            process.env.CLOUDINARY_API_KEY = previousEnvironment.apiKey;
        }
        if (previousEnvironment.apiSecret === undefined) {
            delete process.env.CLOUDINARY_API_SECRET;
        } else {
            process.env.CLOUDINARY_API_SECRET = previousEnvironment.apiSecret;
        }
    }
});
