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
    FiRefreshCw
} from "react-icons/fi";


const CallModal = ({
    visible,
    type = "audio",
    mode = "outgoing",
    callerName = "User",
    callerAvatar = "",
    localStream = null,
    remoteStream = null,
    callDuration = 0,
    onAccept,
    onReject,
    onEnd,
    onSwitchCamera
}) => {

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);

    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(
        type !== "video"
    );

    const isIncoming = mode === "incoming";

    const isActiveCall =
        mode === "accepted" ||
        mode === "connected";

    const isVideo = type === "video";


    /*
    =========================================================
    ATTACH LOCAL VIDEO
    =========================================================
    */

    useEffect(() => {

        const video = localVideoRef.current;

        if (!video || !localStream || !isVideo) {
            return;
        }

        video.srcObject = localStream;

        video.muted = true;
        video.playsInline = true;

        const start = async () => {
            try {
                await video.play();
            } catch (error) {
                console.warn(
                    "Local video play failed:",
                    error
                );
            }
        };

        start();

        return () => {
            if (video.srcObject === localStream) {
                video.srcObject = null;
            }
        };

    }, [localStream, isVideo]);


    /*
    =========================================================
    ATTACH REMOTE AUDIO / VIDEO
    =========================================================
    */

    useEffect(() => {

        if (!remoteStream) {
            return;
        }

        const video = remoteVideoRef.current;
        const audio = remoteAudioRef.current;


        /*
        -------------------------
        VIDEO CALL
        -------------------------
        */

        if (isVideo && video) {

            video.srcObject = remoteStream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = false;

            const play = async () => {
                try {
                    await video.play();
                } catch (error) {
                    console.warn(
                        "Remote video autoplay failed:",
                        error
                    );
                }
            };

            play();
        }


        /*
        -------------------------
        AUDIO CALL
        -------------------------
        */

        if (!isVideo && audio) {

            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.playsInline = true;
            audio.muted = false;
            audio.volume = 1;

            const play = async () => {
                try {
                    await audio.play();
                } catch (error) {
                    console.warn(
                        "Remote audio autoplay failed:",
                        error
                    );
                }
            };

            play();
        }


        return () => {

            if (
                video &&
                video.srcObject === remoteStream
            ) {
                video.srcObject = null;
            }

            if (
                audio &&
                audio.srcObject === remoteStream
            ) {
                audio.srcObject = null;
            }

        };

    }, [remoteStream, isVideo]);


    /*
    =========================================================
    REMOTE TRACK ADDED LATER
    =========================================================
    */

    useEffect(() => {

        if (!remoteStream) {
            return;
        }

        const handleTrack = () => {

            const video = remoteVideoRef.current;
            const audio = remoteAudioRef.current;


            if (isVideo && video) {

                video.srcObject = remoteStream;

                video.play()
                    .catch(error => {
                        console.warn(
                            "Remote video play error:",
                            error
                        );
                    });
            }


            if (!isVideo && audio) {

                audio.srcObject = remoteStream;
                audio.volume = 1;

                audio.play()
                    .catch(error => {
                        console.warn(
                            "Remote audio play error:",
                            error
                        );
                    });
            }

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

    }, [remoteStream, isVideo]);


    /*
    =========================================================
    MUTE
    =========================================================
    */

    useEffect(() => {

        if (!localStream) {
            return;
        }

        localStream
            .getAudioTracks()
            .forEach(track => {
                track.enabled = !muted;
            });

    }, [localStream, muted]);


    /*
    =========================================================
    CAMERA
    =========================================================
    */

    useEffect(() => {

        if (!localStream) {
            return;
        }

        localStream
            .getVideoTracks()
            .forEach(track => {
                track.enabled = !cameraOff;
            });

    }, [localStream, cameraOff]);


    /*
    =========================================================
    RESET STATE WHEN CALL TYPE CHANGES
    =========================================================
    */

    useEffect(() => {

        setCameraOff(
            type !== "video"
        );

        setMuted(false);

    }, [type]);


    /*
    =========================================================
    ACCEPT
    =========================================================
    */

    const handleAccept = useCallback(
        event => {

            event?.preventDefault?.();

            if (typeof onAccept === "function") {
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

    const handleReject = useCallback(
        event => {

            event?.preventDefault?.();

            if (typeof onReject === "function") {
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

    const handleEnd = useCallback(
        event => {

            event?.preventDefault?.();

            if (typeof onEnd === "function") {
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

    const handleSwitchCamera = useCallback(
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

    const formatTime = useCallback(() => {

        const total = Math.max(
            0,
            Math.floor(
                Number(callDuration) || 0
            )
        );

        const minutes = Math.floor(
            total / 60
        )
            .toString()
            .padStart(2, "0");

        const seconds = (
            total % 60
        )
            .toString()
            .padStart(2, "0");

        return `${minutes}:${seconds}`;

    }, [callDuration]);


    if (!visible) {
        return null;
    }


    const avatarLetter =
        callerName
            ?.charAt(0)
            ?.toUpperCase() || "U";


    return (

        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background: "rgba(0,0,0,.88)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16
            }}
        >

            {/* REMOTE AUDIO */}

            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                controls={false}
                preload="auto"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: "none"
                }}
            />


            <div
                style={{
                    width: "min(560px,100%)",
                    height: "min(720px,92vh)",
                    minHeight: 480,
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

                {isVideo && remoteStream ? (

                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={false}
                        controls={false}
                        onCanPlay={event => {
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

                ) : (

                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >

                        {callerAvatar ? (

                            <img
                                src={callerAvatar}
                                alt=""
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    border:
                                        "4px solid rgba(255,255,255,.25)"
                                }}
                            />

                        ) : (

                            <div
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: "50%",
                                    background:
                                        "linear-gradient(135deg,#1877f2,#6366f1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 46,
                                    fontWeight: 800
                                }}
                            >
                                {avatarLetter}
                            </div>

                        )}


                        <h2
                            style={{
                                margin: "20px 0 7px"
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
                                      isVideo
                                          ? "video"
                                          : "voice"
                                  } call`

                                : isActiveCall

                                    ? `${
                                          isVideo
                                              ? "Video"
                                              : "Voice"
                                      } call`

                                    : "Calling..."}

                        </p>


                        {isActiveCall && (

                            <span
                                style={{
                                    marginTop: 9,
                                    opacity: .85,
                                    fontSize: 18,
                                    fontWeight: 700,
                                    letterSpacing: "1px"
                                }}
                            >
                                {formatTime()}
                            </span>

                        )}

                    </div>

                )}


                {/* =================================================
                    LOCAL VIDEO
                ================================================= */}

                {isVideo && localStream && (

                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        style={{
                            position: "absolute",
                            top: 18,
                            right: 18,
                            width: 130,
                            height: 175,
                            objectFit: "cover",
                            borderRadius: 16,
                            background: "#000",
                            border:
                                "2px solid rgba(255,255,255,.35)"
                        }}
                    />

                )}


                {/* =================================================
                    INCOMING HEADER
                ================================================= */}

                {isIncoming && (

                    <div
                        style={{
                            position: "absolute",
                            top: 20,
                            left: 20,
                            right: 20,
                            textAlign: "center",
                            padding: 12,
                            borderRadius: 14,
                            background:
                                "rgba(0,0,0,.35)",
                            backdropFilter:
                                "blur(10px)"
                        }}
                    >

                        <FiVolume2 size={22} />

                        <div
                            style={{
                                marginTop: 6,
                                fontWeight: 700
                            }}
                        >
                            {callerName} is calling...
                        </div>

                    </div>

                )}


                {/* =================================================
                    CONTROLS
                ================================================= */}

                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 14,
                        flexWrap: "wrap"
                    }}
                >

                    {isIncoming ? (

                        <>

                            <button
                                type="button"
                                onClick={handleReject}
                                aria-label="Reject call"
                                style={{
                                    width: 62,
                                    height: 62,
                                    border: "none",
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                    color: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <FiPhoneOff size={25} />
                            </button>


                            <button
                                type="button"
                                onClick={handleAccept}
                                aria-label="Accept call"
                                style={{
                                    width: 62,
                                    height: 62,
                                    border: "none",
                                    borderRadius: "50%",
                                    background: "#22c55e",
                                    color: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <FiPhone size={25} />
                            </button>

                        </>

                    ) : (

                        <>

                            <button
                                type="button"
                                onClick={() =>
                                    setMuted(
                                        value => !value
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
                                    borderRadius: "50%",
                                    background:
                                        "rgba(255,255,255,.16)",
                                    color: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                {muted ? (
                                    <FiMicOff size={21} />
                                ) : (
                                    <FiMic size={21} />
                                )}
                            </button>


                            {isVideo && (

                                <button
                                    type="button"
                                    onClick={() =>
                                        setCameraOff(
                                            value => !value
                                        )
                                    }
                                    aria-label={
                                        cameraOff
                                            ? "Turn camera on"
                                            : "Turn camera off"
                                    }
                                    style={{
                                        width: 52,
                                        height: 52,
                                        border: "none",
                                        borderRadius: "50%",
                                        background:
                                            cameraOff
                                                ? "#374151"
                                                : "rgba(255,255,255,.16)",
                                        color: "#fff",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    {cameraOff ? (
                                        <FiVideoOff size={21} />
                                    ) : (
                                        <FiVideo size={21} />
                                    )}
                                </button>

                            )}


                            {isVideo &&
                            !cameraOff && (

                                <button
                                    type="button"
                                    onClick={
                                        handleSwitchCamera
                                    }
                                    aria-label="Switch camera"
                                    title="Switch camera"
                                    style={{
                                        width: 52,
                                        height: 52,
                                        border: "none",
                                        borderRadius: "50%",
                                        background:
                                            "rgba(255,255,255,.16)",
                                        color: "#fff",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    <FiRefreshCw size={21} />
                                </button>

                            )}


                            <button
                                type="button"
                                onClick={handleEnd}
                                aria-label="End call"
                                style={{
                                    width: 62,
                                    height: 62,
                                    border: "none",
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                    color: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <FiPhoneOff size={25} />
                            </button>

                        </>

                    )}

                </div>

            </div>

        </div>
    );
};


export default CallModal;
