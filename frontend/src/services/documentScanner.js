const MAX_SOURCE_DIMENSION = 2200;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_SCANNED_PDF_BYTES = 500 * 1024 * 1024;
const PDF_PAGE_SIZE = { width: 595.28, height: 841.89 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const getDefaultDocumentCorners = () => [
    { x: 0.035, y: 0.035 },
    { x: 0.965, y: 0.035 },
    { x: 0.965, y: 0.965 },
    { x: 0.035, y: 0.965 }
];

export const analyzeDocumentImage = imageData => {
    const { data, width, height } = imageData;
    const pixelCount = width * height;
    let totalBrightness = 0;
    let clippedHighlights = 0;
    let laplacianTotal = 0;
    let laplacianSquaredTotal = 0;
    let focusSamples = 0;
    const brightnessAt = (x, y) => {
        const index = (y * width + x) * 4;
        return (
            0.299 * data[index] +
            0.587 * data[index + 1] +
            0.114 * data[index + 2]
        );
    };

    for (let index = 0; index < data.length; index += 4) {
        const brightness =
            0.299 * data[index] +
            0.587 * data[index + 1] +
            0.114 * data[index + 2];
        totalBrightness += brightness;
        if (brightness >= 250) clippedHighlights += 1;
    }

    for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
            const center = brightnessAt(x, y);
            const laplacian =
                brightnessAt(x - 1, y) +
                brightnessAt(x + 1, y) +
                brightnessAt(x, y - 1) +
                brightnessAt(x, y + 1) -
                4 * center;
            laplacianTotal += laplacian;
            laplacianSquaredTotal += laplacian * laplacian;
            focusSamples += 1;
        }
    }

    const meanLaplacian = laplacianTotal / Math.max(focusSamples, 1);
    const focusVariance =
        laplacianSquaredTotal / Math.max(focusSamples, 1) -
        meanLaplacian * meanLaplacian;
    const averageBrightness = totalBrightness / Math.max(pixelCount, 1);
    const highlightRatio = clippedHighlights / Math.max(pixelCount, 1);
    const warnings = [];
    if (averageBrightness < 55) warnings.push("The photo is too dark.");
    if (averageBrightness > 220) warnings.push("The photo may be overexposed.");
    if (focusVariance < 70) warnings.push("The photo looks blurry; hold the camera steady and retake it.");
    if (highlightRatio > 0.2) warnings.push("Clipped highlights may obscure some text.");

    return {
        averageBrightness,
        focusVariance,
        highlightRatio,
        warnings
    };
};

const polygonArea = points => {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
};

export const detectDocumentCorners = imageData => {
    const { data, width, height } = imageData;
    const points = [];
    let edgeCount = 0;

    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            const gray = (px, py) => {
                const index = (py * width + px) * 4;
                return (
                    0.299 * data[index] +
                    0.587 * data[index + 1] +
                    0.114 * data[index + 2]
                );
            };
            const gx =
                -gray(x - 1, y - 1) + gray(x + 1, y - 1) -
                2 * gray(x - 1, y) + 2 * gray(x + 1, y) -
                gray(x - 1, y + 1) + gray(x + 1, y + 1);
            const gy =
                -gray(x - 1, y - 1) - 2 * gray(x, y - 1) -
                gray(x + 1, y - 1) + gray(x - 1, y + 1) +
                2 * gray(x, y + 1) + gray(x + 1, y + 1);
            if (Math.hypot(gx, gy) < 70) continue;

            edgeCount += 1;
            points.push({ x, y, sum: x + y, difference: x - y });
        }
    }

    if (edgeCount < width * height * 0.001) {
        return getDefaultDocumentCorners();
    }

    const by = (key, direction) =>
        [...points].sort((a, b) => direction * (a[key] - b[key]))
            .slice(0, Math.max(Math.ceil(points.length * 0.02), 1));
    const averagePoint = candidates => candidates.reduce(
        (result, point) => ({
            x: result.x + point.x / candidates.length,
            y: result.y + point.y / candidates.length
        }),
        { x: 0, y: 0 }
    );
    const corners = [
        averagePoint(by("sum", 1)),
        averagePoint(by("difference", -1)),
        averagePoint(by("sum", -1)),
        averagePoint(by("difference", 1))
    ].map(point => ({
        x: clamp(point.x / width, 0.01, 0.99),
        y: clamp(point.y / height, 0.01, 0.99)
    }));

    if (polygonArea(corners) < 0.15) {
        return getDefaultDocumentCorners();
    }
    return corners;
};

