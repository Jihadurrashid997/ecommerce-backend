const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const test = require("node:test");
const messageUpload = require("../middleware/messageUpload");

test("multipart audio requests preserve the receiver and uploaded voice file", async () => {
    const app = express();
    app.post("/messages/send", messageUpload.single("file"), (req, res) => {
        res.json({
            receiver: req.body.receiver,
            fileName: req.file?.originalname,
            fileType: req.file?.mimetype,
            fileSize: req.file?.size,
            storedName: req.file?.filename
        });
    });

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    let storedPath;

    try {
        const form = new FormData();
        form.append("receiver", "507f1f77bcf86cd799439011");
        form.append(
            "file",
            new Blob(["voice-message"], { type: "audio/webm" }),
            "voice-note.webm"
        );

        const address = server.address();
        const response = await fetch(
            `http://127.0.0.1:${address.port}/messages/send`,
            {
                method: "POST",
                body: form
            }
        );
        const result = await response.json();
        storedPath = result.storedName
            ? path.join(process.cwd(), "uploads", result.storedName)
            : null;

        assert.equal(response.status, 200);
        assert.equal(result.receiver, "507f1f77bcf86cd799439011");
        assert.equal(result.fileName, "voice-note.webm");
        assert.equal(result.fileType, "audio/webm");
        assert.equal(result.fileSize, 13);
        assert.ok(result.storedName);
    } finally {
        await new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())
        );
        if (storedPath) {
            await fs.unlink(storedPath);
        }
    }
});
