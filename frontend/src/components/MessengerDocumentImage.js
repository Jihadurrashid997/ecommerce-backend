const MAX_DIMENSION = 1800;
const DETECTION_DIMENSION = 720;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let openCvPromise;

const getOpenCv = () => {
    if (!openCvPromise) {
        openCvPromise = import("@techstark/opencv-js").then(async module => {
            const runtime = module.default || module;
            if (runtime && typeof runtime.then === "function") {
                return runtime;
            }
            if (runtime?.Mat) return runtime;
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error("Document scanner image engine did not initialize.")),
                    30000
                );
                runtime.onRuntimeInitialized = () => {
                    clearTimeout(timeout);
                    resolve(runtime);
                };
                runtime.onAbort = () => {
                    clearTimeout(timeout);
                    reject(new Error("Document scanner image engine failed to initialize."));
                };
            });
        });
    }
    return openCvPromise;
};

const identityCorners = (width, height) => [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 }
];

const orderCorners = points => {
    const center = points.reduce(
        (sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }),
        { x: 0, y: 0 }
    );
    const ordered = [...points].sort(
        (first, second) =>
            Math.atan2(first.y - center.y, first.x - center.x) -
            Math.atan2(second.y - center.y, second.x - center.x)
    );
    const topLeftIndex = ordered.reduce(
        (best, point, index) =>
            point.x + point.y < ordered[best].x + ordered[best].y ? index : best,
        0
    );
    return [
        ...ordered.slice(topLeftIndex),
        ...ordered.slice(0, topLeftIndex)
    ];
};

const getContourCandidates = (cv, binary, imageArea, best) => {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    try {
        cv.findContours(
            binary,
            contours,
            hierarchy,
            cv.RETR_LIST,
            cv.CHAIN_APPROX_SIMPLE
        );
        for (let index = 0; index < contours.size(); index += 1) {
            const contour = contours.get(index);
            const perimeter = cv.arcLength(contour, true);
            if (!perimeter) {
                contour.delete();
                continue;
            }
            const approximation = new cv.Mat();
            try {
                cv.approxPolyDP(contour, approximation, perimeter * 0.02, true);
                const area = Math.abs(cv.contourArea(contour));
                if (
                    approximation.rows === 4 &&
                    area >= imageArea * 0.2 &&
                    area <= imageArea * 0.995 &&
                    cv.isContourConvex(approximation) &&
                    area > best.area
                ) {
                    const points = [];
                    for (let point = 0; point < 4; point += 1) {
                        points.push({
                            x: approximation.data32S[point * 2],
                            y: approximation.data32S[point * 2 + 1]
                        });
                    }
                    best.area = area;
                    best.corners = orderCorners(points);
                }
            } finally {
                approximation.delete();
                contour.delete();
            }
        }
    } finally {
        binary.delete();
        contours.delete();
        hierarchy.delete();
    }
};

export const detectDocumentCorners = async imageData => {
    const cv = await getOpenCv();
    const { width, height } = imageData;
    const source = new cv.Mat(height, width, cv.CV_8UC4);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const closedEdges = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    const best = { area: 0, corners: identityCorners(width, height) };

    try {
        source.data.set(imageData.data);
        cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        const imageArea = width * height;

        for (const [lower, upper] of [[25, 75], [45, 135], [70, 210]]) {
            cv.Canny(blurred, edges, lower, upper);
            cv.morphologyEx(edges, closedEdges, cv.MORPH_CLOSE, kernel);
            getContourCandidates(cv, closedEdges.clone(), imageArea, best);
        }

        const binary = new cv.Mat();
        const inverse = new cv.Mat();
        try {
            cv.threshold(
                blurred,
                binary,
                0,
                255,
                cv.THRESH_BINARY | cv.THRESH_OTSU
            );
            getContourCandidates(cv, binary.clone(), imageArea, best);
            cv.bitwise_not(binary, inverse);
            getContourCandidates(cv, inverse.clone(), imageArea, best);
        } finally {
            binary.delete();
            inverse.delete();
        }
        return best.corners;
    } finally {
        source.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        closedEdges.delete();
        kernel.delete();
    }
};

export const warpDocumentPerspective = async (imageData, corners) => {
    const cv = await getOpenCv();
    const [topLeft, topRight, bottomRight, bottomLeft] = corners;
    const sideLength = (first, second) =>
        Math.hypot(second.x - first.x, second.y - first.y);
    const targetWidth = Math.max(
        sideLength(topLeft, topRight),
        sideLength(bottomLeft, bottomRight)
    );
    const targetHeight = Math.max(
        sideLength(topLeft, bottomLeft),
        sideLength(topRight, bottomRight)
    );
    const scale = Math.min(1, MAX_DIMENSION / Math.max(targetWidth, targetHeight));
    const width = Math.max(1, Math.round(targetWidth * scale));
    const height = Math.max(1, Math.round(targetHeight * scale));
    const source = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
    const destination = new cv.Mat();
    const sourcePoints = cv.matFromArray(
        4, 1, cv.CV_32FC2, corners.flatMap(point => [point.x, point.y])
    );
    const destinationPoints = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        [0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1]
    );
    const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);

    try {
        source.data.set(imageData.data);
        cv.warpPerspective(
            source,
            destination,
            transform,
            new cv.Size(width, height),
            cv.INTER_CUBIC,
            cv.BORDER_REPLICATE
        );
        return new ImageData(
            new Uint8ClampedArray(destination.data),
            destination.cols,
            destination.rows
        );
    } finally {
        source.delete();
        destination.delete();
        sourcePoints.delete();
        destinationPoints.delete();
        transform.delete();
    }
};

