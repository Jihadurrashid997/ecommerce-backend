const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const MAX_MESSAGE_ATTACHMENT_BYTES = 500 * 1024 * 1024;
const MAX_ENCRYPTED_ATTACHMENT_BYTES = MAX_MESSAGE_ATTACHMENT_BYTES + 16;
const uploadTempDirectory = path.join(os.tmpdir(), "e-top-messenger-attachments");
/*
=========================================================
CHAT ATTACHMENT UPLOAD

Used only by POST /api/messages/send for the Messenger's
"attach file" / "image" buttons. Kept separate from
middleware/upload.js (product images) because chat
attachments need to accept documents too, not just
images.
=========================================================
*/

const ALLOWED_MIME_TYPES = [

    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",

    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/3gpp",

    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",

    // Voice messages (MediaRecorder output - the exact
    // mime type varies by browser/device: Chrome/Android
    // commonly produce audio/webm, Safari/iOS commonly
    // produces audio/mp4 or audio/aac).
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/aac",
    "audio/3gpp",
    "audio/3gpp2",
    "audio/aiff",
    "audio/flac",
    "audio/m4a",
    "audio/opus",
    "audio/wav",
    "audio/x-aiff",
    "audio/x-caf",
    "audio/x-flac",
    "audio/x-wav",
    "audio/x-m4a",

    // Encrypted Messenger media is uploaded as opaque bytes.
    "application/octet-stream"

];

const fileFilter = (req, file, cb) => {

    const mimeType = String(file.mimetype || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    if (ALLOWED_MIME_TYPES.includes(mimeType)) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Unsupported file type. Allowed: images, audio, PDF, DOC/DOCX, TXT, ZIP."
            ),
            false
        );

    }

};

const hasBytes = (buffer, bytes, offset = 0) =>
    buffer.length >= offset + bytes.length &&
    buffer.subarray(offset, offset + bytes.length).equals(Buffer.from(bytes));

const isIsoMedia = (buffer, brands, totalSize = buffer.length) => {
    if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") {
        return false;
    }
    const boxSize = buffer.readUInt32BE(0);
    if (boxSize < 16 || boxSize > totalSize) return false;
    for (let offset = 8; offset + 4 <= Math.min(boxSize, buffer.length); offset += 4) {
        if (brands.includes(buffer.toString("ascii", offset, offset + 4))) {
            return true;
        }
    }
    return false;
};

