import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "Audio" }));
    expect(screen.getByRole("status")).toHaveTextContent("Device audio");
});

test("shows the caller name on an incoming call", () => {
    render(
        <CallModal
            visible
            type="audio"
            mode="incoming"
            status="ringing"
            callerName="Snoopy"
            onAccept={jest.fn()}
            onReject={jest.fn()}
        />
    );

    expect(screen.getByText("Snoopy")).toBeInTheDocument();
    expect(screen.getByText("Snoopy is calling...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept call" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject call" })).toBeInTheDocument();
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

test("keeps the caller name and connected timer visible over remote video", () => {
    const remoteStream = {
        getVideoTracks: () => [{ readyState: "live" }],
        getAudioTracks: () => [],
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    };
    jest.spyOn(HTMLMediaElement.prototype, "play")
        .mockResolvedValue(undefined);

    render(
        <CallModal
            visible
            type="video"
            mode="connected"
            status="connected"
            callerName="Snoopy"
            callDuration={93}
            remoteStream={remoteStream}
        />
    );

    expect(screen.getByLabelText("Call details")).toHaveTextContent("Snoopy");
    expect(screen.getByLabelText("Call duration")).toHaveTextContent("01:33");
});

test("keeps mute, end-call, and audio-output controls on an active voice call", () => {
    const audioTrack = { enabled: true };
    const localStream = {
        getAudioTracks: () => [audioTrack],
        getVideoTracks: () => []
    };
    const onEnd = jest.fn();
    render(
        <CallModal
            visible
            type="audio"
            mode="connected"
            status="connected"
            callerName="Snoopy"
            callDuration={65}
            localStream={localStream}
            onEnd={onEnd}
        />
    );

    expect(screen.getByText("Snoopy")).toBeInTheDocument();
    expect(screen.getByText("01:05")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End call" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(audioTrack.enabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(audioTrack.enabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Audio" }));
    expect(screen.getByRole("status")).toHaveTextContent("Device audio");
});

test("exposes video and screen-share controls on a connected voice call", async () => {
    const onToggleVideo = jest.fn().mockResolvedValue(undefined);
    const onShareScreen = jest.fn().mockResolvedValue(undefined);

    render(
        <CallModal
            visible
            type="audio"
            mode="connected"
            status="connected"
            callerName="Snoopy"
            onToggleVideo={onToggleVideo}
            onShareScreen={onShareScreen}
        />
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));
    fireEvent.click(screen.getByRole("button", { name: "Share screen" }));
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    await waitFor(() => {
        expect(onToggleVideo).toHaveBeenCalledTimes(1);
        expect(onShareScreen).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("menu", { name: "More call options" }))
        .toBeInTheDocument();
});
