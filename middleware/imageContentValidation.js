const SIGNATURES = [
    { mime: "image/jpeg", matches: buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    { mime: "image/png", matches: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { mime: "image/gif", matches: buffer => buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)) },
    { mime: "image/webp", matches: buffer => buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" },
    {
        mime: "image/heic",
        matches: buffer => isIsoImage(buffer, ["heic", "heix", "hevc", "hevx"])
    },
    {
        mime: "image/heif",
        matches: buffer => isIsoImage(buffer, ["mif1", "msf1", "heif", "heim", "heis", "hevm", "hevs"])
    }
];

const isIsoImage = (buffer, brands) => {
    if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
    const boxSize = buffer.readUInt32BE(0);
    if (boxSize < 16 || boxSize > buffer.length) return false;
    for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
        if (brands.includes(buffer.toString("ascii", offset, offset + 4))) return true;
    }
    return false;
};

const matchesAllowedImageContent = file => {
    if (!Buffer.isBuffer(file?.buffer)) return false;
    return SIGNATURES.some(signature =>
        signature.mime === file.mimetype && signature.matches(file.buffer)
    );
};

const validateHomeImageContent = (req, res, next) => {
    const files = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files || {}).flat();
    if (req.file) files.push(req.file);
    const images = files.filter(file => file.mimetype?.startsWith("image/"));
    if (images.some(file => !matchesAllowedImageContent(file))) {
        return res.status(400).json({
            success: false,
            message: "The uploaded file content must match a supported image type."
        });
    }
    return next();
};

const AUDIO_SIGNATURES = [
    { mime: "audio/mpeg", matches: buffer =>
        buffer.length >= 3 && (
            buffer.toString("ascii", 0, 3) === "ID3" ||
            (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
        )
    },
    { mime: "audio/mp4", matches: buffer =>
        buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp"
    },
    { mime: "audio/aac", matches: buffer =>
        buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0
    },
    { mime: "audio/wav", matches: buffer =>
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WAVE"
    },
    { mime: "audio/ogg", matches: buffer =>
        buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "OggS"
    },
    { mime: "audio/webm", matches: buffer =>
        buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    }
];

const validateUploadedAudioContent = (req, res, next) => {
    const audio = req.files?.audio?.[0];
    if (audio && (!Buffer.isBuffer(audio.buffer) || !AUDIO_SIGNATURES.some(signature =>
        signature.mime === audio.mimetype && signature.matches(audio.buffer)
    ))) {
        return res.status(400).json({
            success: false,
            message: "The uploaded file content must match a supported audio type."
        });
    }
    return next();
};

module.exports = {
    matchesAllowedImageContent,
    validateHomeImageContent,
    validateUploadedAudioContent
};
