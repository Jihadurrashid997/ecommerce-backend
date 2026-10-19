import {
    finishVoiceRecording,
    startVoiceRecording
} from "./voiceRecorder";

const makeStream = () => {
    const track = { stop: jest.fn() };
    return {
        track,
        stream: { getTracks: () => [track] }
    };
};

test("records audio using the first supported browser format and returns a blob", async () => {
    const { stream } = makeStream();
    let recorder;
    class FakeMediaRecorder {
        static isTypeSupported = type => type === "audio/mp4";

        constructor(receivedStream, options) {
            expect(receivedStream).toBe(stream);
            expect(options).toEqual({ mimeType: "audio/mp4" });
            this.mimeType = options.mimeType;
            this.state = "inactive";
            this.listeners = {};
            recorder = this;
        }

        addEventListener(name, listener) {
            this.listeners[name] = listener;
        }

        start() {
            this.state = "recording";
            this.ondataavailable({
                data: new Blob(["voice"], { type: this.mimeType })
            });
        }

        stop() {
            this.state = "inactive";
            this.listeners.stop();
        }
    }

    const recording = await startVoiceRecording({
        getUserMedia: jest.fn().mockResolvedValue(stream),
        MediaRecorderClass: FakeMediaRecorder
    });

    expect(recording.recorder).toBe(recorder);
    expect(recording.chunks).toHaveLength(1);
    const blob = await finishVoiceRecording(
        recording.recorder,
        recording.chunks
    );
    expect(blob.type).toBe("audio/mp4");
    expect(blob.size).toBeGreaterThan(0);
});

test("stops microphone tracks if MediaRecorder setup fails", async () => {
    const { stream, track } = makeStream();
    class BrokenMediaRecorder {
        constructor() {
            throw new Error("Recorder initialization failed");
        }
    }

    await expect(startVoiceRecording({
        getUserMedia: jest.fn().mockResolvedValue(stream),
        MediaRecorderClass: BrokenMediaRecorder
    })).rejects.toThrow("Recorder initialization failed");
    expect(track.stop).toHaveBeenCalledTimes(1);
});

test("reports unsupported recording without requesting microphone access", async () => {
    const getUserMedia = jest.fn();
    await expect(startVoiceRecording({
        getUserMedia,
        MediaRecorderClass: undefined
    })).rejects.toMatchObject({
        name: "NotSupportedError",
        message: "Voice recording is not supported by this browser."
    });
    expect(getUserMedia).not.toHaveBeenCalled();
});

test("finishes an already-stopped recording without waiting for another event", async () => {
    const blob = await finishVoiceRecording(
        { state: "inactive", mimeType: "audio/webm" },
        [new Blob(["voice"], { type: "audio/webm" })]
    );
    expect(blob.type).toBe("audio/webm");
    expect(blob.size).toBeGreaterThan(0);
});
