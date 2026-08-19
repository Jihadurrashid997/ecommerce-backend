// frontend/src/components/CallModal.jsx

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
    localStream,
    remoteStream,
    callDuration = 0,
    onAccept,
    onReject,
    onEnd,
    onSwitchCamera
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
        useState(
            type !== "video"
        );


    const isIncoming =
        mode === "incoming";

    const isActiveCall =
        mode === "accepted" ||
        mode === "connected";

    const isVideo =
        type === "video";


    /* =====================================================
       LOCAL VIDEO
    ===================================================== */

    useEffect(() => {

        if (
            localVideoRef.current &&
            localStream
        ) {

            localVideoRef.current.srcObject =
                localStream;

        }

    }, [
        localStream
    ]);


    /* =====================================================
       REMOTE VIDEO
    ===================================================== */

    useEffect(() => {

        if (
            remoteVideoRef.current &&
            remoteStream
        ) {

            remoteVideoRef.current.srcObject =
                remoteStream;

        }

    }, [
        remoteStream
    ]);


    /* =====================================================
       REMOTE AUDIO
    ===================================================== */

    useEffect(() => {

        if (
            !remoteAudioRef.current ||
            !remoteStream
        ) {
            return;
        }


        remoteAudioRef.current.srcObject =
            remoteStream;


        const audio =
            remoteAudioRef.current;


        const playAudio =
            async () => {

                try {

                    await audio.play();

                } catch (error) {

                    console.warn(
                        "Remote audio autoplay blocked:",
                        error
                    );

                }

            };


        playAudio();

    }, [
        remoteStream
    ]);


    /* =====================================================
       MUTE / CAMERA
    ===================================================== */

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


        localStream
            .getVideoTracks()
            .forEach(
                track => {

                    track.enabled =
                        !cameraOff;

                }
            );

    }, [
        localStream,
        muted,
        cameraOff
    ]);


    /* =====================================================
       FORMAT TIMER
    ===================================================== */

    const formatTime = () => {

        const totalSeconds =
            Math.max(
                0,
                Number(
                    callDuration
                ) || 0
            );


        const minutes =
            Math.floor(
                totalSeconds / 60
            )
                .toString()
                .padStart(
                    2,
                    "0"
                );


        const seconds =
            (
                totalSeconds % 60
            )
                .toString()
                .padStart(
                    2,
                    "0"
                );


        return `${minutes}:${seconds}`;

    };


    /* =====================================================
       HIDDEN
    ===================================================== */

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
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background:
                    "rgba(0,0,0,.84)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16
            }}
        >

            {/* =================================================
                REMOTE AUDIO
            ================================================= */}

            <audio
                ref={
                    remoteAudioRef
                }
                autoPlay
                playsInline
                controls={false}
                style={{
                    display: "none"
                }}
            />


            <div
                style={{
                    width:
                        "min(560px,100%)",
                    height:
                        "min(720px,92vh)",
                    minHeight: 480,
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 26,
                    background:
                        "linear-gradient(145deg,#111827,#1f2937)",
                    color: "#fff",
                    boxShadow:
                        "0 30px 100px rgba(0,0,0,.55)"
                }}
            >

                {/* =================================================
                    REMOTE VIDEO
                ================================================= */}

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
                                opacity: .72
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


                        {/* =================================================
                            TIMER
                        ================================================= */}

                        {isActiveCall && (

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


                {/* =================================================
                    LOCAL VIDEO
                ================================================= */}

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
                            top: 18,
                            right: 18,
                            width: 130,
                            height: 175,
                            objectFit:
                                "cover",
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
                            position:
                                "absolute",
                            top: 20,
                            left: 20,
                            right: 20,
                            textAlign:
                                "center",
                            padding: 12,
                            borderRadius: 14,
                            background:
                                "rgba(0,0,0,.28)",
                            backdropFilter:
                                "blur(8px)"
                        }}
                    >

                        <FiVolume2
                            size={22}
                        />


                        <div
                            style={{
                                marginTop: 6,
                                fontWeight: 700
                            }}
                        >
                            {callerName}
                            {" "}
                            is calling...
                        </div>

                    </div>

                )}


                {/* =================================================
                    CONTROLS
                ================================================= */}

                <div
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

                    {/* =================================================
                        INCOMING CALL
                    ================================================= */}

                    {isIncoming ? (

                        <>

                            {/* REJECT */}

                            <button
                                type="button"
                                onClick={
                                    onReject
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


                            {/* ACCEPT */}

                            <button
                                type="button"
                                onClick={
                                    onAccept
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

                            {/* =================================================
                                MUTE
                            ================================================= */}

                            <button
                                type="button"
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


                            {/* =================================================
                                CAMERA ON / OFF
                            ================================================= */}

                            {isVideo && (

                                <button
                                    type="button"
                                    onClick={() =>
                                        setCameraOff(
                                            value =>
                                                !value
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
                                        borderRadius:
                                            "50%",
                                        background:
                                            cameraOff
                                                ? "#374151"
                                                : "rgba(255,255,255,.16)",
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

                                    {cameraOff ? (

                                        <FiVideoOff
                                            size={21}
                                        />

                                    ) : (

                                        <FiVideo
                                            size={21}
                                        />

                                    )}

                                </button>

                            )}


                            {/* =================================================
                                SWITCH FRONT / BACK CAMERA
                            ================================================= */}

                            {isVideo &&
                                !cameraOff && (

                                <button
                                    type="button"
                                    onClick={
                                        onSwitchCamera
                                    }
                                    aria-label="Switch front and back camera"
                                    title="Switch camera"
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

                                    <FiRefreshCw
                                        size={21}
                                    />

                                </button>

                            )}


                            {/* =================================================
                                END CALL
                            ================================================= */}

                            <button
                                type="button"
                                onClick={
                                    onEnd
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

            </div>

        </div>

    );
};


export default CallModal;
