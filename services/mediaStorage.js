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

    const type =
        file.mimetype.startsWith("video/")
            ? "video"
            : "image";

    const cld = getCloudinary();

    if (cld) {

        const result = await new Promise((resolve, reject) => {

            const stream = cld.uploader.upload_stream(
                {
                    folder,
                    resource_type: type === "video" ? "video" : "image"
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
        path.extname(file.originalname) ||
        (type === "video" ? ".mp4" : ".jpg");

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

            await cld.uploader.destroy(
                media.publicId,
                { resource_type: media.type === "video" ? "video" : "image" }
            );

            return;

        }

        if (media?.url?.startsWith("/uploads/")) {

            await fs.promises.unlink(
                path.join(uploadDir, path.basename(media.url))
            );

        }

    } catch (error) {

        console.error("DELETE MEDIA ERROR:", error.message);

    }

};

module.exports = {
    isCloudinaryConfigured,
    saveFile,
    deleteFile
};
