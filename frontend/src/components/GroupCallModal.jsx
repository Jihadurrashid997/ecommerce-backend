import React, { useEffect, useRef, useState } from "react";
import {
    createLocalTracks,
    Room,
    RoomEvent,
    Track
} from "livekit-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa";
import api from "../services/api";
import "../styles/GroupCallModal.css";

const GroupCallModal = ({ group, type = "audio", onClose, onConnected }) => {
    const roomRef = useRef(null);
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

    useEffect(() => {
        onConnectedRef.current = onConnected;
    }, [onConnected]);

    useEffect(() => {
        let cancelled = false;
        let callRoom;

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

                callRoom = new Room({
                    adaptiveStream: true,
                    dynacast: true
                });
                roomRef.current = callRoom;

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
                    setError(
                        callError?.response?.data?.message ||
                        callError?.message ||
                        "Could not connect to the group call."
                    );
                    setStatus("Unable to connect");
                }

                if (callRoom) {
                    await callRoom.disconnect();
                }
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
                callRoom.disconnect();
            }
            roomRef.current = null;
        };
    }, [groupId, type]);

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
