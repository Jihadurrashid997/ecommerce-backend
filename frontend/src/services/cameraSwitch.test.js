import { switchCameraStream } from "./cameraSwitch";

class TestMediaStream {
    constructor(tracks) {
        this.tracks = tracks;
    }

    getVideoTracks() {
        return this.tracks.filter(track => track.kind === "video");
    }

    getAudioTracks() {
        return this.tracks.filter(track => track.kind === "audio");
    }

    getTracks() {
        return this.tracks;
    }
}

const createTrack = (kind, facingMode = "") => ({
    kind,
    label: "",
    stop: jest.fn(),
    getSettings: () => ({ facingMode })
});

beforeEach(() => {
    global.MediaStream = TestMediaStream;
});

test("switches to the requested rear camera and preserves the microphone track", async () => {
    const microphone = createTrack("audio");
    const frontCamera = createTrack("video", "user");
    const rearCamera = createTrack("video", "environment");
    const stream = new TestMediaStream([microphone, frontCamera]);
    const sender = {
        track: frontCamera,
        replaceTrack: jest.fn(async track => {
            sender.track = track;
        })
    };
    const mediaDevices = {
        getUserMedia: jest.fn().mockResolvedValue(
            new TestMediaStream([rearCamera])
        )
    };

    const result = await switchCameraStream({
        stream,
        peer: { getSenders: () => [sender] },
        facingMode: "user",
        mediaDevices
    });

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: false,
        video: { facingMode: { exact: "environment" } }
    });
    expect(sender.replaceTrack).toHaveBeenCalledWith(rearCamera);
    expect(frontCamera.stop).toHaveBeenCalledTimes(1);
    expect(result.stream.getAudioTracks()).toEqual([microphone]);
    expect(result.stream.getVideoTracks()).toEqual([rearCamera]);
    expect(result.facingMode).toBe("environment");
});

test("restores the previous camera when switching to the rear camera fails", async () => {
    const microphone = createTrack("audio");
    const frontCamera = createTrack("video", "user");
    const restoredCamera = createTrack("video", "user");
    const stream = new TestMediaStream([microphone, frontCamera]);
    const sender = {
        track: frontCamera,
        replaceTrack: jest.fn(async track => {
            sender.track = track;
        })
    };
    const mediaDevices = {
        getUserMedia: jest.fn()
            .mockRejectedValueOnce(
                Object.assign(new Error("No rear camera"), {
                    name: "OverconstrainedError"
                })
            )
            .mockRejectedValueOnce(new Error("Rear camera unavailable"))
            .mockResolvedValueOnce(new TestMediaStream([restoredCamera]))
    };

    await expect(switchCameraStream({
        stream,
        peer: { getSenders: () => [sender] },
        facingMode: "user",
        mediaDevices
    })).rejects.toMatchObject({
        message: "Rear camera unavailable",
        restoredStream: expect.objectContaining({
            tracks: [microphone, restoredCamera]
        })
    });

    expect(sender.replaceTrack).toHaveBeenCalledWith(restoredCamera);
    expect(frontCamera.stop).toHaveBeenCalledTimes(1);
});

test("rejects a camera that reports the opposite facing mode and restores the active camera", async () => {
    const microphone = createTrack("audio");
    const frontCamera = createTrack("video", "user");
    const wrongCamera = createTrack("video", "user");
    const restoredCamera = createTrack("video", "user");
    const stream = new TestMediaStream([microphone, frontCamera]);
    const mediaDevices = {
        getUserMedia: jest.fn()
            .mockResolvedValueOnce(new TestMediaStream([wrongCamera]))
            .mockResolvedValueOnce(new TestMediaStream([restoredCamera]))
    };

    await expect(switchCameraStream({
        stream,
        facingMode: "user",
        mediaDevices
    })).rejects.toMatchObject({
        message: "The device opened the wrong camera."
    });

    expect(wrongCamera.stop).toHaveBeenCalledTimes(1);
});
