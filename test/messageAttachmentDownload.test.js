const assert = require("node:assert/strict");
const test = require("node:test");
const Message = require("../models/Message");
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
