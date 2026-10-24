const MAX_DIMENSION = 1800;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const luminance = (red, green, blue) =>
    red * 0.299 + green * 0.587 + blue * 0.114;

const createAxisProfile = (imageData, horizontal) => {
    const { data, width, height } = imageData;
    const count = horizontal ? height : width;
    const span = horizontal ? width : height;
    const profile = new Float32Array(count);

    for (let line = 0; line < count; line += 1) {
        let total = 0;
        for (let offset = 0; offset < span; offset += 1) {
            const pixel = horizontal
                ? (line * width + offset) * 4
                : (offset * width + line) * 4;
            total += luminance(data[pixel], data[pixel + 1], data[pixel + 2]);
        }
        profile[line] = total / span;
    }
    return profile;
};

const averageRange = (profile, start, end) => {
    let total = 0;
    for (let index = start; index < end; index += 1) {
        total += profile[index];
    }
    return total / Math.max(1, end - start);
};

const findEdge = (profile, interior, fromEnd) => {
    const count = profile.length;
    const edgeSize = Math.max(2, Math.round(count * 0.025));
    const edge = fromEnd
        ? averageRange(profile, count - edgeSize, count)
        : averageRange(profile, 0, edgeSize);
    const contrast = interior - edge;

    if (Math.abs(contrast) < 28) return fromEnd ? count : 0;

    const windowSize = Math.max(3, Math.round(count * 0.012));
    const threshold = edge + contrast * 0.55;
    const start = fromEnd ? count - windowSize : 0;
    const limit = fromEnd ? -1 : count - windowSize + 1;
    const step = fromEnd ? -1 : 1;

    for (let index = start; index !== limit; index += step) {
        const mean = averageRange(profile, index, index + windowSize);
        if ((mean - threshold) * contrast >= 0) {
            return fromEnd ? index + windowSize : index;
        }
    }
    return fromEnd ? count : 0;
};

const detectAxisBounds = profile => {
    const centerStart = Math.floor(profile.length * 0.3);
    const centerEnd = Math.ceil(profile.length * 0.7);
    const interior = averageRange(profile, centerStart, centerEnd);
    const start = findEdge(profile, interior, false);
    const end = findEdge(profile, interior, true);
    const padding = Math.round(profile.length * 0.015);
    const paddedStart = Math.max(0, start - padding);
    const paddedEnd = Math.min(profile.length, end + padding);

    if (paddedEnd - paddedStart < profile.length * 0.6) {
        return [0, profile.length];
    }
    return [paddedStart, paddedEnd];
};

export const detectDocumentCrop = imageData => {
    const { width, height } = imageData;
    const [left, right] = detectAxisBounds(createAxisProfile(imageData, false));
    const [top, bottom] = detectAxisBounds(createAxisProfile(imageData, true));
    const cropWidth = right - left;
    const cropHeight = bottom - top;

    if (
        cropWidth < width * 0.6 ||
        cropHeight < height * 0.6
    ) {
        return { x: 0, y: 0, width, height };
    }
    return { x: left, y: top, width: cropWidth, height: cropHeight };
};

export const enhanceDocumentPixels = imageData => {
    const { data, width, height } = imageData;
    const histogram = new Uint32Array(256);
    const luminances = new Uint8Array(width * height);

    for (let pixel = 0; pixel < luminances.length; pixel += 1) {
        const offset = pixel * 4;
        const value = Math.round(luminance(data[offset], data[offset + 1], data[offset + 2]));
        luminances[pixel] = value;
        histogram[value] += 1;
    }

    const lowTarget = Math.floor(luminances.length * 0.02);
    const highTarget = Math.ceil(luminances.length * 0.98);
    let cumulative = 0;
    let low = 0;
    let high = 255;
    for (let value = 0; value < 256; value += 1) {
        cumulative += histogram[value];
        if (cumulative >= lowTarget) {
            low = value;
            break;
        }
    }
    cumulative = 0;
    for (let value = 0; value < 256; value += 1) {
        cumulative += histogram[value];
        if (cumulative >= highTarget) {
            high = value;
            break;
        }
    }

    const contrastRange = Math.max(48, high - low);
    const stretched = luminances.map(value =>
        Math.max(0, Math.min(255, ((value - low) * 255) / contrastRange))
    );

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            let neighborhood = 0;
            let samples = 0;
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const sampleX = Math.max(0, Math.min(width - 1, x + offsetX));
                    const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));
                    neighborhood += stretched[sampleY * width + sampleX];
                    samples += 1;
                }
            }
            const sharpened = Math.max(
                0,
                Math.min(255, stretched[index] + (stretched[index] - neighborhood / samples) * 0.35)
            );
            const value = Math.round(sharpened);
            const pixel = index * 4;
            data[pixel] = value;
            data[pixel + 1] = value;
            data[pixel + 2] = value;
        }
    }
    return imageData;
};

const loadImage = file => new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The image could not be opened for scanning."));
    };
    image.src = url;
});

export const processDocumentImage = async (file, mode = "enhanced") => {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("This browser could not prepare the scanned image.");
    sourceContext.drawImage(image, 0, 0, width, height);

    const crop = detectDocumentCrop(sourceContext.getImageData(0, 0, width, height));
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser could not prepare the scanned image.");
    context.drawImage(
        sourceCanvas,
        crop.x, crop.y, crop.width, crop.height,
        0, 0, crop.width, crop.height
    );

    if (mode === "enhanced") {
        const pixels = context.getImageData(0, 0, crop.width, crop.height);
        context.putImageData(enhanceDocumentPixels(pixels), 0, 0);
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("The scanned image could not be prepared. Please try again.");
    if (blob.size > MAX_FILE_SIZE) {
        throw new Error("The scanned image is too large to send (10MB maximum).");
    }
    return new File([blob], `messenger-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
};
