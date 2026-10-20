import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CallAudioOutputSelector from "./CallAudioOutputSelector";

let originalMediaDevices;
let originalSetSinkId;

const outputs = [
    { kind: "audiooutput", deviceId: "default", label: "Default" },
    { kind: "audiooutput", deviceId: "speaker", label: "Phone speaker" },
    { kind: "audioinput", deviceId: "microphone", label: "Microphone" }
];

beforeEach(() => {
    originalMediaDevices = Object.getOwnPropertyDescriptor(
        navigator,
        "mediaDevices"
    );
    originalSetSinkId = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "setSinkId"
    );
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
            enumerateDevices: jest.fn().mockResolvedValue(outputs),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        }
    });
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
        configurable: true,
        value: jest.fn().mockResolvedValue(undefined)
    });
});

afterEach(() => {
    if (originalMediaDevices) {
        Object.defineProperty(
            navigator,
            "mediaDevices",
            originalMediaDevices
        );
    } else {
        delete navigator.mediaDevices;
    }

    if (originalSetSinkId) {
        Object.defineProperty(
            HTMLMediaElement.prototype,
            "setSinkId",
            originalSetSinkId
        );
    } else {
        delete HTMLMediaElement.prototype.setSinkId;
    }
});

test("routes a direct call to a selected speaker output", async () => {
    const audioElementRef = {
        current: { setSinkId: jest.fn().mockResolvedValue(undefined) }
    };

    render(
        <CallAudioOutputSelector
            active
            audioElementRef={audioElementRef}
        />
    );

    const selector = await screen.findByRole("combobox", {
        name: "Audio output"
    });
    fireEvent.change(selector, { target: { value: "speaker" } });

    await waitFor(() => {
        expect(audioElementRef.current.setSinkId)
            .toHaveBeenCalledWith("speaker");
    });
});

test("routes a group call through LiveKit's active audio output", async () => {
    const room = {
        switchActiveDevice: jest.fn().mockResolvedValue(true)
    };

    render(<CallAudioOutputSelector active room={room} />);

    const selector = await screen.findByRole("combobox", {
        name: "Audio output"
    });
    fireEvent.change(selector, { target: { value: "speaker" } });

    await waitFor(() => {
        expect(room.switchActiveDevice)
            .toHaveBeenCalledWith("audiooutput", "speaker");
    });
});

test("explains device-controlled audio routing when the browser lacks output selection", () => {
    delete HTMLMediaElement.prototype.setSinkId;

    render(<CallAudioOutputSelector active />);

    expect(screen.getByRole("status"))
        .toHaveTextContent("Device audio");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
