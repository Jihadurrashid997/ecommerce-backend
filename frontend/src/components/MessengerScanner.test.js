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
