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
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true }
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
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true }
        },
        video: {
            facingMode: { ideal: "environment" }
        }
    });
});

test("retries PC cameras with relaxed constraints when preferred modes are unavailable", async () => {
    const stream = {};
    const getUserMediaMock = jest.fn()
        .mockRejectedValueOnce(
            Object.assign(new Error("Unsupported frame rate"), {
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
            audio: false,
            video: true,
            facingMode: "user"
        })
    ).resolves.toBe(stream);

    expect(getUserMediaMock).toHaveBeenNthCalledWith(1, {
        audio: false,
        video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
        }
    });
    expect(getUserMediaMock).toHaveBeenNthCalledWith(2, {
        audio: false,
        video: {
            facingMode: { ideal: "user" }
        }
    });
});

test("falls back to the browser's default camera mode when facing preferences fail", async () => {
    const stream = {};
    const getUserMediaMock = jest.fn()
        .mockRejectedValueOnce(
            Object.assign(new Error("Unsupported frame rate"), {
                name: "OverconstrainedError"
            })
        )
        .mockRejectedValueOnce(
            Object.assign(new Error("No facing mode"), {
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
            audio: false,
            video: true,
            facingMode: "user"
        })
    ).resolves.toBe(stream);

    expect(getUserMediaMock).toHaveBeenNthCalledWith(3, {
        audio: false,
        video: true
    });
});
