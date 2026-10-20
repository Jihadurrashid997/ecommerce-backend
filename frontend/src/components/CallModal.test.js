import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CallModal from "./CallModal";

test("offers a user playback action when the browser blocks remote media", async () => {
    const remoteStream = {
        getVideoTracks: () => [{ readyState: "live" }],
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    };

    jest.spyOn(HTMLMediaElement.prototype, "play")
        .mockRejectedValue(new Error("Playback requires user interaction"));
    jest.spyOn(console, "warn").mockImplementation(() => {});

    render(
        <CallModal
            visible
            type="video"
            mode="connected"
            remoteStream={remoteStream}
        />
    );

    expect(
        await screen.findByRole("button", {
            name: "Enable call audio and video"
        })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Device audio");
});

test("mirrors only the local front-camera preview", () => {
    const localStream = {
        getVideoTracks: () => [{ readyState: "live" }],
        getAudioTracks: () => [],
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    };
    jest.spyOn(HTMLMediaElement.prototype, "play")
        .mockResolvedValue(undefined);

    const { rerender } = render(
        <CallModal
            visible
            type="video"
            mode="connected"
            localStream={localStream}
            cameraFacing="user"
        />
    );

    const localVideo = document.querySelector("video");
    expect(localVideo.style.transform).toBe("scaleX(-1)");

    rerender(
        <CallModal
            visible
            type="video"
            mode="connected"
            localStream={localStream}
            cameraFacing="environment"
        />
    );

    expect(localVideo.style.transform).toBe("none");
});
