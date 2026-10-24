import {
    createBlackAndWhiteDocumentImage,
    detectDocumentCorners,
    enhanceDocumentImage,
    warpDocumentPerspective
} from "./MessengerDocumentImage";

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

const originalImageData = global.ImageData;

beforeAll(() => {
    global.ImageData = class {
        constructor(dataOrWidth, widthOrHeight, height) {
            if (dataOrWidth instanceof Uint8ClampedArray) {
                this.data = dataOrWidth;
                this.width = widthOrHeight;
                this.height = height;
            } else {
                this.width = dataOrWidth;
                this.height = widthOrHeight;
                this.data = new Uint8ClampedArray(this.width * this.height * 4);
            }
        }
    };
});

afterAll(() => {
    global.ImageData = originalImageData;
});

test("OpenCV detects four corners of a skewed document", async () => {
    const image = makeImageData(240, 220, (x, y) => {
        const top = 25 + Math.round(x * 0.08);
        const bottom = 190 - Math.round(x * 0.04);
        const insidePage =
            x >= 35 && x <= 205 &&
            y >= top + Math.round((x - 35) * 0.12) &&
            y <= bottom - Math.round((x - 35) * 0.08);
        return insidePage ? [245, 245, 245] : [24, 24, 24];
    });

    const corners = await detectDocumentCorners(image);

    expect(corners).toHaveLength(4);
    expect(corners[0].x).toBeLessThan(55);
    expect(corners[0].y).toBeLessThan(45);
    expect(corners[1].x).toBeGreaterThan(175);
    expect(corners[1].y).toBeLessThan(60);
    expect(corners[2].x).toBeGreaterThan(165);
    expect(corners[2].y).toBeGreaterThan(150);
    expect(corners[3].x).toBeLessThan(75);
    expect(corners[3].y).toBeGreaterThan(145);
});

test("ambiguous page edges safely keep the full image", async () => {
    const image = makeImageData(80, 80, (x, y) => {
        const value = 220 + ((x + y) % 3);
        return [value, value, value];
    });

    expect(await detectDocumentCorners(image)).toEqual([
        { x: 0, y: 0 },
        { x: 79, y: 0 },
        { x: 79, y: 79 },
        { x: 0, y: 79 }
    ]);
});

test("perspective warp maps a skewed page into a flat rectangle", async () => {
    const image = makeImageData(120, 110, (x, y) => [x, y, 120]);
    const corners = [
        { x: 20, y: 10 },
        { x: 100, y: 20 },
        { x: 90, y: 100 },
        { x: 30, y: 90 }
    ];

    const result = await warpDocumentPerspective(image, corners);

    expect(result.width).toBeGreaterThan(50);
    expect(result.height).toBeGreaterThan(50);
    expect(result.data).toHaveLength(result.width * result.height * 4);
});

test("document enhancement evens out lighting while preserving color", async () => {
    const image = makeImageData(101, 61, (x, y) => {
        const paper = 130 + Math.round(x * 0.8);
        return x > 48 && x < 53 && y > 5 && y < 56
            ? [165, 55, 45]
            : [paper, paper, paper];
    });

    const result = await enhanceDocumentImage(image);

    expect(result.width).toBe(101);
    expect(result.height).toBe(61);
    const pixelAt = (x, y) => [
        ...result.data.slice((y * result.width + x) * 4, (y * result.width + x) * 4 + 3)
    ];
    const leftPaper = pixelAt(20, 30);
    const rightPaper = pixelAt(80, 30);
    expect(Math.abs(leftPaper[0] - rightPaper[0])).toBeLessThan(30);
    const coloredInk = pixelAt(50, 30);
    expect(coloredInk[0]).toBeGreaterThan(coloredInk[1]);
    expect(coloredInk[1]).toBeGreaterThan(coloredInk[2]);
});

test("black-and-white mode returns a grayscale scan", async () => {
    const image = makeImageData(31, 31, (x, y) =>
        x > 13 && x < 17 && y > 4 && y < 27
            ? [55, 55, 55]
            : [200 + (x % 20), 190 + (y % 20), 180 + (x % 10)]
    );

    const result = await createBlackAndWhiteDocumentImage(image);

    expect(result.width).toBe(31);
    expect(result.height).toBe(31);
    for (let offset = 0; offset < result.data.length; offset += 4) {
        expect(result.data[offset]).toBe(result.data[offset + 1]);
        expect(result.data[offset + 1]).toBe(result.data[offset + 2]);
    }
});
