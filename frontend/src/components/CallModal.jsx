import React, {
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
    FiVolume2
} from "react-icons/fi";

const CallModal = ({
    visible,
    type = "audio",
    mode = "outgoing",
    callerName = "User",
    callerAvatar = "",
    localStream,
    remoteStream,
    onAccept,
    onReject,
    onEnd
}) => {
    const localVideoRef =
        useRef(null);

    const remoteVideoRef =
        useRef(null);

    const [muted, setMuted] =
        useState(false);

    const [cameraOff, setCameraOff] =
        useState(type !== "video");

    const [seconds, setSeconds] =
        useState(0);

    useEffect(() => {
        if (!visible) {
            setSeconds(0);
            return undefined;
        }

        const timer =
            setInterval(() => {
                setSeconds(
                    (value) =>
                        value + 1
                );
            }, 1000);

        return () =>
            clearInterval(timer);
    }, [visible]);

    useEffect(() => {
        if (
            localVideoRef.current &&
            localStream
        ) {
            localVideoRef.current.srcObject =
                localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (
            remoteVideoRef.current &&
            remoteStream
        ) {
            remoteVideoRef.current.srcObject =
                remoteStream;
        }
    }, [remoteStream]);

    useEffect(() => {
        if (!localStream) {
            return;
        }

        localStream
            .getAudioTracks()
            .forEach(
                (track) => {
                    track.enabled =
                        !muted;
                }
            );

        localStream
            .getVideoTracks()
            .forEach(
                (track) => {
                    track.enabled =
                        !cameraOff;
                }
            );
    }, [
        localStream,
        muted,
        cameraOff
    ]);

    if (!visible) {
        return null;
    }

    const formatTime = () => {
        const minutes =
            Math.floor(
                seconds / 60
            )
                .toString()
                .padStart(2, "0");

        const remaining =
            (seconds % 60)
                .toString()
                .padStart(2, "0");

        return `${minutes}:${remaining}`;
    };

    const isIncoming =
        mode === "incoming";

    const isVideo =
        type === "video";

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background:
                    "rgba(0,0,0,.82)",
                display: "flex",
                alignItems:
                    "center",
                justifyContent:
                    "center",
                padding: 20
            }}
        >
            <div
                style={{
                    width: "min(520px, 100%)",
                    minHeight: 500,
                    borderRadius: 24,
                    overflow: "hidden",
                    position: "relative",
                    background:
                        "linear-gradient(145deg,#111827,#1f2937)",
                    color: "#fff",
                    boxShadow:
                        "0 30px 100px rgba(0,0,0,.5)"
                }}
            >
                {isVideo &&
                remoteStream ? (
                    <video
                        ref={
                            remoteVideoRef
                        }
                        autoPlay
                        playsInline
                        style={{
                            width: "100%",
                            height: "100%",
                            minHeight: 500,
                            objectFit:
                                "cover",
                            background:
                                "#000"
                        }}
                    />
                ) : (
                    <div
                        style={{
                            minHeight: 500,
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
                                    width: 110,
                                    height: 110,
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
                                    width: 110,
                                    height: 110,
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#1877f2",
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center",
                                    fontSize: 42,
                                    fontWeight: 800
                                }}
                            >
                                {callerName
                                    ?.charAt(
                                        0
                                    )
                                    ?.toUpperCase()}
                            </div>
                        )}

                        <h2
                            style={{
                                margin:
                                    "20px 0 6px"
                            }}
                        >
                            {callerName}
                        </h2>

                        <p
                            style={{
                                margin: 0,
                                opacity: .75
                            }}
                        >
                            {isIncoming
                                ? `Incoming ${
                                      isVideo
                                          ? "video"
                                          : "voice"
                                  } call`
                                : `${
                                      isVideo
                                          ? "Video"
                                          : "Voice"
                                  } call`}
                        </p>

                        {!isIncoming && (
                            <span
                                style={{
                                    marginTop:
                                        10,
                                    opacity:
                                        .65
                                }}
                            >
                                {formatTime()}
                            </span>
                        )}
                    </div>
                )}

                {isVideo &&
                    localStream && (
                        <video
                            ref={
                                localVideoRef
                            }
                            autoPlay
                            muted
                            playsInline
                            style={{
                                position:
                                    "absolute",
                                right: 18,
                                top: 18,
                                width: 125,
                                height: 175,
                                objectFit:
                                    "cover",
                                borderRadius:
                                    14,
                                background:
                                    "#000",
                                border:
                                    "2px solid rgba(255,255,255,.3)"
                            }}
                        />
                    )}

                {isIncoming && (
                    <div
                        style={{
                            position:
                                "absolute",
                            top: 20,
                            left: 20,
                            right: 20,
                            textAlign:
                                "center"
                        }}
                    >
                        <FiVolume2
                            size={22}
                        />

                        <div
                            style={{
                                marginTop:
                                    8,
                                fontWeight:
                                    700
                            }}
                        >
                            {callerName} is
                            calling...
                        </div>
                    </div>
                )}

                {!isIncoming && (
                    <div
                        style={{
                            position:
                                "absolute",
                            top: 20,
                            left: 20,
                            padding:
                                "7px 12px",
                            borderRadius:
                                20,
                            background:
                                "rgba(0,0,0,.4)"
                        }}
                    >
                        {formatTime()}
                    </div>
                )}

                <div
                    style={{
                        position:
                            "absolute",
                        bottom: 28,
                        left: 0,
                        right: 0,
                        display:
                            "flex",
                        justifyContent:
                            "center",
                        gap: 14
                    }}
                >
                    {isIncoming ? (
                        <>
                            <button
                                onClick={
                                    onReject
                                }
                                style={{
                                    width: 58,
                                    height: 58,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#ef4444",
                                    color:
                                        "#fff",
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
                                    size={23}
                                />
                            </button>

                            <button
                                onClick={
                                    onAccept
                                }
                                style={{
                                    width: 58,
                                    height: 58,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#22c55e",
                                    color:
                                        "#fff",
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
                                <FiVolume2
                                    size={23}
                                />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() =>
                                    setMuted(
                                        (value) =>
                                            !value
                                    )
                                }
                                style={{
                                    width: 50,
                                    height: 50,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "rgba(255,255,255,.16)",
                                    color:
                                        "#fff",
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
                                    <FiMicOff />
                                ) : (
                                    <FiMic />
                                )}
                            </button>

                            {isVideo && (
                                <button
                                    onClick={() =>
                                        setCameraOff(
                                            (
                                                value
                                            ) =>
                                                !value
                                        )
                                    }
                                    style={{
                                        width: 50,
                                        height: 50,
                                        border: "none",
                                        borderRadius:
                                            "50%",
                                        background:
                                            "rgba(255,255,255,.16)",
                                        color:
                                            "#fff",
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
                                    {cameraOff ? (
                                        <FiVideoOff />
                                    ) : (
                                        <FiVideo />
                                    )}
                                </button>
                            )}

                            <button
                                onClick={
                                    onEnd
                                }
                                style={{
                                    width: 58,
                                    height: 58,
                                    border: "none",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#ef4444",
                                    color:
                                        "#fff",
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
                                    size={23}
                                />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallModal;
