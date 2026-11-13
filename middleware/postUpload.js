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
const STORY_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
const AUDIO_TYPES = [
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/wav",
    "audio/ogg",
    "audio/webm"
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

// Reels: one video, 80MB max for five-minute uploads.
exports.reelUpload = makeUploader({
    allowed: VIDEO_TYPES,
    maxSize: 80 * 1024 * 1024,
    maxFiles: 1
});

// Profile photos are single image uploads, limited to the same size as a post photo.
exports.profileUpload = makeUploader({
    allowed: IMAGE_TYPES,
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1
});

exports.storyUpload = makeUploader({
    allowed: STORY_TYPES,
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1
});

exports.homeStoryUpload = makeUploader({
    allowed: IMAGE_TYPES,
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1
});

const makeFieldsUploader = ({ allowed, maxSize, maxFiles, fields }) =>
    multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSize, files: maxFiles },
        fileFilter: (req, file, cb) => {
            if (allowed.includes(file.mimetype)) return cb(null, true);
            cb(new Error("This file type isn't supported."), false);
        }
    }).fields(fields);

exports.postAudioUpload = makeFieldsUploader({
    allowed: [...IMAGE_TYPES, ...AUDIO_TYPES],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 6,
    fields: [{ name: "photos", maxCount: 5 }, { name: "audio", maxCount: 1 }]
});

exports.homeStoryAudioUpload = makeFieldsUploader({
    allowed: [...IMAGE_TYPES, ...AUDIO_TYPES],
    maxSize: 20 * 1024 * 1024,
    maxFiles: 2,
    fields: [{ name: "media", maxCount: 1 }, { name: "audio", maxCount: 1 }]
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

exports.handleSingle = (uploader, field) => (req, res, next) => {
    uploader.single(field)(req, res, error => {
        if (!error) {
            return next();
        }

        const message =
            error.code === "LIMIT_FILE_SIZE"
                ? "File is too large."
                : error.message || "Upload failed.";

        return res.status(400).json({ success: false, message });
    });
};

exports.handleFields = uploader => (req, res, next) => {
    uploader(req, res, error => {
        if (!error) return next();
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
