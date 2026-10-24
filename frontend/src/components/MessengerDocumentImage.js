const MAX_DIMENSION = 1800;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const luminance = (red, green, blue) =>
    red * 0.299 + green * 0.587 + blue * 0.114;

const calculateOtsuThreshold = histogram => {
    const total = histogram.reduce((sum, count) => sum + count, 0);
    let weightedTotal = 0;
    for (let value = 0; value < histogram.length; value += 1) {
        weightedTotal += value * histogram[value];
    }

    let backgroundWeight = 0;
    let backgroundTotal = 0;
    let maximumVariance = 0;
    let threshold = -1;
    for (let value = 0; value < histogram.length; value += 1) {
        backgroundWeight += histogram[value];
        if (backgroundWeight === 0) continue;
        const foregroundWeight = total - backgroundWeight;
        if (foregroundWeight === 0) break;
        backgroundTotal += value * histogram[value];
        const backgroundMean = backgroundTotal / backgroundWeight;
        const foregroundMean = (weightedTotal - backgroundTotal) / foregroundWeight;
        const variance =
            backgroundWeight * foregroundWeight *
            (backgroundMean - foregroundMean) ** 2;
        if (variance > maximumVariance) {
            maximumVariance = variance;
            threshold = value;
        }
    }
    return threshold;
};

const averageLuminance = (imageData, xStart, yStart, xEnd, yEnd) => {
    const { data, width } = imageData;
    let total = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y += 1) {
        for (let x = xStart; x < xEnd; x += 1) {
            const offset = (y * width + x) * 4;
            total += luminance(data[offset], data[offset + 1], data[offset + 2]);
            count += 1;
        }
    }
    return total / Math.max(1, count);
};

const crossProduct = (origin, first, second) =>
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x);

const convexHull = points => {
    if (points.length < 4) return points;
    points.sort((first, second) =>
        first.x === second.x ? first.y - second.y : first.x - second.x
    );
    const lower = [];
    for (const point of points) {
        while (
            lower.length >= 2 &&
            crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
        ) {
            lower.pop();
        }
        lower.push(point);
    }
    const upper = [];
    for (let index = points.length - 1; index >= 0; index -= 1) {
        const point = points[index];
        while (
            upper.length >= 2 &&
            crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
        ) {
            upper.pop();
        }
        upper.push(point);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
};

const largestComponent = (mask, width, height) => {
    const visited = new Uint8Array(mask.length);
    const queue = new Int32Array(mask.length);
    let largest = null;
    for (let index = 0; index < mask.length; index += 1) {
        if (!mask[index] || visited[index]) continue;
        let head = 0;
        let tail = 0;
        queue[tail++] = index;
        visited[index] = 1;
        const component = [];
        while (head < tail) {
            const current = queue[head++];
            component.push(current);
            const x = current % width;
            const neighbors = [
                x > 0 ? current - 1 : -1,
                x + 1 < width ? current + 1 : -1,
                current >= width ? current - width : -1,
                current + width < width * height ? current + width : -1
            ];
            for (const neighbor of neighbors) {
                if (neighbor >= 0 && mask[neighbor] && !visited[neighbor]) {
                    visited[neighbor] = 1;
                    queue[tail++] = neighbor;
                }
            }
        }
        if (!largest || component.length > largest.length) largest = component;
    }
    return largest || [];
};

const orderCorners = points => {
    const topLeft = points.reduce((best, point) =>
        point.x + point.y < best.x + best.y ? point : best
    );
    const topRight = points.reduce((best, point) =>
        point.x - point.y > best.x - best.y ? point : best
    );
    const bottomRight = points.reduce((best, point) =>
        point.x + point.y > best.x + best.y ? point : best
    );
    const bottomLeft = points.reduce((best, point) =>
        point.x - point.y < best.x - best.y ? point : best
    );
    if (new Set([topLeft, topRight, bottomRight, bottomLeft]).size !== 4) return null;
    return [topLeft, topRight, bottomRight, bottomLeft];
};

export const detectDocumentCorners = imageData => {
    const { data, width, height } = imageData;
    const identityCorners = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: width - 1, y: height - 1 },
        { x: 0, y: height - 1 }
    ];
    const histogram = new Uint32Array(256);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
        const offset = pixel * 4;
        histogram[Math.round(luminance(data[offset], data[offset + 1], data[offset + 2]))] += 1;
    }
    const threshold = calculateOtsuThreshold(histogram);
    if (threshold < 0) return identityCorners;

    const cornerSize = Math.max(2, Math.round(Math.min(width, height) * 0.04));
    const cornerLightness = (
        averageLuminance(imageData, 0, 0, cornerSize, cornerSize) +
        averageLuminance(imageData, width - cornerSize, 0, width, cornerSize) +
        averageLuminance(imageData, 0, height - cornerSize, cornerSize, height) +
        averageLuminance(imageData, width - cornerSize, height - cornerSize, width, height)
    ) / 4;
    const centerLightness = averageLuminance(
        imageData,
        Math.floor(width * 0.4),
        Math.floor(height * 0.4),
        Math.ceil(width * 0.6),
        Math.ceil(height * 0.6)
    );
    const separation = centerLightness - cornerLightness;
    if (Math.abs(separation) < 28) return identityCorners;
    const cutoff = Math.max(0, Math.min(255, (centerLightness + cornerLightness) / 2));
    const mask = new Uint8Array(width * height);
    for (let pixel = 0; pixel < mask.length; pixel += 1) {
        const offset = pixel * 4;
        const value = luminance(data[offset], data[offset + 1], data[offset + 2]);
        mask[pixel] = separation > 0 ? value >= cutoff : value <= cutoff ? 1 : 0;
    }

    const component = largestComponent(mask, width, height);
    if (component.length < width * height * 0.3 || component.length > width * height * 0.98) {
        return identityCorners;
    }
    const foreground = new Uint8Array(mask.length);
    component.forEach(index => {
        foreground[index] = 1;
    });
    const boundary = [];
    for (const index of component) {
        const x = index % width;
        const y = Math.floor(index / width);
        if (
            x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
            !foreground[index - 1] || !foreground[index + 1] ||
            !foreground[index - width] || !foreground[index + width]
        ) {
            boundary.push({ x, y });
        }
    }
    const hull = convexHull(boundary);
    if (hull.length < 4) return identityCorners;
    const corners = orderCorners(hull);
    if (!corners) return identityCorners;

    const [topLeft, topRight, bottomRight, bottomLeft] = corners;
    const polygonArea = Math.abs(
        topLeft.x * topRight.y - topRight.x * topLeft.y +
        topRight.x * bottomRight.y - bottomRight.x * topRight.y +
        bottomRight.x * bottomLeft.y - bottomLeft.x * bottomRight.y +
        bottomLeft.x * topLeft.y - topLeft.x * bottomLeft.y
    ) / 2;
    if (polygonArea < width * height * 0.3) return identityCorners;
    return corners;
};

