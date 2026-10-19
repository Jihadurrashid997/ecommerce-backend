import React from "react";
import {
    fireEvent,
    render,
    screen,
    waitFor
} from "@testing-library/react";
import VoiceMessagePlayer, { formatDuration } from "./VoiceMessagePlayer";

beforeEach(() => {
    jest.spyOn(HTMLMediaElement.prototype, "play")
        .mockResolvedValue(undefined);
    jest.spyOn(HTMLMediaElement.prototype, "pause")
        .mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

test("formats voice message durations", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.9)).toBe("1:05");
    expect(formatDuration(-2)).toBe("0:00");
});

test("plays, pauses, tracks playback progress, and resets when audio ends", async () => {
    render(<VoiceMessagePlayer url="/uploads/voice-note.webm" />);
    const audio = screen.getByLabelText("Voice message");
    Object.defineProperty(audio, "duration", {
        configurable: true,
        value: 12
    });
    fireEvent.loadedMetadata(audio);

    fireEvent.click(screen.getByRole("button", {
        name: "Play voice message"
    }));
    await waitFor(() => {
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
    fireEvent.play(audio);

    expect(screen.getByRole("button", {
        name: "Pause voice message"
    })).toBeInTheDocument();

    Object.defineProperty(audio, "currentTime", {
        configurable: true,
        writable: true,
        value: 4
    });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");

    fireEvent.click(screen.getByRole("button", {
        name: "Pause voice message"
    }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    fireEvent.pause(audio);

    fireEvent.ended(audio);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");
});

test("supports keyboard seeking and clamps playback position", () => {
    render(<VoiceMessagePlayer url="/uploads/voice-note.webm" />);
    const audio = screen.getByLabelText("Voice message");
    Object.defineProperty(audio, "duration", {
        configurable: true,
        value: 12
    });
    fireEvent.loadedMetadata(audio);

    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(audio.currentTime).toBe(5);
    expect(slider).toHaveAttribute("aria-valuenow", "5");

    fireEvent.keyDown(slider, { key: "End" });
    expect(audio.currentTime).toBe(12);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(audio.currentTime).toBe(12);
});

test("shows a playback error when the browser rejects audio playback", async () => {
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(
        new Error("Playback is blocked")
    );
    render(<VoiceMessagePlayer url="/uploads/voice-note.webm" />);

    fireEvent.click(screen.getByRole("button", {
        name: "Play voice message"
    }));

    expect(await screen.findByRole("status"))
        .toHaveTextContent("Tap play again or check this device's audio settings.");
});

test("resets playback state when a different voice message is loaded", async () => {
    const { rerender } = render(
        <VoiceMessagePlayer url="/uploads/first.webm" />
    );
    const audio = screen.getByLabelText("Voice message");
    fireEvent.play(audio);
    expect(screen.getByRole("button", {
        name: "Pause voice message"
    })).toBeInTheDocument();

    rerender(<VoiceMessagePlayer url="/uploads/second.webm" />);

    await waitFor(() => {
        expect(screen.getByRole("button", {
            name: "Play voice message"
        })).toBeInTheDocument();
    });
});
