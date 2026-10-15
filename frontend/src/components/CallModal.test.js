import React from "react";
import { render, screen } from "@testing-library/react";
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
});
