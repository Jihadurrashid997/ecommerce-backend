import { detectDocumentCrop, enhanceDocumentPixels } from "./MessengerDocumentImage";

const makeImageData = (width, height, pixelAt) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const [red, green, blue] = pixelAt(x, y);
            const offset = (y * width + x) * 4;
            data[offset] = red;
            data[offset + 1] = green;
            data[offset + 2] = blue;
            data[offset + 3] = 255;
        }
    }
    return { width, height, data };
};

test("auto crop finds a bright document page against a dark background", () => {
    const image = makeImageData(100, 100, (x, y) =>
        x >= 10 && x < 90 && y >= 15 && y < 85
            ? [245, 245, 245]
            : [25, 25, 25]
    );

    const crop = detectDocumentCrop(image);

    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x).toBeLessThanOrEqual(10);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeLessThanOrEqual(15);
    expect(crop.x + crop.width).toBeGreaterThanOrEqual(90);
    expect(crop.y + crop.height).toBeGreaterThanOrEqual(85);
    expect(crop.width).toBeLessThan(100);
    expect(crop.height).toBeLessThan(100);
});

test("auto crop leaves the full image when page edges are unclear", () => {
    const image = makeImageData(40, 40, (x, y) => {
        const value = (x + y) % 2 ? 230 : 225;
        return [value, value, value];
    });

    expect(detectDocumentCrop(image)).toEqual({
        x: 0,
        y: 0,
        width: 40,
        height: 40
    });
});

test("text enhancement boosts contrast and creates a grayscale document image", () => {
    const image = makeImageData(3, 1, x =>
        x === 1 ? [90, 90, 90] : [180, 180, 180]
    );

    enhanceDocumentPixels(image);

    expect(image.data[0]).toBe(image.data[1]);
    expect(image.data[1]).toBe(image.data[2]);
    expect(image.data[4]).toBeLessThan(image.data[0]);
    expect(image.data[4]).toBe(image.data[5]);
    expect(image.data[8]).toBe(image.data[9]);
});
