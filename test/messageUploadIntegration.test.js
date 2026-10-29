const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const express = require("express");
const test = require("node:test");
const messageUpload = require("../middleware/messageUpload");

test("Messenger upload limit supports 500MB attachments", () => {
    assert.equal(messageUpload.maxFileSize, 500 * 1024 * 1024);
});

test("multipart audio requests preserve the receiver and uploaded voice file", async () => {
    const app = express();
    app.post(
        "/messages/send",
        messageUpload.cleanup,
        messageUpload.single("file"),
        messageUpload.validateContent,
        (req, res, next) => {
            fs.readFile(req.file.path, (error, contents) => {
                if (error) return next(error);
                return res.json({
                    receiver: req.body.receiver,
                    fileName: req.file?.originalname,
                    fileType: req.file?.mimetype,
                    fileSize: req.file?.size,
                    fileBuffered: Boolean(req.file?.buffer),
                    fileContents: contents.toString()
                });
            });
        }
    );

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

    try {
        const voiceBytes = Buffer.from([
            0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x86, 0x81
        ]);
        const form = new FormData();
        form.append("receiver", "507f1f77bcf86cd799439011");
        form.append(
            "file",
            new Blob([voiceBytes], { type: "audio/webm" }),
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

        assert.equal(response.status, 200);
        assert.equal(result.receiver, "507f1f77bcf86cd799439011");
        assert.equal(result.fileName, "voice-note.webm");
        assert.equal(result.fileType, "audio/webm");
        assert.equal(result.fileSize, voiceBytes.length);
        assert.equal(result.fileBuffered, false);
        assert.equal(result.fileContents, voiceBytes.toString());
    } finally {
        await new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())
        );
    }
});

test("multipart PDF attachments larger than 10MB are accepted", async () => {
    const app = express();
    app.post(
        "/messages/send",
        messageUpload.cleanup,
        messageUpload.single("file"),
        messageUpload.validateContent,
        (req, res) => res.json({ fileSize: req.file?.size })
    );
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

    try {
        const pdfBytes = Buffer.alloc(11 * 1024 * 1024);
        pdfBytes.write("%PDF-1.7");
        const form = new FormData();
        form.append(
            "file",
            new Blob([pdfBytes], { type: "application/pdf" }),
            "large-scan.pdf"
        );
        const address = server.address();
        const response = await fetch(
            `http://127.0.0.1:${address.port}/messages/send`,
            { method: "POST", body: form }
        );
        const result = await response.json();

        assert.equal(response.status, 200);
        assert.equal(result.fileSize, pdfBytes.length);
    } finally {
        await new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())
        );
    }
});

test("multipart upload rejects a file whose bytes do not match its declared MIME type", async () => {
    const app = express();
    app.post(
        "/messages/send",
        messageUpload.cleanup,
        messageUpload.single("file"),
        messageUpload.validateContent,
        (req, res) => res.json({ accepted: true })
    );
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

    try {
        const form = new FormData();
        form.append(
            "file",
            new Blob(["not an image"], { type: "image/png" }),
            "photo.png"
        );
        const address = server.address();
        const response = await fetch(
            `http://127.0.0.1:${address.port}/messages/send`,
            { method: "POST", body: form }
        );
        const result = await response.json();

        assert.equal(response.status, 400);
        assert.equal(result.success, false);
        assert.match(result.message, /content does not match/i);
    } finally {
        await new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())
        );
    }
});