const solveLinearSystem = (matrix, values) => {
    const size = values.length;
    const rows = matrix.map((row, index) => [...row, values[index]]);
    for (let column = 0; column < size; column += 1) {
        let pivot = column;
        for (let row = column + 1; row < size; row += 1) {
            if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
        }
        if (Math.abs(rows[pivot][column]) < 1e-10) return null;
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let cell = column; cell <= size; cell += 1) rows[column][cell] /= divisor;
        for (let row = 0; row < size; row += 1) {
            if (row === column) continue;
            const factor = rows[row][column];
            for (let cell = column; cell <= size; cell += 1) {
                rows[row][cell] -= factor * rows[column][cell];
            }
        }
    }
    return rows.map(row => row[size]);
};

const createPerspectiveTransform = (corners, outputWidth, outputHeight) => {
    const destination = [
        [0, 0],
        [outputWidth - 1, 0],
        [outputWidth - 1, outputHeight - 1],
        [0, outputHeight - 1]
    ];
    const matrix = [];
    const values = [];
    corners.forEach((point, index) => {
        const [x, y] = destination[index];
        matrix.push([x, y, 1, 0, 0, 0, -point.x * x, -point.x * y]);
        values.push(point.x);
        matrix.push([0, 0, 0, x, y, 1, -point.y * x, -point.y * y]);
        values.push(point.y);
    });
    const coefficients = solveLinearSystem(matrix, values);
    return coefficients && [...coefficients, 1];
};