const solveLinearSystem = (matrix, values) => {
    const size = values.length;
    const rows = matrix.map((row, index) => [...row, values[index]]);

    for (let column = 0; column < size; column += 1) {
        let pivot = column;
        for (let row = column + 1; row < size; row += 1) {
            if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
                pivot = row;
            }
        }
        if (Math.abs(rows[pivot][column]) < 1e-10) {
            throw new Error("The document corners overlap; adjust them and try again.");
        }
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let cell = column; cell <= size; cell += 1) {
            rows[column][cell] /= divisor;
        }
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

const calculateHomography = (sourceCorners, width, height) => {
    const destinationCorners = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: width - 1, y: height - 1 },
        { x: 0, y: height - 1 }
    ];
    const matrix = [];
    const values = [];

    destinationCorners.forEach((destination, index) => {
        const source = sourceCorners[index];
        matrix.push([
            destination.x, destination.y, 1, 0, 0, 0,
            -source.x * destination.x, -source.x * destination.y
        ]);
        values.push(source.x);
        matrix.push([
            0, 0, 0, destination.x, destination.y, 1,
            -source.y * destination.x, -source.y * destination.y
        ]);
        values.push(source.y);
    });

    return solveLinearSystem(matrix, values);
};

const applyFilter = (imageData, filter) => {
    const { data, width, height } = imageData;
    if (filter === "original") return imageData;

    if (filter === "grayscale") {
        for (let index = 0; index < data.length; index += 4) {
            const value =
                0.299 * data[index] +
                0.587 * data[index + 1] +
                0.114 * data[index + 2];
            data[index] = value;
            data[index + 1] = value;
            data[index + 2] = value;
        }
        return imageData;
    }

    if (filter === "enhanced") {
        for (let index = 0; index < data.length; index += 4) {
            data[index] = clamp(data[index] * 1.08 + 4, 0, 255);
            data[index + 1] = clamp(data[index + 1] * 1.08 + 4, 0, 255);
            data[index + 2] = clamp(data[index + 2] * 1.08 + 4, 0, 255);
        }
        return imageData;
    }

    const integralWidth = width + 1;
    const integral = new Float64Array(integralWidth * (height + 1));
    for (let y = 1; y <= height; y += 1) {
        let rowTotal = 0;
        for (let x = 1; x <= width; x += 1) {
            const index = ((y - 1) * width + (x - 1)) * 4;
            const brightness =
                0.299 * data[index] +
                0.587 * data[index + 1] +
                0.114 * data[index + 2];
            rowTotal += brightness;
            integral[y * integralWidth + x] =
                integral[(y - 1) * integralWidth + x] + rowTotal;
        }
    }

    const radius = 15;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const left = Math.max(x - radius, 0);
            const right = Math.min(x + radius, width - 1);
            const top = Math.max(y - radius, 0);
            const bottom = Math.min(y + radius, height - 1);
            const area = (right - left + 1) * (bottom - top + 1);
            const localTotal =
                integral[(bottom + 1) * integralWidth + right + 1] -
                integral[top * integralWidth + right + 1] -
                integral[(bottom + 1) * integralWidth + left] +
                integral[top * integralWidth + left];
            const threshold = localTotal / area - 12;
            const index = (y * width + x) * 4;
            const brightness =
                0.299 * data[index] +
                0.587 * data[index + 1] +
                0.114 * data[index + 2];
            const value = brightness > threshold ? 255 : 0;
            data[index] = value;
            data[index + 1] = value;
            data[index + 2] = value;
        }
    }
    return imageData;
};

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode the scanned image."));
    }, type, quality);
});

