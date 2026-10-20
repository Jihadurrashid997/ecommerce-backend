import React, { useEffect, useState } from "react";
import { FaVolumeUp } from "react-icons/fa";
import "./CallAudioOutputSelector.css";

const supportsAudioOutputSelection = () =>
    typeof HTMLMediaElement !== "undefined" &&
    typeof HTMLMediaElement.prototype.setSinkId === "function";

const CallAudioOutputSelector = ({
    active,
    audioElementRef,
    room
}) => {
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState("default");
    const [error, setError] = useState("");
    const supportsSelection =
        supportsAudioOutputSelection() &&
        (!room || typeof room.switchActiveDevice === "function");

    useEffect(() => {
        if (!active || !supportsSelection) {
            setDevices([]);
            return undefined;
        }

        let cancelled = false;
        const refreshDevices = async () => {
            try {
                const mediaDevices = navigator.mediaDevices;
                if (!mediaDevices?.enumerateDevices) {
                    setDevices([]);
                    return;
                }

                const outputs = (await mediaDevices.enumerateDevices())
                    .filter(device => device.kind === "audiooutput")
                    .filter(device => device.deviceId && device.deviceId !== "default");

                if (!cancelled) {
                    setDevices(outputs);
                    setError("");
                }
            } catch (deviceError) {
                console.error("Could not list call audio outputs:", deviceError);
                if (!cancelled) {
                    setDevices([]);
                    setError("Audio output devices could not be listed.");
                }
            }
        };

        refreshDevices();
        navigator.mediaDevices?.addEventListener?.(
            "devicechange",
            refreshDevices
        );

        return () => {
            cancelled = true;
            navigator.mediaDevices?.removeEventListener?.(
                "devicechange",
                refreshDevices
            );
        };
    }, [active, supportsSelection]);

    if (!active) {
        return null;
    }

    if (!supportsSelection || devices.length === 0) {
        return (
            <span
                className="call-audio-output-hint"
                role="status"
                title="Audio routing is controlled by the browser or device on this device."
            >
                <FaVolumeUp aria-hidden="true" />
                Device audio
            </span>
        );
    }

    const changeOutput = async event => {
        const deviceId = event.target.value;
        try {
            if (room) {
                const changed = await room.switchActiveDevice(
                    "audiooutput",
                    deviceId === "default" ? "" : deviceId
                );
                if (!changed) {
                    throw new Error("The selected audio output is unavailable.");
                }
            } else {
                const audioElement = audioElementRef?.current;
                if (!audioElement?.setSinkId) {
                    throw new Error("This browser cannot change call audio output.");
                }
                await audioElement.setSinkId(
                    deviceId === "default" ? "" : deviceId
                );
            }

            setSelectedDevice(deviceId);
            setError("");
        } catch (deviceError) {
            console.error("Could not change call audio output:", deviceError);
            setError(deviceError?.message || "Could not change call audio output.");
        }
    };

    return (
        <label className="call-audio-output-control">
            <FaVolumeUp aria-hidden="true" />
            <span className="call-audio-output-label">Audio output</span>
            <select
                aria-label="Audio output"
                value={selectedDevice}
                onChange={changeOutput}
            >
                <option value="default">System default</option>
                {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Speaker ${index + 1}`}
                    </option>
                ))}
            </select>
            {error && <span className="call-audio-output-error" role="alert">{error}</span>}
        </label>
    );
};

export default CallAudioOutputSelector;
