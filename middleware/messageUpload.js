const multer = require("multer");
const path = require("path");

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

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, "uploads/");

    },

    filename: (req, file, cb) => {

        cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
        );

    }

});

const ALLOWED_MIME_TYPES = [

    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",

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

const upload = multer({

    storage,

    fileFilter,

    limits: {

        // A 10MB client file gains a 16-byte AES-GCM tag.
        fileSize: 10 * 1024 * 1024 + 16

    }

});

upload.fileFilter = fileFilter;

module.exports = upload;
