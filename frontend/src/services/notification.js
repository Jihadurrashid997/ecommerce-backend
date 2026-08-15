const DEFAULT_ICON = "/favicon.ico";


/* =========================================================
   JR STORE - NOTIFICATION SERVICE
========================================================= */


/* =========================================================
   CHECK SUPPORT
========================================================= */

export const isNotificationSupported = () => {
    return (
        typeof window !== "undefined" &&
        "Notification" in window
    );
};


/* =========================================================
   PERMISSION
========================================================= */

export const getNotificationPermission = () => {

    if (!isNotificationSupported()) {
        return "unsupported";
    }

    return Notification.permission;
};


/* =========================================================
   REQUEST PERMISSION
========================================================= */

export const requestNotificationPermission = async () => {

    if (!isNotificationSupported()) {
        return "unsupported";
    }

    if (
        Notification.permission ===
        "granted"
    ) {
        return "granted";
    }

    try {

        return await Notification.requestPermission();

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

        return "denied";
    }
};


/* =========================================================
   SHOW NOTIFICATION
========================================================= */

export const showNotification = (
    title,
    options = {}
) => {

    if (!isNotificationSupported()) {
        return null;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
        return null;
    }

    try {

        const notification =
            new Notification(
                title,
                {
                    icon:
                        options.icon ||
                        DEFAULT_ICON,

                    badge:
                        options.badge ||
                        DEFAULT_ICON,

                    body:
                        options.body ||
                        "",

                    tag:
                        options.tag ||
                        "jr-store",

                    renotify:
                        options.renotify ??
                        true,

                    requireInteraction:
                        options.requireInteraction ??
                        false,

                    silent:
                        options.silent ??
                        false,

                    data:
                        options.data ||
                        {}
                }
            );


        if (
            options.onClick
        ) {

            notification.onclick =
                (event) => {

                    event.preventDefault();

                    options.onClick(
                        event,
                        notification
                    );

                    window.focus();

                };

        }


        return notification;

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

        return null;
    }
};


/* =========================================================
   MESSAGE NOTIFICATION
========================================================= */

export const showMessageNotification = ({
    senderName = "New message",
    message = "",
    onClick
} = {}) => {

    return showNotification(
        senderName,
        {
            body:
                message ||
                "You have a new message.",

            tag:
                "jr-message",

            data: {
                type:
                    "message"
            },

            onClick
        }
    );
};


/* =========================================================
   INCOMING CALL NOTIFICATION
========================================================= */

export const showIncomingCallNotification = ({
    callerName = "Incoming call",
    type = "audio",
    onClick
} = {}) => {

    const callType =
        type === "video"
            ? "Video call"
            : "Voice call";

    return showNotification(
        `📞 ${callerName}`,
        {
            body:
                `Incoming ${callType}`,

            tag:
                "jr-incoming-call",

            requireInteraction:
                true,

            silent:
                false,

            data: {
                type:
                    "incoming-call",
                callType
            },

            onClick
        }
    );
};


/* =========================================================
   MISSED CALL NOTIFICATION
========================================================= */

export const showMissedCallNotification = ({
    callerName = "Unknown caller",
    type = "audio",
    onClick
} = {}) => {

    const callType =
        type === "video"
            ? "video"
            : "voice";

    return showNotification(
        `📵 Missed ${callType} call`,
        {
            body:
                `You missed a call from ${callerName}.`,

            tag:
                "jr-missed-call",

            data: {
                type:
                    "missed-call"
            },

            onClick
        }
    );
};


/* =========================================================
   CALL ENDED NOTIFICATION
========================================================= */

export const showCallEndedNotification = ({
    callerName = "Call",
    onClick
} = {}) => {

    return showNotification(
        "📞 Call ended",
        {
            body:
                `Your call with ${callerName} has ended.`,

            tag:
                "jr-call-ended",

            data: {
                type:
                    "call-ended"
            },

            onClick
        }
    );
};


/* =========================================================
   CLOSE NOTIFICATION
========================================================= */

export const closeNotification = (
    notification
) => {

    if (
        notification &&
        typeof notification.close ===
            "function"
    ) {

        notification.close();

    }
};


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    showNotification,
    showMessageNotification,
    showIncomingCallNotification,
    showMissedCallNotification,
    showCallEndedNotification,
    closeNotification
};