const loadImageForPdf = file => new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("A scanned page could not be opened while creating the PDF."));
    };
    image.src = objectUrl;
});

const optimizePdfPage = async (file, maxBytes) => {
    const { image, objectUrl } = await loadImageForPdf(file);
    try {
        for (const maxDimension of [1800, 1500, 1200, 1000]) {
            const scale = Math.min(
                1,
                maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
            );
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

            for (const quality of [0.82, 0.7, 0.58, 0.48]) {
                const blob = await canvasToBlob(canvas, "image/jpeg", quality);
                if (blob.size <= maxBytes) {
                    return new Uint8Array(await blob.arrayBuffer());
                }
            }
        }
        throw new Error(
            "The PDF is too large to send. Remove some pages or use a smaller scan."
        );
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export const createScannedPdf = async pages => {
    if (!Array.isArray(pages) || pages.length === 0) {
        throw new Error("Scan at least one page before creating a PDF.");
    }

    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const maxPageBytes = Math.floor(MAX_SCANNED_PDF_BYTES / pages.length);
    for (const file of pages) {
        if (!file.type.startsWith("image/")) {
            throw new Error("A scanned page is not a supported image.");
        }
        const jpegBytes = await optimizePdfPage(file, maxPageBytes);
        const image = await pdf.embedJpg(jpegBytes);
        const landscape = image.width > image.height;
        const pageWidth = landscape ? PDF_PAGE_SIZE.height : PDF_PAGE_SIZE.width;
        const pageHeight = landscape ? PDF_PAGE_SIZE.width : PDF_PAGE_SIZE.height;
        const scale = Math.min(
            pageWidth / image.width,
            pageHeight / image.height
        );
        const width = image.width * scale;
        const height = image.height * scale;
        const page = pdf.addPage([pageWidth, pageHeight]);
        page.drawImage(image, {
            x: (pageWidth - width) / 2,
            y: (pageHeight - height) / 2,
            width,
            height
        });
    }

    const bytes = await pdf.save();
    if (
        bytes.length < 10 ||
        String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-"
    ) {
        throw new Error("The scan could not be exported as a valid PDF.");
    }
    if (bytes.length > MAX_SCANNED_PDF_BYTES) {
        throw new Error(
            "The PDF exceeds Messenger's 500 MB attachment limit. Remove some pages and try again."
        );
    }
    return new File([bytes], `messenger-scan-${Date.now()}.pdf`, {
        type: "application/pdf",
        lastModified: Date.now()
    });
};

export const processDocumentImage = async (
    source,
    normalizedCorners,
    filter = "enhanced",
    rotation = 0
) => {
    const sourceWidth = source.naturalWidth || source.videoWidth || source.width;
    const sourceHeight = source.naturalHeight || source.videoHeight || source.height;
    if (!sourceWidth || !sourceHeight) {
        throw new Error("The captured photo could not be read.");
    }
    const scale = Math.min(1, MAX_SOURCE_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(source, 0, 0, width, height);

    const sourceCorners = normalizedCorners.map(point => ({
        x: clamp(point.x, 0, 1) * (width - 1),
        y: clamp(point.y, 0, 1) * (height - 1)
    }));
    const outputWidth = Math.max(
        Math.hypot(
            sourceCorners[1].x - sourceCorners[0].x,
            sourceCorners[1].y - sourceCorners[0].y
        ),
        Math.hypot(
            sourceCorners[2].x - sourceCorners[3].x,
            sourceCorners[2].y - sourceCorners[3].y
        )
    );
    const outputHeight = Math.max(
        Math.hypot(
            sourceCorners[3].x - sourceCorners[0].x,
            sourceCorners[3].y - sourceCorners[0].y
        ),
        Math.hypot(
            sourceCorners[2].x - sourceCorners[1].x,
            sourceCorners[2].y - sourceCorners[1].y
        )
    );
    const destinationWidth = Math.max(1, Math.round(Math.min(outputWidth, MAX_SOURCE_DIMENSION)));
    const destinationHeight = Math.max(1, Math.round(
        Math.min(outputHeight, MAX_SOURCE_DIMENSION * 1.4)
    ));
    const homography = calculateHomography(
        sourceCorners,
        destinationWidth,
        destinationHeight
    );
    const input = sourceContext.getImageData(0, 0, width, height);
    const output = sourceContext.createImageData(destinationWidth, destinationHeight);
    const [a, b, c, d, e, f, g, h] = homography;

    for (let y = 0; y < destinationHeight; y += 1) {
        const row = y * destinationWidth * 4;
        for (let x = 0; x < destinationWidth; x += 1) {
            const divisor = g * x + h * y + 1;
            const sourceX = clamp((a * x + b * y + c) / divisor, 0, width - 1);
            const sourceY = clamp((d * x + e * y + f) / divisor, 0, height - 1);
            const x0 = Math.floor(sourceX);
            const y0 = Math.floor(sourceY);
            const x1 = Math.min(x0 + 1, width - 1);
            const y1 = Math.min(y0 + 1, height - 1);
            const xWeight = sourceX - x0;
            const yWeight = sourceY - y0;
            const topLeft = (y0 * width + x0) * 4;
            const topRight = (y0 * width + x1) * 4;
            const bottomLeft = (y1 * width + x0) * 4;
            const bottomRight = (y1 * width + x1) * 4;
            const outputIndex = row + x * 4;
            for (let channel = 0; channel < 3; channel += 1) {
                const top =
                    input.data[topLeft + channel] * (1 - xWeight) +
                    input.data[topRight + channel] * xWeight;
                const bottom =
                    input.data[bottomLeft + channel] * (1 - xWeight) +
                    input.data[bottomRight + channel] * xWeight;
                output.data[outputIndex + channel] =
                    top * (1 - yWeight) + bottom * yWeight;
            }
            output.data[outputIndex + 3] = 255;
        }
    }

    applyFilter(output, filter);
    const resultCanvas = document.createElement("canvas");
    const sideways = Math.abs(rotation) % 180 === 90;
    resultCanvas.width = sideways ? destinationHeight : destinationWidth;
    resultCanvas.height = sideways ? destinationWidth : destinationHeight;
    const resultContext = resultCanvas.getContext("2d");
    resultContext.save();
    if (rotation === 90) {
        resultContext.translate(resultCanvas.width, 0);
        resultContext.rotate(Math.PI / 2);
    } else if (rotation === 180) {
        resultContext.translate(resultCanvas.width, resultCanvas.height);
        resultContext.rotate(Math.PI);
    } else if (rotation === 270) {
        resultContext.translate(0, resultCanvas.height);
        resultContext.rotate(-Math.PI / 2);
    }
    const warpedCanvas = document.createElement("canvas");
    warpedCanvas.width = destinationWidth;
    warpedCanvas.height = destinationHeight;
    warpedCanvas.getContext("2d").putImageData(output, 0, 0);
    resultContext.drawImage(warpedCanvas, 0, 0);
    resultContext.restore();

    let quality = 0.92;
    let blob = await canvasToBlob(resultCanvas, "image/jpeg", quality);
    while (blob.size > MAX_OUTPUT_BYTES && quality > 0.44) {
        quality = Math.max(0.4, quality - 0.08);
        blob = await canvasToBlob(resultCanvas, "image/jpeg", quality);
    }
    if (blob.size > MAX_OUTPUT_BYTES) {
        throw new Error("This page is too large to process. Crop it closer and try again.");
    }
    return new File([blob], `scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now()
    });
};
