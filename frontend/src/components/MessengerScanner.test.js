import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { processDocumentImage } from "./MessengerDocumentImage";
import MessengerScanner from "./MessengerScanner";

jest.mock("./MessengerDocumentImage", () => ({
    processDocumentImage: jest.fn()
}));

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalMediaDevices = Object.getOwnPropertyDescriptor(
    navigator,
    "mediaDevices"
);
const originalMediaPlay = HTMLMediaElement.prototype.play;
const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
const originalCanvasToBlob = HTMLCanvasElement.prototype.toBlob;

beforeEach(() => {
    URL.createObjectURL = jest.fn(() => "blob:scan-preview");
    URL.revokeObjectURL = jest.fn();
    processDocumentImage.mockImplementation(async file => file);
});

afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
    } else {
        delete navigator.mediaDevices;
    }
    HTMLMediaElement.prototype.play = originalMediaPlay;
    HTMLCanvasElement.prototype.getContext = originalCanvasGetContext;
    HTMLCanvasElement.prototype.toBlob = originalCanvasToBlob;
    jest.restoreAllMocks();
});

test("camera permission failure offers image upload and sends only after confirmation", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
            getUserMedia: jest.fn().mockRejectedValue(new Error("permission denied"))
        }
    });
    const onSend = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
        <MessengerScanner onClose={onClose} onSend={onSend} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));

    expect(await screen.findByRole("alert"))
        .toHaveTextContent("Choose an image to scan instead.");
    const image = new File(["scan"], "document.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [image] }
    });

    expect(await screen.findByRole("img", { name: "Captured document page" }))
        .toHaveAttribute("src", "blob:scan-preview");
    expect(processDocumentImage.mock.calls[0][0]).toBe(image);
    expect(processDocumentImage.mock.calls[0][1]).toBe("enhanced");
    fireEvent.click(screen.getByRole("button", { name: "B&W" }));
    await waitFor(() => {
        const lastCall = processDocumentImage.mock.calls[
            processDocumentImage.mock.calls.length - 1
        ];
        expect(lastCall[1]).toBe("blackwhite");
    });
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    await waitFor(() => {
        const lastCall = processDocumentImage.mock.calls[
            processDocumentImage.mock.calls.length - 1
        ];
        expect(lastCall[1]).toBe("original");
    });
    expect(await screen.findByRole("img", { name: "Captured document page" }))
        .toHaveAttribute("src", "blob:scan-preview");
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and send" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0]).toBe(image);
    expect(onClose).toHaveBeenCalled();
});

test("scanner stops camera tracks when closed", async () => {
    const track = { stop: jest.fn() };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: jest.fn().mockResolvedValue(stream) }
    });
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const ScannerHarness = () => {
        const [open, setOpen] = useState(true);
        return open
            ? <MessengerScanner onClose={() => {
                onClose();
                setOpen(false);
            }} onSend={jest.fn()} />
            : null;
    };
    render(<ScannerHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));

    expect(await screen.findByRole("button", { name: "Capture page" }))
        .toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Close scanner" }));

    await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
});

test("camera capture produces an image preview before sending", async () => {
    const track = { stop: jest.fn() };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: jest.fn().mockResolvedValue(stream) }
    });
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        drawImage: jest.fn()
    }));
    HTMLCanvasElement.prototype.toBlob = jest.fn(callback => {
        callback(new Blob(["captured scan"], { type: "image/jpeg" }));
    });
    URL.createObjectURL = jest.fn(() => "blob:scan-preview");
    const onSend = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const ScannerHarness = () => {
        const [open, setOpen] = useState(true);
        return open
            ? <MessengerScanner onClose={() => {
                onClose();
                setOpen(false);
            }} onSend={onSend} />
            : null;
    };
    render(<ScannerHarness />);
    const video = await screen.findByLabelText("Camera preview");
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Capture page" })).toBeEnabled();
    });
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });

    fireEvent.click(screen.getByRole("button", { name: "Capture page" }));
    const preview = await screen.findByRole("img", { name: "Captured document page" });
    expect(preview).toHaveAttribute("src", "blob:scan-preview");
    expect(processDocumentImage.mock.calls[0][0].type).toBe("image/jpeg");
    expect(processDocumentImage.mock.calls[0][1]).toBe("enhanced");
    expect(track.stop).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm and send" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].type).toBe("image/jpeg");
    expect(onSend.mock.calls[0][0].name).toMatch(/^messenger-capture-/);
    expect(onClose).toHaveBeenCalled();
});

test("selecting an image runs the scan without requesting camera access", async () => {
    const getUserMedia = jest.fn();
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia }
    });
    const image = new File(["page"], "page.png", { type: "image/png" });
    const { container } = render(
        <MessengerScanner onClose={jest.fn()} onSend={jest.fn()} />
    );

    fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [image] }
    });

    await screen.findByRole("img", { name: "Captured document page" });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(processDocumentImage.mock.calls[0][0]).toBe(image);
    expect(processDocumentImage.mock.calls[0][1]).toBe("enhanced");
});

test("user can adjust detected page corners before applying the scan", async () => {
    const detected = [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 }
    ];
    const processedFile = new File(["processed"], "scan.jpg", { type: "image/jpeg" });
    processDocumentImage.mockResolvedValue({
        file: processedFile,
        corners: detected,
        width: 100,
        height: 100
    });
    const { container } = render(
        <MessengerScanner onClose={jest.fn()} onSend={jest.fn()} />
    );
    const image = new File(["page"], "page.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [image] }
    });
    await screen.findByRole("img", { name: "Captured document page" });

    fireEvent.click(screen.getByRole("button", { name: "Adjust corners" }));
    const svg = container.querySelector(".messenger-scanner-corner-editor svg");
    svg.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100
    });
    const firstCorner = container.querySelector(
        ".messenger-scanner-corner-editor circle"
    );
    fireEvent(
        firstCorner,
        new MouseEvent("pointerdown", {
            bubbles: true,
            clientX: 10,
            clientY: 10
        })
    );
    fireEvent(
        svg,
        new MouseEvent("pointermove", {
            bubbles: true,
            clientX: 20,
            clientY: 25
        })
    );
    fireEvent(svg, new MouseEvent("pointerup", { bubbles: true }));
    fireEvent.click(screen.getByRole("button", { name: "Apply corners" }));

    await waitFor(() => {
        expect(processDocumentImage).toHaveBeenCalledTimes(2);
    });
    const adjustedCorners = processDocumentImage.mock.calls[1][2];
    expect(adjustedCorners[0]).toEqual({ x: 20, y: 25 });
});
