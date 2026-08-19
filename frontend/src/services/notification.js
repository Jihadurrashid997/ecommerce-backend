// frontend/src/services/notification.js

const MESSAGE_SOUND_URL =
    "/sounds/message-notification.mp3";

const CALL_SOUND_URL =
    "/sounds/call-ringtone.mp3";


let messageAudio = null;
let callAudio = null;


/* =========================================================
   MESSAGE AUDIO
========================================================= */

const getMessageAudio = () => {

    if (!messageAudio) {

        messageAudio =
            new Audio(
                MESSAGE_SOUND_URL
            );

        messageAudio.preload =
            "auto";
    }

    return messageAudio;
};


export const playMessageNotification =
    async () => {

        try {

            const sound =
                getMessageAudio();

            sound.currentTime = 0;

            await sound.play();

            return true;

        } catch (error) {

            console.warn(
                "Message notification sound could not be played:",
                error
            );

            return false;
        }
    };


/* =========================================================
   CALL RINGTONE
========================================================= */

const getCallAudio = () => {

    if (!callAudio) {

        callAudio =
            new Audio(
                CALL_SOUND_URL
            );

        callAudio.preload =
            "auto";

        callAudio.loop =
            true;
    }

    return callAudio;
};


export const playCallRingtone =
    async () => {

        try {

            const sound =
                getCallAudio();

            sound.currentTime = 0;

            sound.loop = true;

            await sound.play();

            return true;

        } catch (error) {

            console.warn(
                "Call ringtone could not be played:",
                error
            );

            return false;
        }
    };


export const stopCallRingtone =
    () => {

        if (!callAudio) {
            return;
        }

        try {

            callAudio.pause();

            callAudio.currentTime =
                0;

        } catch (_) {}

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

            return await
                Notification.requestPermission();

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


        await
            playMessageNotification();


        return
            showBrowserNotification({
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

        await
            playCallRingtone();


        const callType =
            type === "video"
                ? "Video call"
                : "Voice call";


        return
            showBrowserNotification({

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

        stopCallRingtone();


        const callType =
            type === "video"
                ? "video"
                : "voice";


        return
            showBrowserNotification({

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

        try {

            if (messageAudio) {

                messageAudio.pause();

                messageAudio.currentTime =
                    0;

                messageAudio.src = "";

            }


            if (callAudio) {

                callAudio.pause();

                callAudio.currentTime =
                    0;

                callAudio.src = "";

            }

        } catch (_) {}


        messageAudio =
            null;

        callAudio =
            null;
    };


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    playMessageNotification,

    playCallRingtone,

    stopCallRingtone,

    showBrowserNotification,

    requestNotificationPermission,

    showMessageNotification,

    showIncomingCallNotification,

    showMissedCallNotification,

    notifyIncomingMessage,

    notifyIncomingCall,

    cleanupNotificationAudio
};
