import React, { useEffect, useRef, useState } from "react";
import {
    createLocalTracks,
    ExternalE2EEKeyProvider,
    isE2EESupported,
    Room,
    RoomEvent,
    Track
} from "livekit-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa";
import api from "../services/api";
import {
    createGroupCallKeyEnvelopes,
    ensureMessengerIdentity,
    unwrapGroupCallKey
} from "../services/messengerEncryption";
import "../styles/GroupCallModal.css";

const GroupCallModal = ({
    group,
    currentUser,
    type = "audio",
    onClose,
    onConnected
}) => {
    const roomRef = useRef(null);
    const workerRef = useRef(null);
    const onConnectedRef = useRef(onConnected);
    const [room, setRoom] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [revision, setRevision] = useState(0);
    const [status, setStatus] = useState("Connecting to group call...");
    const [error, setError] = useState("");
    const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(type === "video");

    const groupId = String(group?._id || group?.id || "");
    const groupName = group?.name || "Group call";
    const currentUserId = String(
        currentUser?._id || currentUser?.id || currentUser?.userId || ""
    );

    useEffect(() => {
        onConnectedRef.current = onConnected;
    }, [onConnected]);

    useEffect(() => {
        let cancelled = false;
        let callRoom;
        let encryptionWorker;

        const connect = async () => {
            try {
                const response = await api.post(
                    `/groups/${groupId}/call-token`
                );
                const data = response.data?.data;

                if (!data?.serverUrl || !data?.token) {
                    throw new Error(
                        response.data?.message ||
                        "The group call service did not return a connection token."
                    );
                }

                let encryptionOptions;
                let encryptedCall = Boolean(data.isEncrypted);
                let keyResponse;

                try {
                    keyResponse = await api.get(
                        `/groups/${groupId}/call-key`
                    );
                    encryptedCall = true;
                } catch (keyError) {
                    if (keyError.response?.status === 404) {
                        encryptedCall = true;
                    } else if (
                        keyError.response?.data?.code !==
                            "GROUP_CALL_E2EE_DISABLED" ||
                        encryptedCall
                    ) {
                        throw keyError;
                    }
                }

                if (encryptedCall) {
                    if (!isE2EESupported()) {
                        throw new Error(
                            "This browser cannot provide end-to-end encrypted group calls. Update your browser or use a supported device; this group call will not fall back to an unencrypted connection."
                        );
                    }

                    if (!currentUserId) {
                        throw new Error(
                            "Your account could not be verified for this encrypted group call."
                        );
                    }

                    const identity = await ensureMessengerIdentity(
                        api,
                        currentUserId
                    );

                    if (!keyResponse) {
                        const callKey = await createGroupCallKeyEnvelopes({
                            api,
                            groupId,
                            userId: currentUserId,
                            participants: data.participants || [],
                            identity
                        });
                        keyResponse = await api.post(
                            `/groups/${groupId}/call-key`,
                            {
                                keyId: callKey.keyId,
                                envelopes: callKey.envelopes
                            }
                        );
                    }

                    const keyData = keyResponse.data?.data;
                    if (
                        !keyData?.keyId ||
                        !keyData?.senderId ||
                        !keyData?.envelope
                    ) {
                        throw new Error(
                            keyResponse.data?.message ||
                            "The encrypted group call key could not be loaded."
                        );
                    }

                    let rawKey;
                    try {
                        rawKey = await unwrapGroupCallKey({
                            api,
                            groupId,
                            userId: currentUserId,
                            senderId: keyData.senderId,
                            keyId: keyData.keyId,
                            envelope: keyData.envelope,
                            identity
                        });
                    } catch (keyError) {
                        throw new Error(
                            `Could not unlock this encrypted group call key: ${keyError.message}`
                        );
                    }
                    const keyProvider = new ExternalE2EEKeyProvider();
                    await keyProvider.setKey(rawKey);
                    encryptionWorker = new Worker(
                        new URL(
                            "livekit-client/e2ee-worker",
                            import.meta.url
                        )
                    );
                    workerRef.current = encryptionWorker;
                    encryptionOptions = {
                        keyProvider,
                        worker: encryptionWorker
                    };
                }

                callRoom = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                    ...(encryptionOptions
                        ? { encryption: encryptionOptions }
                        : {})
                });
                roomRef.current = callRoom;

                if (encryptedCall) {
                    await callRoom.setE2EEEnabled(true);
                }

                const refreshParticipants = () => {
                    if (cancelled) {
                        return;
                    }

                    setParticipants([
                        callRoom.localParticipant,
                        ...callRoom.remoteParticipants.values()
                    ]);
                    setRevision(value => value + 1);
                };

                callRoom
                    .on(RoomEvent.ParticipantConnected, refreshParticipants)
                    .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
                    .on(RoomEvent.TrackSubscribed, refreshParticipants)
                    .on(RoomEvent.TrackUnsubscribed, refreshParticipants)
                    .on(RoomEvent.LocalTrackPublished, refreshParticipants)
                    .on(RoomEvent.LocalTrackUnpublished, refreshParticipants)
                    .on(RoomEvent.Disconnected, () => {
                        if (!cancelled) {
                            setStatus("Call disconnected");
                        }
                    })
                    .on(RoomEvent.EncryptionError, encryptionError => {
                        if (!encryptedCall || cancelled) {
                            return;
                        }

                        console.error(
                            "Group call encryption error:",
                            encryptionError
                        );
                        setError(
                            "End-to-end encryption failed. The call has been disconnected to protect your media."
                        );
                        setStatus("Encryption error");
                        void callRoom.disconnect().catch(disconnectError => {
                            console.error(
                                "Group call disconnect after encryption error:",
                                disconnectError
                            );
                        });
                    });

                await callRoom.connect(data.serverUrl, data.token);

                if (cancelled) {
                    await callRoom.disconnect();
                    return;
                }

                setRoom(callRoom);
                setStatus("Connecting your microphone...");

                const localTracks = await createLocalTracks({
                    audio: true,
                    video: type === "video"
                });

                if (cancelled) {
                    localTracks.forEach(track => track.stop());
                    await callRoom.disconnect();
                    return;
                }

                await Promise.all(
                    localTracks.map(track =>
                        callRoom.localParticipant.publishTrack(track)
                    )
                );

                if (!cancelled) {
                    setStatus("Connected");
                    refreshParticipants();
                    onConnectedRef.current?.();
                }
            } catch (callError) {
                console.error("Group call connection error:", callError);

                if (!cancelled) {
                    setRoom(null);
                    setParticipants([]);
                    setError(
                        callError?.response?.data?.message ||
                        callError?.message ||
                        "Could not connect to the group call."
                    );
                    setStatus("Unable to connect");
                }

                if (callRoom) {
                    try {
                        await callRoom.disconnect();
                    } catch (disconnectError) {
                        console.error(
                            "Group call disconnect after failure:",
                            disconnectError
                        );
                    }
                }
                encryptionWorker?.terminate();
                workerRef.current = null;
            }
        };

        if (!groupId) {
            setError("This group could not be identified.");
            setStatus("Unable to connect");
            return undefined;
        }

        connect();

        return () => {
            cancelled = true;
            if (callRoom) {
                void callRoom.disconnect()
                    .catch(disconnectError => {
                        console.error(
                            "Group call disconnect during cleanup:",
                            disconnectError
                        );
                    })
                    .finally(() => {
                        workerRef.current?.terminate();
                        workerRef.current = null;
                    });
            } else {
                workerRef.current?.terminate();
                workerRef.current = null;
            }
            roomRef.current = null;
        };
    }, [currentUserId, groupId, type]);

    const toggleMicrophone = async () => {
        const nextValue = !microphoneEnabled;
        try {
            await roomRef.current?.localParticipant.setMicrophoneEnabled(nextValue);
            setMicrophoneEnabled(nextValue);
        } catch (toggleError) {
            console.error("Group call microphone toggle error:", toggleError);
            setError(toggleError?.message || "Could not change microphone settings.");
        }
    };

    const toggleCamera = async () => {
        const nextValue = !cameraEnabled;
        try {
            await roomRef.current?.localParticipant.setCameraEnabled(nextValue);
            setCameraEnabled(nextValue);
            setRevision(value => value + 1);
        } catch (toggleError) {
            console.error("Group call camera toggle error:", toggleError);
            setError(toggleError?.message || "Could not change camera settings.");
        }
    };

    return (
        <div className="group-call-backdrop" role="dialog" aria-modal="true" aria-label={groupName}>
            <section className="group-call-window">
                <header className="group-call-header">
                    <div>
                        <h2>{groupName}</h2>
                        <p>{participants.length} in call · {status}</p>
                    </div>
                    <button type="button" className="group-call-close" onClick={onClose} aria-label="Leave call">
                        <FaPhoneSlash />
                    </button>
                </header>

                {error ? (
                    <div className="group-call-error" role="alert">
                        <strong>Could not start group call</strong>
                        <p>{error}</p>
                    </div>
                ) : (
                    <div className={`group-call-grid ${participants.length > 2 ? "many-participants" : ""}`}>
                        {participants.map(participant => (
                            <ParticipantTile
                                key={participant.identity}
                                participant={participant}
                                isLocal={participant === room?.localParticipant}
                                revision={revision}
                            />
                        ))}
                        {!participants.length && (
                            <div className="group-call-waiting">
                                <span className="group-call-spinner" />
                                <p>Joining the call…</p>
                            </div>
                        )}
                    </div>
                )}

                <footer className="group-call-controls">
                    <button
                        type="button"
                        className={!microphoneEnabled ? "is-off" : ""}
                        onClick={toggleMicrophone}
                        disabled={!room}
                        aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
                    >
                        {microphoneEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
                    </button>
                    {type === "video" && (
                        <button
                            type="button"
                            className={!cameraEnabled ? "is-off" : ""}
                            onClick={toggleCamera}
                            disabled={!room}
                            aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                        >
                            {cameraEnabled ? <FaVideo /> : <FaVideoSlash />}
                        </button>
                    )}
                    <button
                        type="button"
                        className="group-call-hangup"
                        onClick={onClose}
                        aria-label="Leave group call"
                    >
                        <FaPhoneSlash />
                    </button>
                </footer>
            </section>
        </div>
    );
};

