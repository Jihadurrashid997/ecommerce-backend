import {
    analyzeDocumentImage,
    detectDocumentCorners,
    getDefaultDocumentCorners
} from "./documentScanner";

const createImageData = (width, height, colorAt) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const [red, green, blue] = colorAt(x, y);
            const index = (y * width + x) * 4;
            data[index] = red;
            data[index + 1] = green;
            data[index + 2] = blue;
            data[index + 3] = 255;
        }
    }
    return { data, width, height };
};

describe("document scanner image analysis", () => {
    test("warns when an image is too dark, overexposed, or blurry", () => {
        const dark = analyzeDocumentImage(createImageData(32, 32, () => [20, 20, 20]));
        const bright = analyzeDocumentImage(createImageData(32, 32, () => [255, 255, 255]));

        expect(dark.warnings).toContain("The photo is too dark.");
        expect(dark.warnings).toContain(
            "The photo looks blurry; hold the camera steady and retake it."
        );
        expect(bright.warnings).toContain("The photo may be overexposed.");
        expect(bright.warnings).toContain("Clipped highlights may obscure some text.");
    });

    test("returns an inset crop when document edges cannot be found", () => {
        const corners = detectDocumentCorners(
            createImageData(32, 32, () => [128, 128, 128])
        );

        expect(corners).toEqual(getDefaultDocumentCorners());
    });

    test("estimates corners around a high-contrast document", () => {
        const image = createImageData(100, 100, (x, y) => (
            x >= 20 && x <= 80 && y >= 15 && y <= 85
                ? [245, 245, 245]
                : [20, 20, 20]
        ));
        const corners = detectDocumentCorners(image);

        expect(corners[0].x).toBeLessThan(0.3);
        expect(corners[0].y).toBeLessThan(0.3);
        expect(corners[1].x).toBeGreaterThan(0.7);
        expect(corners[1].y).toBeLessThan(0.3);
        expect(corners[2].x).toBeGreaterThan(0.7);
        expect(corners[2].y).toBeGreaterThan(0.7);
        expect(corners[3].x).toBeLessThan(0.3);
        expect(corners[3].y).toBeGreaterThan(0.7);
    });
});
