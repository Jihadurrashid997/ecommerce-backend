const NOTIFICATION_SOUND_URL =
    "/sounds/message-notification.mp3";

let audio = null;

const getAudio = () => {
    if (!audio) {
        audio = new Audio(
            NOTIFICATION_SOUND_URL
        );

        audio.preload = "auto";
    }

    return audio;
};

export const playMessageNotification = async () => {
    try {
        const sound = getAudio();

        sound.currentTime = 0;

        await sound.play();

        return true;
    } catch (error) {
        console.warn(
            "Notification sound could not be played:",
            error
        );

        return false;
    }
};

export const showBrowserNotification = ({
    title = "JR Store",
    body = "You have a new message.",
    icon = "/favicon.ico",
    tag = "jr-store-message"
} = {}) => {

    if (
        typeof window === "undefined" ||
        !("Notification" in window)
    ) {
        return false;
    }

    if (Notification.permission !== "granted") {
        return false;
    }

    try {

        new Notification(
            title,
            {
                body,
                icon,
                tag
            }
        );

        return true;

    } catch (error) {

        console.warn(
            "Browser notification error:",
            error
        );

        return false;
    }
};

export const requestNotificationPermission = async () => {

    if (
        typeof window === "undefined" ||
        !("Notification" in window)
    ) {
        return "unsupported";
    }

    if (
        Notification.permission ===
        "granted"
    ) {
        return "granted";
    }

    if (
        Notification.permission ===
        "denied"
    ) {
        return "denied";
    }

    try {

        return await Notification.requestPermission();

    } catch (error) {

        console.warn(
            "Notification permission error:",
            error
        );

        return "denied";
    }
};

export const notifyIncomingMessage = async ({
    senderName = "New message",
    message = "You received a new message.",
    enabled = true
} = {}) => {

    if (!enabled) {
        return;
    }

    await playMessageNotification();

    showBrowserNotification({
        title: senderName,
        body: message
    });
};

export const notifyIncomingCall = async ({
    callerName = "Incoming call",
    type = "audio"
} = {}) => {

    const callType =
        type === "video"
            ? "Video call"
            : "Voice call";

    await playMessageNotification();

    showBrowserNotification({
        title: `📞 ${callerName}`,
        body: `Incoming ${callType}`
    });
};

export const cleanupNotificationAudio = () => {

    if (!audio) {
        return;
    }

    try {

        audio.pause();

        audio.currentTime = 0;

        audio.src = "";

    } catch (_) {}

    audio = null;
};

export default {
    playMessageNotification,
    showBrowserNotification,
    requestNotificationPermission,
    notifyIncomingMessage,
    notifyIncomingCall,
    cleanupNotificationAudio
};