const ParticipantTile = ({ participant, isLocal, revision }) => {
    const mediaRef = useRef(null);
    const cameraPublication =
        participant.getTrackPublication(Track.Source.Camera);
    const hasVideo = Boolean(cameraPublication?.track && !cameraPublication.isMuted);
    const displayName =
        participant.name ||
        participant.identity ||
        "Group member";

    useEffect(() => {
        const mediaContainer = mediaRef.current;
        if (!mediaContainer) {
            return undefined;
        }

        mediaContainer.replaceChildren();

        participant.trackPublications.forEach(publication => {
            const track = publication.track;
            if (!track || (isLocal && track.kind === Track.Kind.Audio)) {
                return;
            }

            const element = track.attach();
            if (element instanceof HTMLVideoElement) {
                element.className = "group-call-video";
                element.autoplay = true;
                element.playsInline = true;
                element.muted = isLocal;
            } else {
                element.className = "group-call-audio";
                element.autoplay = true;
            }

            mediaContainer.appendChild(element);
        });

        return () => {
            participant.trackPublications.forEach(publication => {
                publication.track?.detach().forEach(element => element.remove());
            });
        };
    }, [participant, isLocal, revision]);

    return (
        <article className="group-call-tile">
            <div className="group-call-media" ref={mediaRef}>
                {!hasVideo && (
                    <div className="group-call-avatar" aria-hidden="true">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <span className="group-call-name">
                {displayName}{isLocal ? " (You)" : ""}
            </span>
        </article>
    );
};

export default GroupCallModal;
