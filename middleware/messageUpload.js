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

    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed"

];

const fileFilter = (req, file, cb) => {

    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Unsupported file type. Allowed: images, PDF, DOC/DOCX, TXT, ZIP."
            ),
            false
        );

    }

};

module.exports = multer({

    storage,

    fileFilter,

    limits: {

        // Matches the 10MB limit already enforced
        // client-side in Messenger.jsx's handleFile.
        fileSize: 10 * 1024 * 1024

    }

});
