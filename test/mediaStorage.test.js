const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");
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
    const originalChunkedUploadStream = cloudinary.uploader.upload_chunked_stream;
    const originalDestroy = cloudinary.uploader.destroy;
    let uploadOptions;
    let uploadedBytes;
    let destroyOptions;

    const mockUploadStream = (options, callback) => {
        uploadOptions = options;
        const chunks = [];
        return new Writable({
            write(chunk, _encoding, done) {
                chunks.push(Buffer.from(chunk));
                done();
            },
            final(done) {
                uploadedBytes = Buffer.concat(chunks).toString();
                callback(null, {
                    secure_url: "https://media.example/voice.webm",
                    public_id: "etop/messenger/voice",
                    duration: 2
                });
                done();
            }
        });
    };

    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.uploader.upload_stream = mockUploadStream;
    cloudinary.uploader.destroy = async (publicId, options) => {
        destroyOptions = { publicId, ...options };
        return { result: "ok" };
    };

    try {
        const saved = await saveFile({
            buffer: Buffer.from("voice-data"),
            mimetype: "audio/webm",
            originalname: "voice-note.webm"
        }, "etop/messenger", {
            deliveryType: "authenticated"
        });

        assert.equal(uploadedBytes, "voice-data");
        assert.equal(uploadOptions.resource_type, "video");
        assert.equal(uploadOptions.folder, "etop/messenger");
        assert.equal(uploadOptions.type, "authenticated");
        assert.equal(saved.type, "audio");
        assert.equal(saved.deliveryType, "authenticated");
        assert.equal(saved.url, "https://media.example/voice.webm");

        await deleteFile(saved);
        assert.deepEqual(destroyOptions, {
            publicId: "etop/messenger/voice",
            resource_type: "video"
        });
    } finally {
        cloudinary.uploader.upload_stream = originalUploadStream;
        cloudinary.uploader.upload_chunked_stream = originalChunkedUploadStream;
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

test("large path-backed Messenger uploads use Cloudinary chunked streaming", async () => {
    const previousEnvironment = {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    };
    const originalChunkedUploadStream = cloudinary.uploader.upload_chunked_stream;
    const tempDirectory = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), "media-storage-test-")
    );
    const filePath = path.join(tempDirectory, "scan.pdf");
    await fs.promises.writeFile(filePath, "%PDF-1.7");
    let uploadOptions;
    let uploadedBytes;

    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.uploader.upload_chunked_stream = (options, callback) => {
        uploadOptions = options;
        const chunks = [];
        return new Writable({
            write(chunk, _encoding, done) {
                chunks.push(Buffer.from(chunk));
                done();
            },
            final(done) {
                uploadedBytes = Buffer.concat(chunks).toString();
                callback(null, {
                    secure_url: "https://media.example/scan.pdf",
                    public_id: "etop/messenger/scan",
                    duration: 0
                });
                done();
            }
        });
    };

    try {
        const saved = await saveFile({
            path: filePath,
            size: 21 * 1024 * 1024,
            mimetype: "application/pdf",
            originalname: "scan.pdf"
        }, "etop/messenger");

        assert.equal(uploadOptions.resource_type, "raw");
        assert.equal(uploadOptions.chunk_size, 20 * 1024 * 1024);
        assert.equal(uploadedBytes, "%PDF-1.7");
        assert.equal(saved.url, "https://media.example/scan.pdf");
    } finally {
        cloudinary.uploader.upload_chunked_stream = originalChunkedUploadStream;
        await fs.promises.rm(tempDirectory, { recursive: true, force: true });
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

test("attachment download URLs use Cloudinary's signed delivery API", () => {
    const previousEnvironment = {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    };
    const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
    let downloadOptions;

    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.utils.private_download_url = (publicId, format, options) => {
        downloadOptions = { publicId, format, ...options };
        return "https://api.cloudinary.example/signed-download";
    };

    try {
        const { getPrivateDownloadUrl } = require("../services/mediaStorage");
        const url = getPrivateDownloadUrl(
            "etop/messenger/scan.pdf",
            "messenger-scan.pdf",
            {
                mediaType: "raw",
                mimeType: "application/pdf",
                deliveryType: "authenticated",
                attachment: true
            }
        );

        assert.equal(url, "https://api.cloudinary.example/signed-download");
        assert.equal(downloadOptions.publicId, "etop/messenger/scan");
        assert.equal(downloadOptions.format, "pdf");
        assert.equal(downloadOptions.resource_type, "raw");
        assert.equal(downloadOptions.type, "authenticated");
        assert.equal(downloadOptions.attachment, true);
        assert.ok(downloadOptions.expires_at > Math.floor(Date.now() / 1000));
    } finally {
        cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
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

test("image and video attachment URLs retain their Cloudinary resource types", () => {
    const previousEnvironment = {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    };
    const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
    const calls = [];
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.utils.private_download_url = (publicId, format, options) => {
        calls.push({ publicId, format, ...options });
        return "https://api.cloudinary.example/signed-download";
    };

    try {
        const { getPrivateDownloadUrl } = require("../services/mediaStorage");
        getPrivateDownloadUrl("etop/messenger/photo", "photo.jpg", {
            mediaType: "image",
            mimeType: "image/jpeg",
            deliveryType: "authenticated"
        });
        getPrivateDownloadUrl("etop/messenger/clip", "clip.mp4", {
            mediaType: "video",
            mimeType: "video/mp4",
            deliveryType: "authenticated"
        });

        assert.equal(calls[0].resource_type, "image");
        assert.equal(calls[0].type, "authenticated");
        assert.equal(calls[1].resource_type, "video");
        assert.equal(calls[1].type, "authenticated");
    } finally {
        cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
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
