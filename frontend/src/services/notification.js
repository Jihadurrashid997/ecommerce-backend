// frontend/src/services/notification.js

const NOTIFICATION_SOUND_URL =
    "/sounds/message-notification.mp3";

let audio = null;


/* =========================================================
   AUDIO
========================================================= */

const getAudio = () => {

    if (!audio) {

        audio = new Audio(
            NOTIFICATION_SOUND_URL
        );

        audio.preload = "auto";
    }

    return audio;
};


export const playMessageNotification =
    async () => {

        try {

            const sound =
                getAudio();

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


/* =========================================================
   BROWSER NOTIFICATION
========================================================= */

export const showBrowserNotification = ({
    title = "JR Store",
    body = "You have a new notification.",
    icon = "/favicon.ico",
    tag = "jr-store-notification"
} = {}) => {

    if (
        typeof window === "undefined" ||
        !("Notification" in window)
    ) {
        return false;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
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


/* =========================================================
   PERMISSION
========================================================= */

export const requestNotificationPermission =
    async () => {

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


/* =========================================================
   MESSAGE NOTIFICATION
========================================================= */

export const showMessageNotification =
    async ({
        senderName = "New message",
        message = "You received a new message.",
        enabled = true
    } = {}) => {

        if (!enabled) {
            return false;
        }

        await playMessageNotification();

        return showBrowserNotification({
            title: senderName,
            body: message,
            tag: "jr-store-message"
        });
    };


/* =========================================================
   INCOMING CALL
========================================================= */

export const showIncomingCallNotification =
    async ({
        callerName = "Incoming call",
        type = "audio"
    } = {}) => {

        await playMessageNotification();

        const callType =
            type === "video"
                ? "Video call"
                : "Voice call";

        return showBrowserNotification({
            title:
                `📞 ${callerName}`,
            body:
                `Incoming ${callType}`,
            tag:
                "jr-store-incoming-call"
        });
    };


/* =========================================================
   MISSED CALL
========================================================= */

export const showMissedCallNotification =
    async ({
        callerName = "User",
        type = "audio"
    } = {}) => {

        const callType =
            type === "video"
                ? "video"
                : "voice";

        return showBrowserNotification({
            title:
                `📞 Missed ${callType} call`,
            body:
                `You missed a call from ${callerName}.`,
            tag:
                "jr-store-missed-call"
        });
    };


/* =========================================================
   BACKWARD COMPATIBILITY
========================================================= */

export const notifyIncomingMessage =
    showMessageNotification;

export const notifyIncomingCall =
    showIncomingCallNotification;


/* =========================================================
   CLEANUP
========================================================= */

export const cleanupNotificationAudio =
    () => {

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


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    playMessageNotification,

    showBrowserNotification,

    requestNotificationPermission,

    showMessageNotification,

    showIncomingCallNotification,

    showMissedCallNotification,

    notifyIncomingMessage,

    notifyIncomingCall,

    cleanupNotificationAudio
};
