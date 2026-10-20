const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/*
=========================================================
MEDIA STORAGE

Render's free disk is EPHEMERAL: anything written to
./uploads disappears on every redeploy/restart. For a
social app (posts, reels) that means every photo/video
would vanish. So:

  - If CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
    CLOUDINARY_API_SECRET are set -> files go to
    Cloudinary (permanent, free tier available).
  - Otherwise -> falls back to local ./uploads so the app
    still works in development (files may be lost on
    redeploy in production).
=========================================================
*/

const isCloudinaryConfigured = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

let cloudinary = null;

const getCloudinary = () => {

    if (cloudinary) {
        return cloudinary;
    }

    if (!isCloudinaryConfigured()) {
        return null;
    }

    cloudinary = require("cloudinary").v2;

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });

    return cloudinary;

};

const uploadDir = path.join(__dirname, "..", "uploads");

/*
 * Saves one multer memory file.
 * Returns { url, type, publicId, duration }
 */
const saveFile = async (file, folder = "etop") => {
    const mimeType = String(file.mimetype || "").toLowerCase();
    const type = mimeType.startsWith("image/")
        ? "image"
        : mimeType.startsWith("video/")
            ? "video"
            : mimeType.startsWith("audio/")
                ? "audio"
                : "raw";
    const resourceType =
        type === "audio" ? "video" : type;
    const originalExtension = path.extname(
        path.basename(file.originalname || "")
    ).toLowerCase();
    const safeExtension = /^\.[a-z0-9]{1,10}$/.test(originalExtension)
        ? originalExtension
        : "";

    const cld = getCloudinary();

    if (cld) {
        const publicId =
            crypto.randomUUID() + (type === "raw" ? safeExtension || ".bin" : "");

        const result = await new Promise((resolve, reject) => {

            const stream = cld.uploader.upload_stream(
                {
                    folder,
                    public_id: publicId,
                    resource_type: resourceType
                },
                (error, uploaded) =>
                    error ? reject(error) : resolve(uploaded)
            );

            stream.end(file.buffer);

        });

        return {
            url: result.secure_url,
            type,
            publicId: result.public_id,
            duration: Math.round(result.duration || 0)
        };

    }

    // Local fallback
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext =
        safeExtension ||
        (
            type === "video"
                ? ".mp4"
                : type === "audio"
                    ? ".webm"
                    : type === "raw"
                        ? ".bin"
                        : ".jpg"
        );

    const filename =
        `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

    await fs.promises.writeFile(
        path.join(uploadDir, filename),
        file.buffer
    );

    return {
        url: `/uploads/${filename}`,
        type,
        publicId: "",
        duration: 0
    };

};

const deleteFile = async media => {

    try {

        const cld = getCloudinary();

        if (cld && media?.publicId) {

            const result = await cld.uploader.destroy(
                media.publicId,
                {
                    resource_type:
                        media.type === "video" || media.type === "audio"
                            ? "video"
                            : media.type === "raw"
                                ? "raw"
                                : "image"
                }
            );

            return result?.result === "ok" || result?.result === "not found";

        }

        if (media?.url?.startsWith("/uploads/")) {

            try {
                await fs.promises.unlink(
                    path.join(uploadDir, path.basename(media.url))
                );
            } catch (error) {
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }

            return true;

        }

        return !media?.publicId;

    } catch (error) {

        console.error("DELETE MEDIA ERROR:", error.message);
        return false;

    }

};

module.exports = {
    isCloudinaryConfigured,
    saveFile,
    deleteFile
};
