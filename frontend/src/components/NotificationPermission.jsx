import React, {
    useEffect,
    useState
} from "react";

import {
    FiBell,
    FiBellOff
} from "react-icons/fi";

import {
    requestNotificationPermission
} from "../services/notification";

const NotificationPermission = () => {

    const [permission, setPermission] =
        useState(
            typeof Notification !==
                "undefined"
                ? Notification.permission
                : "unsupported"
        );

    useEffect(() => {

        if (
            typeof Notification ===
            "undefined"
        ) {
            return;
        }

        setPermission(
            Notification.permission
        );

    }, []);

    const enableNotifications =
        async () => {

            const result =
                await requestNotificationPermission();

            setPermission(result);

        };

    if (
        permission === "granted" ||
        permission === "unsupported"
    ) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={
                enableNotifications
            }
            title="Enable message and call notifications"
            style={{
                position: "fixed",
                right: 20,
                bottom: 20,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "none",
                borderRadius: 24,
                padding: "11px 17px",
                background: "#1877f2",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                boxShadow:
                    "0 8px 25px rgba(24,119,242,.3)"
            }}
        >
            {permission === "denied" ? (
                <FiBellOff />
            ) : (
                <FiBell />
            )}

            {permission === "denied"
                ? "Enable notifications in browser"
                : "Enable notifications"}
        </button>
    );
};

export default NotificationPermission;
