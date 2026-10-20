import React, { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import "./MessengerDeviceSettings.css";

const decodeVapidKey = value => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = window.atob(
        normalized + "=".repeat((4 - normalized.length % 4) % 4)
    );
    return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const MessengerDeviceSettings = () => {
    const [devices, setDevices] = useState([]);
    const [permission, setPermission] = useState(
        typeof Notification === "undefined"
            ? "unsupported"
            : Notification.permission
    );
    const [pushEnabled, setPushEnabled] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const loadDevices = useCallback(async () => {
        try {
            const response = await api.get("/auth/devices");
            const loadedDevices = response.data?.data || [];
            setDevices(loadedDevices);
            setPushEnabled(
                loadedDevices.some(
                    device =>
                        device.isCurrent && device.hasPushSubscription
                )
            );
        } catch (loadError) {
            console.error("Load linked devices error:", loadError);
            setError(
                loadError.response?.data?.message ||
                "Linked devices could not be loaded."
            );
        }
    }, []);

    useEffect(() => {
        loadDevices();
    }, [loadDevices]);

    const enablePush = async () => {
        setBusy(true);
        setMessage("");
        setError("");
        try {
            const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                throw new Error(
                    "Background notifications are not configured yet. Set REACT_APP_VAPID_PUBLIC_KEY and rebuild the frontend."
                );
            }
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                throw new Error(
                    "This browser does not support background push notifications."
                );
            }
            if (
                /iPhone|iPad|iPod/.test(navigator.userAgent) &&
                !window.matchMedia("(display-mode: standalone)").matches &&
                !window.navigator.standalone
            ) {
                throw new Error(
                    "On iPhone/iPad, add this website to the Home Screen and open it there before enabling push notifications."
                );
            }

            const nextPermission =
                await window.Notification.requestPermission();
            setPermission(nextPermission);
            if (nextPermission !== "granted") {
                throw new Error(
                    "Allow notifications in your browser settings to enable background alerts."
                );
            }

            const registration = await navigator.serviceWorker.register(
                "/service-worker.js"
            );
            await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: decodeVapidKey(vapidKey)
                });
            }

            await api.put("/auth/devices/push-subscription", {
                subscription: subscription.toJSON()
            });
            setPushEnabled(true);
            setMessage("Background notifications enabled on this device.");
        } catch (enableError) {
            console.error("Enable Messenger push error:", enableError);
            setError(
                enableError.response?.data?.message ||
                enableError.message ||
                "Could not enable background notifications."
            );
        } finally {
            setBusy(false);
        }
    };

    const disablePush = async () => {
        setBusy(true);
        setMessage("");
        setError("");
        try {
            await api.delete("/auth/devices/push-subscription");
            const registration =
                await navigator.serviceWorker?.getRegistration(
                    "/service-worker.js"
                );
            const subscription =
                await registration?.pushManager?.getSubscription();
            await subscription?.unsubscribe();
            setPushEnabled(false);
            setMessage("Background notifications disabled on this device.");
        } catch (disableError) {
            console.error("Disable Messenger push error:", disableError);
            setError(
                disableError.response?.data?.message ||
                "Could not disable background notifications."
            );
        } finally {
            setBusy(false);
        }
    };

    const revokeDevice = async device => {
        if (
            !window.confirm(
                `Log out ${device.name} and revoke its account session?`
            )
        ) {
            return;
        }
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await api.delete(`/auth/devices/${device.deviceId}`);
            await loadDevices();
            setMessage(`${device.name} was logged out.`);
        } catch (revokeError) {
            console.error("Revoke linked device error:", revokeError);
            setError(
                revokeError.response?.data?.message ||
                "Could not revoke this device."
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="messenger-device-settings">
            <strong>Linked devices</strong>
            <p>
                Sign in to your same E Top profile on another browser or phone.
                To read encrypted history there, restore the encrypted Messenger
                key backup above with its passphrase.
            </p>
            {error && <p className="device-settings-error" role="alert">{error}</p>}
            {message && <p className="device-settings-message" role="status">{message}</p>}
            <div className="messenger-device-list">
                {devices.map(device => (
                    <article key={device.deviceId}>
                        <div>
                            <strong>{device.name}</strong>
                            <small>
                                {device.isCurrent ? "This device · " : ""}
                                Last active {new Date(device.lastActiveAt).toLocaleString()}
                            </small>
                        </div>
                        {!device.isCurrent && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => revokeDevice(device)}
                            >
                                Log out
                            </button>
                        )}
                    </article>
                ))}
                {!devices.length && (
                    <p>
                        No registered device sessions found. Sign out and back in
                        on this device to enable linked-device management.
                    </p>
                )}
            </div>

            {permission === "unsupported" ? (
                <p>Background push is not supported by this browser.</p>
            ) : permission === "granted" && pushEnabled ? (
                <>
                    <p>Browser notification permission: enabled.</p>
                    <button type="button" onClick={disablePush} disabled={busy}>
                        Disable push on this device
                    </button>
                </>
            ) : (
                <button type="button" onClick={enablePush} disabled={busy}>
                    {busy ? "Working…" : "Enable background notifications"}
                </button>
            )}
        </section>
    );
};

export default MessengerDeviceSettings;
