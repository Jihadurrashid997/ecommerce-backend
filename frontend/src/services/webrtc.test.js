import { getUserMedia } from "./webrtc";

let originalMediaDevices;

beforeEach(() => {
    originalMediaDevices = Object.getOwnPropertyDescriptor(
        navigator,
        "mediaDevices"
    );
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
});

test("requests echo reduction without forcing device-specific audio formats", async () => {
    const stream = {};
    const getUserMediaMock = jest.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: getUserMediaMock }
    });

    await expect(getUserMedia({ audio: true })).resolves.toBe(stream);

    expect(getUserMediaMock).toHaveBeenCalledWith({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
        video: false
    });
});

test("preserves echo reduction when retrying overconstrained call media", async () => {
    const stream = {};
    const getUserMediaMock = jest.fn()
        .mockRejectedValueOnce(
            Object.assign(new Error("Unsupported audio format"), {
                name: "OverconstrainedError"
            })
        )
        .mockResolvedValueOnce(stream);
    Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: getUserMediaMock }
    });

    await expect(
        getUserMedia({
            audio: true,
            video: true,
            facingMode: "environment"
        })
    ).resolves.toBe(stream);

    expect(getUserMediaMock).toHaveBeenNthCalledWith(2, {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
        video: {
            facingMode: { ideal: "environment" }
        }
    });
});
