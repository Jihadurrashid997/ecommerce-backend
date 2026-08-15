import { useEffect } from "react";

const NotificationPermission = () => {

    useEffect(() => {

        if (
            typeof window === "undefined" ||
            typeof Notification === "undefined"
        ) {
            return;
        }

        if (
            Notification.permission ===
            "default"
        ) {
            const requestPermission =
                async () => {

                    try {

                        await Notification.requestPermission();

                    } catch (error) {

                        console.error(
                            "Notification permission error:",
                            error
                        );

                    }

                };

            requestPermission();
        }

    }, []);

    return null;
};

export default NotificationPermission;
