const multer = require("multer");

/*
 * Memory storage: files are streamed to Cloudinary (or
 * written to disk by services/mediaStorage.js), never left
 * behind in a temp folder.
 */

const IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif"
];

const VIDEO_TYPES = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
    "video/3gpp"
];

const makeUploader = ({ allowed, maxSize, maxFiles }) =>
    multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSize, files: maxFiles },
        fileFilter: (req, file, cb) => {

            if (allowed.includes(file.mimetype)) {
                return cb(null, true);
            }

            cb(new Error("This file type isn't supported."), false);

        }
    });

// Home feed: up to 5 photos, 10MB each
exports.postUpload = makeUploader({
    allowed: IMAGE_TYPES,
    maxSize: 10 * 1024 * 1024,
    maxFiles: 5
});

// Reels: one video, 80MB max (a 60s phone video is usually 10-50MB)
exports.reelUpload = makeUploader({
    allowed: VIDEO_TYPES,
    maxSize: 80 * 1024 * 1024,
    maxFiles: 1
});

// Wraps an uploader so ANY multer error becomes a clean JSON 400
exports.handle = (uploader, field) => (req, res, next) => {

    uploader.array(field, 5)(req, res, error => {

        if (!error) {
            return next();
        }

        const message =
            error.code === "LIMIT_FILE_SIZE"
                ? "File is too large."
                : error.code === "LIMIT_FILE_COUNT" ||
                  error.code === "LIMIT_UNEXPECTED_FILE"
                    ? "Too many files."
                    : error.message || "Upload failed.";

        return res.status(400).json({ success: false, message });

    });

};
