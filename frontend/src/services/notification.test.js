import {
    cleanupNotificationAudio,
    showIncomingCallNotification,
    showMessageNotification,
    showMissedCallNotification
} from "./notification";

let audioInstances;
let originalAudioDescriptor;
let originalNotificationDescriptor;
let NotificationMock;

beforeEach(() => {
    cleanupNotificationAudio();
    audioInstances = [];
    originalAudioDescriptor = Object.getOwnPropertyDescriptor(window, "Audio");
    originalNotificationDescriptor = Object.getOwnPropertyDescriptor(
        window,
        "Notification"
    );

    window.Audio = jest.fn((url) => {
        const audio = {
            currentTime: 0,
            loop: false,
            preload: "",
            src: url,
            play: jest.fn().mockResolvedValue(undefined),
            pause: jest.fn()
        };
        audioInstances.push(audio);
        return audio;
    });

    NotificationMock = jest.fn();
    NotificationMock.permission = "granted";
    window.Notification = NotificationMock;
});

afterEach(() => {
    cleanupNotificationAudio();

    if (originalAudioDescriptor) {
        Object.defineProperty(window, "Audio", originalAudioDescriptor);
    } else {
        delete window.Audio;
    }

    if (originalNotificationDescriptor) {
        Object.defineProperty(
            window,
            "Notification",
            originalNotificationDescriptor
        );
    } else {
        delete window.Notification;
    }
});

test("shows a browser notification for a new message", async () => {
    await expect(showMessageNotification({
        senderName: "Alex",
        message: "Hi there"
    })).resolves.toBe(true);

    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
    expect(NotificationMock).toHaveBeenCalledWith("Alex", {
        body: "Hi there",
        icon: "/favicon.ico",
        tag: "jr-store-message"
    });
});

test("shows a browser notification for an incoming call", async () => {
    await expect(showIncomingCallNotification({
        callerName: "Alex",
        type: "video"
    })).resolves.toBe(true);

    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].loop).toBe(true);
    expect(NotificationMock).toHaveBeenCalledWith("📞 Alex", {
        body: "Incoming Video call",
        icon: "/favicon.ico",
        tag: "jr-store-incoming-call"
    });
});

test("stops the ringtone and shows a browser notification for a missed call", async () => {
    await showIncomingCallNotification({ callerName: "Alex" });

    await expect(showMissedCallNotification({
        callerName: "Alex",
        type: "audio"
    })).resolves.toBe(true);

    expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);
    expect(NotificationMock).toHaveBeenLastCalledWith(
        "📞 Missed voice call",
        {
            body: "You missed a call from Alex.",
            icon: "/favicon.ico",
            tag: "jr-store-missed-call"
        }
    );
});

test("does not play or notify when message notifications are disabled", async () => {
    await expect(showMessageNotification({ enabled: false })).resolves.toBe(false);

    expect(audioInstances).toHaveLength(0);
    expect(NotificationMock).not.toHaveBeenCalled();
});