const matchesFileContent = (mimeType, buffer, totalSize = buffer.length) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;

    if (mimeType === "application/octet-stream") {
        return true;
    }
    if (mimeType === "image/jpeg") {
        return hasBytes(buffer, [0xff, 0xd8, 0xff]);
    }
    if (mimeType === "image/png") {
        return hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
    if (mimeType === "image/gif") {
        return ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
    }
    if (mimeType === "image/webp") {
        return buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP";
    }
    if (mimeType === "image/heic" || mimeType === "image/heif") {
        return isIsoMedia(
            buffer,
            mimeType === "image/heic"
                ? ["heic", "heix", "hevc", "hevx"]
                : ["mif1", "msf1", "heif", "heim", "heis", "hevm", "hevs"],
            totalSize
        );
    }
    if (mimeType === "application/pdf") {
        return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    }
    if (mimeType === "application/msword") {
        return hasBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    }
    if (
        mimeType === "application/zip" ||
        mimeType === "application/x-zip-compressed" ||
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return buffer.length >= 4 &&
            buffer[0] === 0x50 &&
            buffer[1] === 0x4b &&
            [0x03, 0x05, 0x07].includes(buffer[2]) &&
            [0x04, 0x06, 0x08].includes(buffer[3]);
    }
    if (mimeType === "text/plain") {
        return !buffer.includes(0);
    }
    if (mimeType === "audio/webm") {
        return hasBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
    }
    if (mimeType === "video/webm") {
        return hasBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
    }
    if (mimeType === "audio/ogg" || mimeType === "audio/opus") {
        return buffer.subarray(0, 4).toString("ascii") === "OggS";
    }
    if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") {
        return buffer.subarray(0, 3).toString("ascii") === "ID3" ||
            (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    }
    if (mimeType === "audio/aac") {
        return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0;
    }
    if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
        return buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WAVE";
    }
    if (mimeType === "audio/aiff" || mimeType === "audio/x-aiff") {
        return buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "FORM" &&
            ["AIFF", "AIFC"].includes(buffer.toString("ascii", 8, 12));
    }
    if (mimeType === "audio/x-caf") {
        return buffer.subarray(0, 4).toString("ascii") === "caff";
    }
    if (mimeType === "audio/flac" || mimeType === "audio/x-flac") {
        return buffer.subarray(0, 4).toString("ascii") === "fLaC";
    }
    if (
        mimeType === "audio/mp4" ||
        mimeType === "audio/m4a" ||
        mimeType === "audio/x-m4a" ||
        mimeType === "audio/3gpp" ||
        mimeType === "audio/3gpp2"
    ) {
        return isIsoMedia(buffer, [
            "M4A ", "M4B ", "isom", "iso2", "mp41", "mp42",
            "3gp4", "3gp5", "3g2a", "3g2b"
        ], totalSize);
    }
    if (
        mimeType === "video/mp4" ||
        mimeType === "video/quicktime" ||
        mimeType === "video/3gpp"
    ) {
        return isIsoMedia(
            buffer,
            ["isom", "iso2", "mp41", "mp42", "avc1", "qt  ", "3gp4", "3gp5"],
            totalSize
        );
    }
    return false;
};

const hasNoNullBytes = async filePath => {
    for await (const chunk of fs.createReadStream(filePath)) {
        if (chunk.includes(0)) return false;
    }
    return true;
};

const matchesUploadedFile = async file => {
    if (file.buffer) {
        const mimeType = String(file.mimetype || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
        return matchesFileContent(mimeType, file.buffer, file.size);
    }

    if (!file.path || !file.size) return false;
    const header = Buffer.alloc(Math.min(file.size, 4096));
    const handle = await fs.promises.open(file.path, "r");
    try {
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const prefix = header.subarray(0, bytesRead);
        const mimeType = String(file.mimetype || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
        if (mimeType === "text/plain") {
            return hasNoNullBytes(file.path);
        }
        return matchesFileContent(mimeType, prefix, file.size);
    } finally {
        await handle.close();
    }
};

const validateMessageFileContent = (req, res, next) => {
    const file = req.file;
    if (!file) return next();

    matchesUploadedFile(file).then(matches => {
        if (!matches) {
            return res.status(400).json({
                success: false,
                message: "The uploaded file content does not match its supported file type."
            });
        }
        return next();
    }).catch(next);
};

const upload = multer({

    storage: multer.diskStorage({
        destination: (_req, _file, callback) => {
            fs.mkdir(uploadTempDirectory, { recursive: true }, error =>
                callback(error, uploadTempDirectory)
            );
        },
        filename: (_req, _file, callback) =>
            callback(null, crypto.randomUUID())
    }),

    fileFilter,

    limits: {

        // Encrypted client files gain a 16-byte AES-GCM tag.
        fileSize: MAX_ENCRYPTED_ATTACHMENT_BYTES

    }

});

upload.fileFilter = fileFilter;
upload.validateContent = validateMessageFileContent;
upload.matchesFileContent = matchesFileContent;
upload.maxFileSize = MAX_MESSAGE_ATTACHMENT_BYTES;
upload.tempDirectory = uploadTempDirectory;
upload.cleanup = (req, res, next) => {
    res.once("finish", () => {
        if (!req.file?.path) return;
        fs.promises.unlink(req.file.path).catch(error => {
            if (error.code !== "ENOENT") {
                console.error("MESSENGER TEMP UPLOAD CLEANUP ERROR:", error);
            }
        });
    });
    next();
};

module.exports = upload;
