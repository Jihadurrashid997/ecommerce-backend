jest.mock("pdf-lib", () => ({
    PDFDocument: {
        create: jest.fn()
    }
}));

import { PDFDocument } from "pdf-lib";
import {
    analyzeDocumentImage,
    createScannedPdf,
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

describe("multi-page scanned PDFs", () => {
    beforeEach(() => {
        PDFDocument.create.mockReset();
        const pdfPage = { drawImage: jest.fn() };
        PDFDocument.create.mockResolvedValue({
            addPage: jest.fn(() => pdfPage),
            embedJpg: jest.fn(async () => ({ width: 10, height: 20 })),
            save: jest.fn(async () => new Uint8Array([37, 80, 68, 70]))
        });

        URL.createObjectURL = jest.fn(() => "blob:scan-page");
        URL.revokeObjectURL = jest.fn();
        global.Image = class {
            naturalWidth = 10;
            naturalHeight = 20;

            set src(_value) {
                this.onload();
            }
        };
        jest.spyOn(document, "createElement").mockImplementation(tagName => {
            if (tagName !== "canvas") {
                return document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
            }
            return {
                width: 0,
                height: 0,
                getContext: () => ({ drawImage: jest.fn() }),
                toBlob: callback => callback({
                    size: 3,
                    arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer
                })
            };
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("requires at least one scanned page", async () => {
        await expect(createScannedPdf([])).rejects.toThrow(
            "Scan at least one page before creating a PDF."
        );
    });

    test("creates a PDF page for every scanned image", async () => {
        const pdf = await createScannedPdf([
            { type: "image/jpeg" },
            { type: "image/jpeg" }
        ]);
        const document = await PDFDocument.create.mock.results[0].value;

        expect(pdf.type).toBe("application/pdf");
        expect(pdf.name).toMatch(/^messenger-scan-.*\.pdf$/);
        expect(document.addPage).toHaveBeenCalledTimes(2);
        expect(document.embedJpg).toHaveBeenCalledTimes(2);
    });
});
