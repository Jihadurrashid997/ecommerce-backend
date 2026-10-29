import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import {
    FiMic,
    FiMicOff,
    FiVideo,
    FiVideoOff,
    FiPhoneOff,
    FiPhone,
    FiVolume2,
    FiRefreshCw,
    FiMoreHorizontal,
    FiMonitor
} from "react-icons/fi";
import CallAudioOutputSelector from "./CallAudioOutputSelector";
import "./CallModal.css";

const CallModal = ({
    visible,
    type = "audio",
    mode = "outgoing",
    status = "calling",
    callerName = "User",
    callerAvatar = "",
    localStream = null,
    remoteStream = null,
    callDuration = 0,
    cameraFacing = "user",
    cameraEnabled = false,
    sharingScreen = false,
    onAccept,
    onReject,
    onEnd,
    onSwitchCamera,
    onToggleVideo,
    onShareScreen
}) => {

    const localVideoRef =
        useRef(null);

    const remoteVideoRef =
        useRef(null);

    const remoteAudioRef =
        useRef(null);

    const [muted, setMuted] =
        useState(false);

    const [cameraOff, setCameraOff] =
        useState(type !== "video");

    const [playbackBlocked, setPlaybackBlocked] =
        useState(false);

    const playbackBlockedRef =
        useRef(false);

    const [audioOutputOpen, setAudioOutputOpen] =
        useState(false);

    const [moreOpen, setMoreOpen] =
        useState(false);

    const [controlError, setControlError] =
        useState("");

    const isIncoming =
        mode === "incoming";

    const isActiveCall =
        mode === "accepted" ||
        mode === "connected";

    const isConnectedCall =
        mode === "connected" ||
        status === "connected";

    const isVideo =
        type === "video";

    const [remoteVideoAvailable, setRemoteVideoAvailable] =
        useState(false);

    useEffect(() => {
        const videoTracks = remoteStream?.getVideoTracks() || [];
        const updateVideoAvailability = () => {
            setRemoteVideoAvailable(
                videoTracks.some(
                    track =>
                        track.readyState === "live" &&
                        !track.muted
                )
            );
        };

        updateVideoAvailability();
        videoTracks.forEach(track => {
            track.addEventListener?.("mute", updateVideoAvailability);
            track.addEventListener?.("unmute", updateVideoAvailability);
            track.addEventListener?.("ended", updateVideoAvailability);
        });

        return () => {
            videoTracks.forEach(track => {
                track.removeEventListener?.("mute", updateVideoAvailability);
                track.removeEventListener?.("unmute", updateVideoAvailability);
                track.removeEventListener?.("ended", updateVideoAvailability);
            });
        };
    }, [remoteStream]);

    useEffect(() => {
        if (visible) {
            return;
        }

        setMuted(false);
        setCameraOff(type !== "video");
        playbackBlockedRef.current = false;
        setPlaybackBlocked(false);
        setAudioOutputOpen(false);
        setMoreOpen(false);
        setControlError("");
    }, [visible, type]);

    const hasRemoteVideo = remoteVideoAvailable;

    const hasLocalVideo =
        localStream
            ?.getVideoTracks()
            .some(track => track.readyState === "live");

    const displayIsVideo =
        isVideo || hasRemoteVideo || hasLocalVideo;

    const runCallAction = async action => {
        setControlError("");
        try {
            await action();
        } catch (error) {
            setControlError(
                error?.message || "That call control could not be used."
            );
        }
    };

    const playRemoteMedia =
        useCallback(
            async () => {
                const elements = [
                    hasRemoteVideo ? remoteVideoRef.current : null,
                    remoteAudioRef.current
                ].filter(Boolean);

                try {
                    await Promise.all(
                        elements.map(element => element.play())
                    );
                    if (playbackBlockedRef.current) {
                        playbackBlockedRef.current = false;
                        setPlaybackBlocked(false);
                    }
                } catch (error) {
                    console.warn("Remote media playback needs user interaction:", error);
                    if (!playbackBlockedRef.current) {
                        playbackBlockedRef.current = true;
                        setPlaybackBlocked(true);
                    }
                }
            },
            [hasRemoteVideo]
        );


    /*
    =========================================================
    LOCAL MEDIA
    =========================================================
    */

    useEffect(() => {

        const video =
            localVideoRef.current;

        if (!video || !localStream || !hasLocalVideo) {
            return;
        }

        if (
            video.srcObject !==
            localStream
        ) {
            video.srcObject =
                localStream;
        }

        const play =
            async () => {

                try {
                    await video.play();
                } catch (_) {}

            };

        play();

        return () => {

            if (
                video.srcObject ===
                localStream
            ) {
                video.srcObject = null;
            }

        };

    }, [
        localStream,
        hasLocalVideo
    ]);


    /*
    =========================================================
    REMOTE MEDIA
    =========================================================
    */

    useEffect(() => {

        if (!remoteStream) {
            return;
        }


        const video = remoteVideoRef.current;
        const audio = remoteAudioRef.current;

        if (video && hasRemoteVideo) {
            video.srcObject = remoteStream;
            video.muted = true;
        } else if (video) {
            video.srcObject = null;
        }

        if (audio) {
            audio.srcObject = remoteStream;
        }

        playRemoteMedia();


        return () => {

            if (
                video &&
                video.srcObject ===
                    remoteStream
            ) {
                video.srcObject = null;
            }

            if (
                audio &&
                audio.srcObject ===
                    remoteStream
            ) {
                audio.srcObject = null;
            }

        };

    }, [
        remoteStream,
        hasRemoteVideo,
        playRemoteMedia
    ]);


    /*
    =========================================================
    REMOTE TRACK CHANGES
    =========================================================
    */

    useEffect(() => {

        if (!remoteStream) {
            return;
        }


        const handleTrack =
            () => {

                const video =
                    remoteVideoRef.current;

                const audio =
                    remoteAudioRef.current;


                if (video && hasRemoteVideo) {

                    video.srcObject =
                        remoteStream;
                    video.muted = true;

                } else if (video) {

                    video.srcObject = null;

                }

                if (audio) {
                    audio.srcObject =
                        remoteStream;
                }

                playRemoteMedia();

            };


        remoteStream.addEventListener(
            "addtrack",
            handleTrack
        );


        return () => {

            remoteStream.removeEventListener(
                "addtrack",
                handleTrack
            );

        };

    }, [
        remoteStream,
        hasRemoteVideo,
        playRemoteMedia
    ]);


    /*
    =========================================================
    MUTE / CAMERA
    =========================================================
    */

    useEffect(() => {

        if (!localStream) {
            return;
        }


        localStream
            .getAudioTracks()
            .forEach(
                track => {

                    track.enabled =
                        !muted;

                }
            );


        if (isVideo) {
            localStream
                .getVideoTracks()
                .forEach(track => {
                    track.enabled = sharingScreen || !cameraOff;
                });
        }

    }, [
        localStream,
        isVideo,
        muted,
        cameraOff,
        sharingScreen
    ]);


    /*
    =========================================================
    RESET CAMERA STATE WHEN CALL TYPE CHANGES
    =========================================================
    */

    useEffect(() => {

        setCameraOff(
            type !== "video"
        );

    }, [
        type
    ]);


    /*
    =========================================================
    ACCEPT
    =========================================================
    */

    const handleAccept =
        useCallback(
            event => {

                event?.preventDefault?.();

                if (
                    typeof onAccept ===
                    "function"
                ) {
                    onAccept();
                }

            },
            [onAccept]
        );


    /*
    =========================================================
    REJECT
    =========================================================
    */

    const handleReject =
        useCallback(
            event => {

                event?.preventDefault?.();

                if (
                    typeof onReject ===
                    "function"
                ) {
                    onReject();
                }

            },
            [onReject]
        );


    /*
    =========================================================
    END
    =========================================================
    */

    const handleEnd =
        useCallback(
            event => {

                event?.preventDefault?.();

                if (
                    typeof onEnd ===
                    "function"
                ) {
                    onEnd();
                }

            },
            [onEnd]
        );


    /*
    =========================================================
    SWITCH CAMERA
    =========================================================
    */

    const handleSwitchCamera =
        useCallback(
            event => {

                event?.preventDefault?.();

                if (
                    typeof onSwitchCamera ===
                    "function"
                ) {
                    onSwitchCamera();
                }

            },
            [onSwitchCamera]
        );


    /*
    =========================================================
    TIMER
    =========================================================
    */

    const formatTime =
        useCallback(
            () => {

                const total =
                    Math.max(
                        0,
                        Number(
                            callDuration
                        ) || 0
                    );


                const minutes =
                    Math.floor(
                        total / 60
                    )
                        .toString()
                        .padStart(
                            2,
                            "0"
                        );


                const seconds =
                    (
                        total % 60
                    )
                        .toString()
                        .padStart(
                            2,
                            "0"
                        );


                return `${minutes}:${seconds}`;

            },
            [callDuration]
        );


    /*
    =========================================================
    HIDDEN
    =========================================================
    */

    if (!visible) {
        return null;
    }


    const avatarLetter =
        callerName
            ?.charAt(0)
            ?.toUpperCase() ||
        "U";


    return (

        <div
            className="messenger-call-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${isIncoming ? "Incoming" : "Active"} ${isVideo ? "video" : "voice"} call`}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background: "#0b141a",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "stretch",
                padding: 0
            }}
        >

            {/* AUDIO OUTPUT (voice calls) */}

            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                preload="auto"
                className="messenger-call-remote-audio"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none"
                }}
            />


            <div
                className="messenger-call-stage"
                style={{
                    width:
                        "min(560px,100%)",
                    height:
                        "min(720px, calc(var(--messenger-viewport-height, 100dvh) - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))))",
                    minHeight:
                        "min(480px, calc(var(--messenger-viewport-height, 100dvh) - max(16px, env(safe-area-inset-top)) - max(16px, env(safe-area-inset-bottom))))",
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 26,
                    background:
                        "linear-gradient(145deg,#111827,#1f2937)",
                    color: "#fff",
                    boxShadow:
                        "0 30px 100px rgba(0,0,0,.65)"
                }}
            >

                {/* =================================================
                    REMOTE VIDEO
                ================================================= */}

                {hasRemoteVideo ? (

                    <>
                        <video
                            className="messenger-call-remote-video"
                            ref={
                                remoteVideoRef
                            }
                            autoPlay
                            playsInline
                            controls={false}
                            muted
                            onLoadedMetadata={event => {

                                event.currentTarget
                                    .play()
                                    .catch(() => {});

                            }}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                background: "#000"
                            }}
                        />
                        <div
                            className="messenger-call-details"
                            aria-label="Call details"
                            style={{
                                position: "absolute",
                                top: 20,
                                left: 20,
                                right: 20,
                                zIndex: 2,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 14px",
                                borderRadius: 14,
                                background: "rgba(0,0,0,.48)",
                                backdropFilter: "blur(10px)"
                            }}
                        >
                            <span>{callerName}</span>
                            {isConnectedCall && (
                                <span aria-label="Call duration">
                                    {formatTime()}
                                </span>
                            )}
                        </div>
                    </>

                ) : (

                    <div
                        className="messenger-call-profile"
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection:
                                "column",
                            alignItems:
                                "center",
                            justifyContent:
                                "center"
                        }}
                    >

                        {callerAvatar ? (

                            <img
                                src={
                                    callerAvatar
                                }
                                alt=""
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius:
                                        "50%",
                                    objectFit:
                                        "cover",
                                    border:
                                        "4px solid rgba(255,255,255,.25)"
                                }}
                            />

                        ) : (

                            <div
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius:
                                        "50%",
                                    background:
                                        "linear-gradient(135deg,#1877f2,#6366f1)",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center",
                                    fontSize: 46,
                                    fontWeight: 800
                                }}
                            >
                                {avatarLetter}
                            </div>

                        )}

                        <h2
                            style={{
                                margin:
                                    "20px 0 7px"
                            }}
                        >
                            {callerName}
                        </h2>


                        <p
                            style={{
                                margin: 0,
                                opacity: .72,
                                textAlign: "center"
                            }}
                        >

                            {isIncoming

                                ? `Incoming ${
                                      displayIsVideo
                                          ? "video"
                                          : "voice"
                                  } call`

                                : isActiveCall

                                    ? `${
                                          displayIsVideo
                                              ? "Video"
                                              : "Voice"
                                      } call`

                                    : status === "ringing"

                                        ? "Ringing..."

                                        : "Calling..."}

                        </p>


                        {isConnectedCall && (

                            <span
                                style={{
                                    marginTop: 9,
                                    opacity: .85,
                                    fontSize: 18,
                                    fontWeight: 700,
                                    letterSpacing:
                                        "1px"
                                }}
                            >
                                {formatTime()}
                            </span>

                        )}

                    </div>

                )}

                {playbackBlocked && remoteStream && (
                    <button
                        type="button"
                        className="messenger-call-playback-button"
                        onClick={playRemoteMedia}
                        aria-label="Enable call audio and video"
                        style={{
                            position: "absolute",
                            zIndex: 3,
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            border: "none",
                            borderRadius: 12,
                            padding: "12px 18px",
                            background: "#1877f2",
                            color: "#fff",
                            fontWeight: 700,
                            cursor: "pointer"
                        }}
                    >
                        Tap to enable call audio
                    </button>
                )}


                {/* =================================================
                    LOCAL VIDEO
                ================================================= */}

                {hasLocalVideo &&
                localStream && (

                    <video
                        className="messenger-call-local-video"
                        ref={
                            localVideoRef
                        }
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        style={{
                            position:
                                "absolute",
                            top: 18,
                            right: 18,
                            width: 130,
                            height: 175,
                            objectFit:
                                "cover",
                            borderRadius: 16,
                            background: "#000",
                            border:
                                "2px solid rgba(255,255,255,.35)",
                            transform:
                                cameraFacing === "user"
                                    ? "scaleX(-1)"
                                    : "none"
                        }}
                    />

                )}


                {/* =================================================
                    INCOMING HEADER
                ================================================= */}

                {/* =================================================
                    CONTROLS
                ================================================= */}

                <div
                    className="messenger-call-controls"
                    style={{
                        position:
                            "absolute",
                        left: 0,
                        right: 0,
                        bottom: 28,
                        display:
                            "flex",
                        alignItems:
                            "center",
                        justifyContent:
                            "center",
                        gap: 14,
                        flexWrap:
                            "wrap"
                    }}
                >

                    {isIncoming ? (

                        <>

                            <button
                                type="button"
                                className="messenger-call-control messenger-call-reject"
                                onClick={
                                    handleReject
                                }
                                aria-label="Reject call"
                                style={{
                                    width: 62,
                                    height: 62,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#ef4444",
                                    color: "#fff",
                                    cursor:
                                        "pointer",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center"
                                }}
                            >
                                <FiPhoneOff
                                    size={25}
                                />
                            </button>


                            <button
                                type="button"
                                className="messenger-call-control messenger-call-accept"
                                onClick={
                                    handleAccept
                                }
                                aria-label="Accept call"
                                style={{
                                    width: 62,
                                    height: 62,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#22c55e",
                                    color: "#fff",
                                    cursor:
                                        "pointer",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center"
                                }}
                            >
                                <FiPhone
                                    size={25}
                                />
                            </button>

                        </>

                    ) : (

                        <>

                            <button
                                type="button"
                                className="messenger-call-control"
                                onClick={() =>
                                    setAudioOutputOpen(value => !value)
                                }
                                aria-label="Audio"
                                aria-expanded={audioOutputOpen}
                                title="Audio output"
                                style={{
                                    width: 52,
                                    height: 52,
                                    border: "none",
                                    borderRadius: "50%",
                                    background: audioOutputOpen
                                        ? "#374151"
                                        : "rgba(255,255,255,.16)",
                                    color: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <FiVolume2 size={21} />
                            </button>

                            {(isVideo || onToggleVideo) && (
                                <button
                                    type="button"
                                    className="messenger-call-control"
                                    onClick={() => onToggleVideo
                                        ? runCallAction(onToggleVideo)
                                        : setCameraOff(value => !value)
                                    }
                                    aria-label={onToggleVideo
                                        ? cameraEnabled
                                            ? "Turn camera off"
                                            : "Turn camera on"
                                        : cameraOff
                                            ? "Turn camera on"
                                            : "Turn camera off"
                                    }
                                    disabled={Boolean(onToggleVideo) && !isConnectedCall}
                                    aria-pressed={onToggleVideo
                                        ? cameraEnabled
                                        : !cameraOff
                                    }
                                    title="Video"
                                    style={{
                                        width: 52,
                                        height: 52,
                                        border: "none",
                                        borderRadius: "50%",
                                        background: (onToggleVideo
                                            ? cameraEnabled
                                            : !cameraOff)
                                            ? "#374151"
                                            : "rgba(255,255,255,.16)",
                                        color: "#fff",
                                        cursor: onToggleVideo && !isConnectedCall
                                            ? "not-allowed"
                                            : "pointer",
                                        opacity: onToggleVideo && !isConnectedCall
                                            ? 0.55
                                            : 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    {(onToggleVideo
                                        ? !cameraEnabled
                                        : cameraOff)
                                        ? <FiVideoOff size={21} />
                                        : <FiVideo size={21} />}
                                </button>
                            )}

                            <button
                                type="button"
                                className="messenger-call-control"
                                onClick={() =>
                                    setMuted(
                                        value =>
                                            !value
                                    )
                                }
                                aria-label={
                                    muted
                                        ? "Unmute"
                                        : "Mute"
                                }
                                style={{
                                    width: 52,
                                    height: 52,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "rgba(255,255,255,.16)",
                                    color: "#fff",
                                    cursor:
                                        "pointer",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center"
                                }}
                            >
                                {muted ? (
                                    <FiMicOff
                                        size={21}
                                    />
                                ) : (
                                    <FiMic
                                        size={21}
                                    />
                                )}
                            </button>

                            <button
                                type="button"
                                className="messenger-call-control"
                                onClick={() => setMoreOpen(value => !value)}
                                aria-label="More"
                                aria-expanded={moreOpen}
                                title="More call options"
                                style={{
                                    width: 52,
                                    height: 52,
                                    border: "none",
                                    borderRadius: "50%",
                                    background: moreOpen
                                        ? "#374151"
                                        : "rgba(255,255,255,.16)",
                                    color: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <FiMoreHorizontal size={21} />
                            </button>

                            {onShareScreen && (
                                <button
                                    type="button"
                                    className="messenger-call-control"
                                    onClick={() => runCallAction(onShareScreen)}
                                    aria-label={sharingScreen
                                        ? "Stop screen sharing"
                                        : "Share screen"
                                    }
                                    aria-pressed={sharingScreen}
                                    disabled={!isConnectedCall}
                                    title={sharingScreen
                                        ? "Stop screen sharing"
                                        : "Share screen"
                                    }
                                    style={{
                                        width: 52,
                                        height: 52,
                                        border: "none",
                                        borderRadius: "50%",
                                        background: sharingScreen
                                            ? "#374151"
                                            : "rgba(255,255,255,.16)",
                                        color: "#fff",
                                        cursor: !isConnectedCall
                                            ? "not-allowed"
                                            : "pointer",
                                        opacity: !isConnectedCall ? 0.55 : 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    <FiMonitor size={21} />
                                </button>
                            )}

                            <button
                                type="button"
                                className="messenger-call-control messenger-call-end"
                                onClick={
                                    handleEnd
                                }
                                aria-label="End call"
                                style={{
                                    width: 62,
                                    height: 62,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#ef4444",
                                    color: "#fff",
                                    cursor:
                                        "pointer",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center"
                                }}
                            >
                                <FiPhoneOff
                                    size={25}
                                />
                            </button>

                        </>

                    )}

                </div>

                {controlError && (
                    <p
                        className="messenger-call-error"
                        role="alert"
                        style={{
                            position: "absolute",
                            zIndex: 5,
                            left: 16,
                            right: 16,
                            bottom: 112,
                            margin: 0,
                            padding: 10,
                            borderRadius: 10,
                            background: "rgba(127,29,29,.95)",
                            color: "#fff",
                            textAlign: "center"
                        }}
                    >
                        {controlError}
                    </p>
                )}

                {moreOpen && isActiveCall && (
                    <div
                        className="messenger-call-more-menu"
                        role="menu"
                        aria-label="More call options"
                        style={{
                            position: "absolute",
                            zIndex: 5,
                            right: 18,
                            bottom: 112,
                            minWidth: 190,
                            padding: 12,
                            borderRadius: 12,
                            background: "#111827",
                            boxShadow: "0 8px 30px rgba(0,0,0,.4)"
                        }}
                    >
                        <p role="status" style={{ margin: "4px 8px 10px" }}>
                            {muted ? "Microphone muted" : "Microphone on"}
                        </p>
                        {cameraEnabled && onSwitchCamera && !sharingScreen && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => runCallAction(handleSwitchCamera)}
                                style={{
                                    display: "flex",
                                    width: "100%",
                                    gap: 8,
                                    alignItems: "center",
                                    padding: 8,
                                    border: 0,
                                    borderRadius: 8,
                                    background: "rgba(255,255,255,.12)",
                                    color: "#fff",
                                    cursor: "pointer"
                                }}
                            >
                                <FiRefreshCw aria-hidden="true" />
                                Switch camera
                            </button>
                        )}
                    </div>
                )}

                <CallAudioOutputSelector
                    active={isActiveCall && audioOutputOpen}
                    audioElementRef={remoteAudioRef}
                />

            </div>

        </div>

    );

};


export default CallModal;
