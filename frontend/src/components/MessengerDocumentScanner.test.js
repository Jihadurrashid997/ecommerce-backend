import React from "react";
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor
} from "@testing-library/react";
import MessengerDocumentScanner from "./MessengerDocumentScanner";
import {
    createScannedPdf,
    detectDocumentCorners,
    getDefaultDocumentCorners,
    processDocumentImage
} from "../services/documentScanner";

jest.mock("../services/documentScanner", () => ({
    analyzeDocumentImage: jest.fn(() => ({ warnings: [] })),
    createScannedPdf: jest.fn(async () =>
        new File(["pdf"], "messenger-scan.pdf", { type: "application/pdf" })
    ),
    detectDocumentCorners: jest.fn(() => [
        { x: 0.04, y: 0.04 },
        { x: 0.96, y: 0.04 },
        { x: 0.96, y: 0.96 },
        { x: 0.04, y: 0.96 }
    ]),
    getDefaultDocumentCorners: jest.fn(() => [
        { x: 0.04, y: 0.04 },
        { x: 0.96, y: 0.04 },
        { x: 0.96, y: 0.96 },
        { x: 0.04, y: 0.96 }
    ]),
    processDocumentImage: jest.fn(async () =>
        new File(["page"], "scan.jpg", { type: "image/jpeg" })
    )
}));

describe("MessengerDocumentScanner", () => {
    let mediaDevicesDescriptor;
    let createElementSpy;
    let objectUrlIndex;
    let scannedPageIndex;
    let imageDescriptor;
    let playDescriptor;
    let createObjectUrlDescriptor;
    let revokeObjectUrlDescriptor;
    const stream = {
        getTracks: () => [{ stop: jest.fn() }],
        getVideoTracks: () => [{
            getCapabilities: () => ({})
        }]
    };

    beforeEach(() => {
        objectUrlIndex = 0;
        scannedPageIndex = 0;
        const defaultCorners = [
            { x: 0.04, y: 0.04 },
            { x: 0.96, y: 0.04 },
            { x: 0.96, y: 0.96 },
            { x: 0.04, y: 0.96 }
        ];
        getDefaultDocumentCorners.mockReturnValue(defaultCorners);
        detectDocumentCorners.mockReturnValue(defaultCorners);
        createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
        revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
        URL.createObjectURL = jest.fn(() => `blob:scanner-${objectUrlIndex++}`);
        URL.revokeObjectURL = jest.fn();
        imageDescriptor = Object.getOwnPropertyDescriptor(global, "Image");
        global.Image = class {
            naturalWidth = 800;
            naturalHeight = 1000;

            set src(_value) {
                this.onload();
            }
        };
        mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
            navigator,
            "mediaDevices"
        );
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: { getUserMedia: jest.fn(async () => stream) }
        });
        playDescriptor = Object.getOwnPropertyDescriptor(
            HTMLMediaElement.prototype,
            "play"
        );
        Object.defineProperty(HTMLMediaElement.prototype, "play", {
            configurable: true,
            value: jest.fn(async () => {})
        });
        const originalCreateElement = document.createElement.bind(document);
        createElementSpy = jest.spyOn(document, "createElement");
        createElementSpy.mockImplementation((tagName, ...args) => (
            tagName === "canvas"
                ? {
                    width: 0,
                    height: 0,
                    getContext: () => ({
                        drawImage: jest.fn(),
                        getImageData: () => ({
                            data: new Uint8ClampedArray(4 * 4 * 4),
                            width: 4,
                            height: 4
                        })
                    })
                }
                : originalCreateElement(tagName, ...args)
        ));
        processDocumentImage.mockImplementation(async () => {
            scannedPageIndex += 1;
            return new File(
                [`page-${scannedPageIndex}`],
                `scan-${scannedPageIndex}.jpg`,
                { type: "image/jpeg" }
            );
        });
        createScannedPdf.mockResolvedValue(
            new File(["pdf"], "messenger-scan.pdf", { type: "application/pdf" })
        );
        processDocumentImage.mockClear();
        createScannedPdf.mockClear();
    });

    afterEach(() => {
        cleanup();
        createElementSpy.mockRestore();
        if (mediaDevicesDescriptor) {
            Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
        } else {
            delete navigator.mediaDevices;
        }
        if (imageDescriptor) {
            Object.defineProperty(global, "Image", imageDescriptor);
        } else {
            delete global.Image;
        }
        if (playDescriptor) {
            Object.defineProperty(
                HTMLMediaElement.prototype,
                "play",
                playDescriptor
            );
        } else {
            delete HTMLMediaElement.prototype.play;
        }
        if (createObjectUrlDescriptor) {
            Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
        } else {
            delete URL.createObjectURL;
        }
        if (revokeObjectUrlDescriptor) {
            Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
        } else {
            delete URL.revokeObjectURL;
        }
        jest.restoreAllMocks();
    });

    test("collects multiple scanned pages and sends one PDF", async () => {
        const onClose = jest.fn();
        const onSend = jest.fn(async () => {});
        render(<MessengerDocumentScanner onClose={onClose} onSend={onSend} />);

        const choosePage = async pageName => {
            fireEvent.change(screen.getByLabelText("Choose photo"), {
                target: {
                    files: [new File([pageName], `${pageName}.jpg`, { type: "image/jpeg" })]
                }
            });
            await screen.findByRole("heading", { name: "Adjust document" });
            fireEvent.click(screen.getByRole("button", { name: "Preview scan" }));
            await waitFor(() => {
                expect(screen.getByRole("button", { name: "Add page" })).toBeEnabled();
            });
            await waitFor(() => {
                expect(screen.getByRole("button", { name: "Review PDF" })).toBeEnabled();
            });
        };

        await choosePage("first");
        fireEvent.click(screen.getByRole("button", { name: "Review PDF" }));
        await screen.findByText("Page 1");

        fireEvent.click(screen.getByRole("button", { name: /Add page/ }));
        await screen.findByRole("heading", { name: "Scan document" });
        await choosePage("second");
        fireEvent.click(screen.getByRole("button", { name: "Add page" }));
        await screen.findByText("2/100 pages");

        fireEvent.click(screen.getByRole("button", { name: /Review PDF/ }));
        await screen.findByText("Page 2");
        fireEvent.click(screen.getByRole("button", { name: "Move page 2 up" }));
        fireEvent.click(screen.getByRole("button", { name: "Create & send PDF" }));

        await waitFor(() => {
            expect(createScannedPdf).toHaveBeenCalledTimes(1);
            expect(createScannedPdf.mock.calls[0][0]).toHaveLength(2);
            expect(createScannedPdf.mock.calls[0][0].map(file => file.name)).toEqual([
                "scan-2.jpg",
                "scan-1.jpg"
            ]);
            expect(onSend).toHaveBeenCalledWith(
                expect.objectContaining({ type: "application/pdf" })
            );
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
