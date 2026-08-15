const DEFAULT_ICON =
    "/favicon.ico";

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

            console.error(
                "Notification permission error:",
                error
            );

            return "denied";

        }

    };


export const showNotification = ({
    title = "JR Store",
    body = "",
    icon = DEFAULT_ICON,
    tag,
    data = {}
} = {}) => {

    if (
        typeof window === "undefined" ||
        !("Notification" in window)
    ) {
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
                    body,
                    icon,
                    tag,
                    data,
                    badge: icon,
                    renotify: true
                }
            );

        notification.onclick =
            () => {

                window.focus();

                notification.close();

                if (
                    data?.url
                ) {
                    window.location.href =
                        data.url;
                }

            };

        return notification;

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

        return null;

    }

};


export const notifyNewMessage = ({
    senderName = "New message",
    message = "",
    userId = null
} = {}) => {

    return showNotification({
        title:
            `${senderName} sent you a message`,
        body:
            message || "You received a new message.",
        tag:
            userId
                ? `message-${userId}`
                : "new-message",
        data: {
            type: "message",
            userId
        }
    });

};


export const notifyIncomingCall = ({
    callerName = "Someone",
    type = "audio",
    callerId = null
} = {}) => {

    return showNotification({
        title:
            `Incoming ${type === "video" ? "video" : "voice"} call`,
        body:
            `${callerName} is calling you`,
        tag:
            callerId
                ? `call-${callerId}`
                : "incoming-call",
        data: {
            type: "call",
            callType: type,
            callerId
        }
    });

};


export const notifyMissedCall = ({
    callerName = "Someone",
    type = "audio",
    callerId = null
} = {}) => {

    return showNotification({
        title: "Missed call",
        body:
            `You missed a ${type === "video" ? "video" : "voice"} call from ${callerName}.`,
        tag:
            callerId
                ? `missed-call-${callerId}`
                : "missed-call",
        data: {
            type: "missed-call",
            callType: type,
            callerId
        }
    });

};


export default {
    requestNotificationPermission,
    showNotification,
    notifyNewMessage,
    notifyIncomingCall,
    notifyMissedCall
};