export const warpDocumentPerspective = (imageData, corners) => {
    const [topLeft, topRight, bottomRight, bottomLeft] = corners;
    const length = (first, second) =>
        Math.hypot(second.x - first.x, second.y - first.y);
    const width = Math.max(length(topLeft, topRight), length(bottomLeft, bottomRight));
    const height = Math.max(length(topLeft, bottomLeft), length(topRight, bottomRight));
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const transform = createPerspectiveTransform(corners, outputWidth, outputHeight);
    if (!transform) {
        return { imageData, corners: [
            { x: 0, y: 0 },
            { x: imageData.width - 1, y: 0 },
            { x: imageData.width - 1, y: imageData.height - 1 },
            { x: 0, y: imageData.height - 1 }
        ] };
    }

    const output = new ImageData(outputWidth, outputHeight);
    const [a, b, c, d, e, f, g, h, i] = transform;
    const { width: sourceWidth, height: sourceHeight, data: source } = imageData;
    for (let y = 0; y < outputHeight; y += 1) {
        for (let x = 0; x < outputWidth; x += 1) {
            const denominator = g * x + h * y + i;
            const sourceX = (a * x + b * y + c) / denominator;
            const sourceY = (d * x + e * y + f) / denominator;
            const left = Math.max(0, Math.min(sourceWidth - 1, Math.floor(sourceX)));
            const top = Math.max(0, Math.min(sourceHeight - 1, Math.floor(sourceY)));
            const right = Math.min(sourceWidth - 1, left + 1);
            const bottom = Math.min(sourceHeight - 1, top + 1);
            const mixX = Math.max(0, Math.min(1, sourceX - left));
            const mixY = Math.max(0, Math.min(1, sourceY - top));
            const destination = (y * outputWidth + x) * 4;
            for (let channel = 0; channel < 4; channel += 1) {
                const topLeftValue = source[(top * sourceWidth + left) * 4 + channel];
                const topRightValue = source[(top * sourceWidth + right) * 4 + channel];
                const bottomLeftValue = source[(bottom * sourceWidth + left) * 4 + channel];
                const bottomRightValue = source[(bottom * sourceWidth + right) * 4 + channel];
                const topValue = topLeftValue + (topRightValue - topLeftValue) * mixX;
                const bottomValue = bottomLeftValue + (bottomRightValue - bottomLeftValue) * mixX;
                output.data[destination + channel] =
                    topValue + (bottomValue - topValue) * mixY;
            }
        }
    }
    return {
        imageData: output,
        corners: [
            { x: 0, y: 0 },
            { x: outputWidth - 1, y: 0 },
            { x: outputWidth - 1, y: outputHeight - 1 },
            { x: 0, y: outputHeight - 1 }
        ]
    };
};

export const detectDocumentCrop = imageData => {
    const corners = detectDocumentCorners(imageData);
    const x = Math.min(...corners.map(point => point.x));
    const y = Math.min(...corners.map(point => point.y));
    const right = Math.max(...corners.map(point => point.x));
    const bottom = Math.max(...corners.map(point => point.y));
    return { x, y, width: right - x + 1, height: bottom - y + 1 };
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

    const detectionScale = Math.min(1, 480 / Math.max(width, height));
    const detectionWidth = Math.max(1, Math.round(width * detectionScale));
    const detectionHeight = Math.max(1, Math.round(height * detectionScale));
    const detectionCanvas = document.createElement("canvas");
    detectionCanvas.width = detectionWidth;
    detectionCanvas.height = detectionHeight;
    const detectionContext = detectionCanvas.getContext("2d", { willReadFrequently: true });
    if (!detectionContext) throw new Error("This browser could not detect the document page.");
    detectionContext.drawImage(sourceCanvas, 0, 0, detectionWidth, detectionHeight);
    const detectedCorners = detectDocumentCorners(
        detectionContext.getImageData(0, 0, detectionWidth, detectionHeight)
    );
    const corners = detectedCorners.map(point => ({
        x: Math.max(0, Math.min(width - 1, point.x / detectionScale)),
        y: Math.max(0, Math.min(height - 1, point.y / detectionScale))
    }));
    const warped = warpDocumentPerspective(
        sourceContext.getImageData(0, 0, width, height),
        corners
    );
    const canvas = document.createElement("canvas");
    canvas.width = warped.imageData.width;
    canvas.height = warped.imageData.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser could not prepare the scanned image.");
    context.putImageData(warped.imageData, 0, 0);

    if (mode === "enhanced") {
        const pixels = context.getImageData(0, 0, warped.imageData.width, warped.imageData.height);
        context.putImageData(enhanceDocumentPixels(pixels), 0, 0);
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("The scanned image could not be prepared. Please try again.");
    if (blob.size > MAX_FILE_SIZE) {
        throw new Error("The scanned image is too large to send (10MB maximum).");
    }
    return new File([blob], `messenger-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
};
