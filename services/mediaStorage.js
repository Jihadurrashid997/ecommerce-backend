const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");

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
 * Saves one multer file from a buffer or temporary disk path.
 * Returns { url, type, publicId, deliveryType, duration }
 */
const saveFile = async (
    file,
    folder = "etop",
    { deliveryType = "upload" } = {}
) => {
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
    const fileSize = file.size ?? file.buffer?.length ?? 0;
    const createInputStream = () =>
        file.path
            ? fs.createReadStream(file.path)
            : Readable.from([file.buffer]);

    if (cld) {
        const publicId =
            crypto.randomUUID() + (type === "raw" ? safeExtension || ".bin" : "");

        const result = await new Promise((resolve, reject) => {
            const options = {
                folder,
                public_id: publicId,
                resource_type: resourceType,
                type: deliveryType
            };
            const callback = (error, uploaded) =>
                error ? reject(error) : resolve(uploaded);
            const uploadStream = fileSize > 20 * 1024 * 1024
                ? cld.uploader.upload_chunked_stream(
                    { ...options, chunk_size: 20 * 1024 * 1024 },
                    callback
                )
                : cld.uploader.upload_stream(options, callback);
            const inputStream = createInputStream();

            inputStream.once("error", error => {
                uploadStream.destroy(error);
                reject(error);
            });
            uploadStream.once("error", reject);
            inputStream.pipe(uploadStream);
        });

        return {
            url: result.secure_url,
            type,
            publicId: result.public_id,
            deliveryType,
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

    const destination = path.join(uploadDir, filename);
    if (file.path) {
        await fs.promises.copyFile(file.path, destination);
    } else if (file.buffer) {
        await fs.promises.writeFile(destination, file.buffer);
    } else {
        throw new Error("Uploaded media has no readable file content.");
    }

    return {
        url: `/uploads/${filename}`,
        type,
        publicId: "",
        deliveryType: "upload",
        duration: 0
    };

};

const getPrivateDownloadUrl = (
    publicId,
    fileName,
    {
        mediaType = "",
        mimeType = "",
        deliveryType = "upload",
        attachment = false
    } = {}
) => {
    const cld = getCloudinary();
    if (!cld || !publicId) {
        throw new Error("Cloudinary is not configured for this attachment.");
    }

    const normalizedMimeType = String(mimeType || "").toLowerCase();
    const extensionByMimeType = {
        "application/pdf": "pdf",
        "application/octet-stream": "bin",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/webm": "webm"
    };
    const extension =
        path.extname(path.basename(fileName || "")).slice(1).toLowerCase() ||
        extensionByMimeType[normalizedMimeType] ||
        "";
    if (!/^[a-z0-9]{1,10}$/.test(extension)) {
        throw new Error("The attachment does not have a supported file extension.");
    }

    const normalizedPublicId = publicId.replace(/\.[a-z0-9]{1,10}$/i, "");
    const resourceType =
        mediaType === "video" || mediaType === "audio"
            ? "video"
            : mediaType === "raw"
                ? "raw"
                : mediaType === "image"
                    ? "image"
                    : normalizedMimeType.startsWith("video/")
                        ? "video"
                        : normalizedMimeType.startsWith("audio/")
                            ? "video"
                            : normalizedMimeType === "application/pdf" ||
                                normalizedMimeType === "application/octet-stream"
                                ? "raw"
                                : "image";
    const allowedDeliveryTypes = new Set([
        "upload",
        "private",
        "authenticated"
    ]);
    return cld.utils.private_download_url(
        normalizedPublicId,
        extension,
        {
            resource_type: resourceType,
            type: allowedDeliveryTypes.has(deliveryType)
                ? deliveryType
                : "upload",
            attachment,
            expires_at: Math.floor(Date.now() / 1000) + 5 * 60
        }
    );
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
    getPrivateDownloadUrl,
    deleteFile
};
