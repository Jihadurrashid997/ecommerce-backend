const assert = require("node:assert/strict");
const test = require("node:test");
const cloudinary = require("cloudinary").v2;
const Message = require("../models/Message");
const MessageRequest = require("../models/MessageRequest");
const { getAttachmentDownload } = require("../controllers/messageController");

const createResponse = () => {
    const response = {
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
    };
    return response;
};

test("authorized conversation participants can resolve a PDF download URL", async () => {
    const originalFindById = Message.findById;
    Message.findById = () => ({
        select: () => ({
            lean: async () => ({
                sender: "user-1",
                receiver: "user-2",
                fileUrl: "https://media.example/scan.pdf",
                fileName: "scan.pdf",
                fileType: "application/pdf",
                filePublicId: ""
            })
        })
    });

    try {
        const response = createResponse();
        await getAttachmentDownload(
            { params: { id: "message-1" }, user: { id: "user-2" } },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.downloadUrl, "https://media.example/scan.pdf");
    } finally {
        Message.findById = originalFindById;
    }
});

test("users outside the conversation cannot resolve a PDF download URL", async () => {
    const originalFindById = Message.findById;
    Message.findById = () => ({
        select: () => ({
            lean: async () => ({
                sender: "user-1",
                receiver: "user-2",
                fileUrl: "https://media.example/scan.pdf",
                fileName: "scan.pdf",
                fileType: "application/pdf"
            })
        })
    });

    try {
        const response = createResponse();
        await getAttachmentDownload(
            { params: { id: "message-1" }, user: { id: "stranger" } },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.equal(response.body.success, false);
    } finally {
        Message.findById = originalFindById;
    }
});

test("authorized participants receive temporary signed URLs for image attachments", async () => {
    const originals = {
        findById: Message.findById,
        privateDownloadUrl: cloudinary.utils.private_download_url,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    };
    let downloadOptions;
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.utils.private_download_url = (publicId, format, options) => {
        downloadOptions = { publicId, format, ...options };
        return "https://api.cloudinary.example/temporary-image";
    };
    Message.findById = () => ({
        select: () => ({
            lean: async () => ({
                sender: "user-1",
                receiver: "user-2",
                fileUrl: "https://res.cloudinary.example/public-photo.jpg",
                fileName: "photo.jpg",
                fileType: "image/jpeg",
                filePublicId: "etop/messenger/photo",
                fileStorageType: "image",
                fileDeliveryType: "authenticated"
            })
        })
    });

    try {
        const response = createResponse();
        await getAttachmentDownload(
            { params: { id: "message-1" }, user: { id: "user-2" } },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(
            response.body.downloadUrl,
            "https://api.cloudinary.example/temporary-image"
        );
        assert.equal(downloadOptions.resource_type, "image");
        assert.equal(downloadOptions.type, "authenticated");
        assert.equal(downloadOptions.attachment, false);
        assert.notEqual(response.body.downloadUrl, "https://res.cloudinary.example/public-photo.jpg");
    } finally {
        Message.findById = originals.findById;
        cloudinary.utils.private_download_url = originals.privateDownloadUrl;
        if (originals.cloudName === undefined) {
            delete process.env.CLOUDINARY_CLOUD_NAME;
        } else {
            process.env.CLOUDINARY_CLOUD_NAME = originals.cloudName;
        }
        if (originals.apiKey === undefined) {
            delete process.env.CLOUDINARY_API_KEY;
        } else {
            process.env.CLOUDINARY_API_KEY = originals.apiKey;
        }
        if (originals.apiSecret === undefined) {
            delete process.env.CLOUDINARY_API_SECRET;
        } else {
            process.env.CLOUDINARY_API_SECRET = originals.apiSecret;
        }
    }
});

test("message and request serialization replace Cloudinary source URLs with signed URLs", () => {
    const originals = {
        privateDownloadUrl: cloudinary.utils.private_download_url,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    };
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.utils.private_download_url = () =>
        "https://api.cloudinary.example/temporary-media";

    try {
        const sourceUrl = "https://res.cloudinary.example/public-photo.jpg";
        const message = new Message({
            sender: "507f1f77bcf86cd799439011",
            receiver: "507f191e810c19729de860ea",
            fileUrl: sourceUrl,
            fileName: "photo.jpg",
            fileType: "image/jpeg",
            filePublicId: "etop/messenger/photo",
            fileStorageType: "image",
            fileDeliveryType: "authenticated"
        });
        const request = new MessageRequest({
            sender: "507f1f77bcf86cd799439011",
            recipient: "507f191e810c19729de860ea",
            fileUrl: sourceUrl,
            fileName: "photo.jpg",
            fileType: "image/jpeg",
            filePublicId: "etop/messenger/photo",
            fileStorageType: "image",
            fileDeliveryType: "authenticated"
        });

        assert.equal(
            message.toJSON().fileUrl,
            "https://api.cloudinary.example/temporary-media"
        );
        assert.equal(
            message.toObject().fileUrl,
            "https://api.cloudinary.example/temporary-media"
        );
        assert.equal(
            request.toJSON().fileUrl,
            "https://api.cloudinary.example/temporary-media"
        );
        assert.equal(message.fileUrl, sourceUrl);
        assert.equal(request.fileUrl, sourceUrl);
    } finally {
        cloudinary.utils.private_download_url = originals.privateDownloadUrl;
        if (originals.cloudName === undefined) {
            delete process.env.CLOUDINARY_CLOUD_NAME;
        } else {
            process.env.CLOUDINARY_CLOUD_NAME = originals.cloudName;
        }
        if (originals.apiKey === undefined) {
            delete process.env.CLOUDINARY_API_KEY;
        } else {
            process.env.CLOUDINARY_API_KEY = originals.apiKey;
        }
        if (originals.apiSecret === undefined) {
            delete process.env.CLOUDINARY_API_SECRET;
        } else {
            process.env.CLOUDINARY_API_SECRET = originals.apiSecret;
        }
    }
});