export const enhanceDocumentImage = async imageData => {
    const cv = await getOpenCv();
    const source = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
    const lab = new cv.Mat();
    const channels = new cv.MatVector();
    const background = new cv.Mat();
    const normalized = new cv.Mat();
    const balanced = new cv.Mat();
    const rgba = new cv.Mat();
    let lightness;

    try {
        source.data.set(imageData.data);
        cv.cvtColor(source, lab, cv.COLOR_RGBA2Lab);
        cv.split(lab, channels);
        lightness = channels.get(0);
        const blurSize = Math.max(
            3,
            Math.min(101, (Math.min(imageData.width, imageData.height) * 0.07) | 1)
        );
        cv.GaussianBlur(
            lightness,
            background,
            new cv.Size(blurSize, blurSize),
            0
        );
        cv.divide(lightness, background, normalized, 220, cv.CV_8U);
        cv.addWeighted(normalized, 0.85, lightness, 0.15, 0, balanced);
        channels.set(0, balanced);
        cv.merge(channels, lab);
        cv.cvtColor(lab, rgba, cv.COLOR_Lab2RGBA);
        return new ImageData(
            new Uint8ClampedArray(rgba.data),
            rgba.cols,
            rgba.rows
        );
    } finally {
        source.delete();
        lab.delete();
        lightness?.delete();
        channels.delete();
        background.delete();
        normalized.delete();
        balanced.delete();
        rgba.delete();
    }
};

export const createBlackAndWhiteDocumentImage = async imageData => {
    const cv = await getOpenCv();
    const source = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
    const gray = new cv.Mat();
    const thresholded = new cv.Mat();
    const filtered = new cv.Mat();
    const rgba = new cv.Mat();

    try {
        source.data.set(imageData.data);
        cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
        const blockSize = Math.max(
            3,
            Math.min(41, Math.min(imageData.width, imageData.height) | 1)
        );
        cv.adaptiveThreshold(
            gray,
            thresholded,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            blockSize,
            11
        );
        cv.medianBlur(thresholded, filtered, 3);
        cv.cvtColor(filtered, rgba, cv.COLOR_GRAY2RGBA);
        return new ImageData(
            new Uint8ClampedArray(rgba.data),
            rgba.cols,
            rgba.rows
        );
    } finally {
        source.delete();
        gray.delete();
        thresholded.delete();
        filtered.delete();
        rgba.delete();
    }
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

export const processDocumentImage = async (
    file,
    mode = "enhanced",
    manualCorners = null
) => {
    const image = await loadImage(file);
    const scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) {
        throw new Error("This browser could not prepare the scanned image.");
    }
    sourceContext.drawImage(image, 0, 0, width, height);

    const detectionScale = Math.min(
        1,
        DETECTION_DIMENSION / Math.max(width, height)
    );
    const detectionCanvas = document.createElement("canvas");
    detectionCanvas.width = Math.max(1, Math.round(width * detectionScale));
    detectionCanvas.height = Math.max(1, Math.round(height * detectionScale));
    const detectionContext = detectionCanvas.getContext("2d", {
        willReadFrequently: true
    });
    if (!detectionContext) {
        throw new Error("This browser could not detect the document page.");
    }
    detectionContext.drawImage(
        sourceCanvas,
        0,
        0,
        detectionCanvas.width,
        detectionCanvas.height
    );

    const detectedCorners = manualCorners || await detectDocumentCorners(
        detectionContext.getImageData(
            0,
            0,
            detectionCanvas.width,
            detectionCanvas.height
        )
    );
    const corners = detectedCorners.map(point => ({
        x: Math.max(
            0,
            Math.min(width - 1, manualCorners ? point.x : point.x / detectionScale)
        ),
        y: Math.max(
            0,
            Math.min(height - 1, manualCorners ? point.y : point.y / detectionScale)
        )
    }));
    let output = await warpDocumentPerspective(
        sourceContext.getImageData(0, 0, width, height),
        corners
    );
    if (mode === "enhanced") output = await enhanceDocumentImage(output);
    if (mode === "blackwhite") output = await createBlackAndWhiteDocumentImage(output);

    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the scanned image.");
    context.putImageData(output, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.95));
    if (!blob) {
        throw new Error("The scanned image could not be prepared. Please try again.");
    }
    if (blob.size > MAX_FILE_SIZE) {
        throw new Error("The scanned image is too large to send (10MB maximum).");
    }
    return {
        file: new File([blob], `messenger-scan-${Date.now()}.jpg`, {
            type: "image/jpeg"
        }),
        corners,
        width,
        height
    };
};
