import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import {
    useLocation
} from "react-router-dom";

import socket, {
    connectSocket
} from "../services/socket";

import {
    createPeerConnection,
    getUserMedia,
    addLocalTracks,
    closePeerConnection,
    stopMediaStream
} from "../services/webrtc";

import CallModal from "./CallModal";


const getId = (value) => {

    if (!value) {
        return null;
    }

    if (
        typeof value === "object"
    ) {

        return String(
            value._id ||
            value.id ||
            value.userId ||
            ""
        ) || null;

    }

    return String(value);

};


const GlobalCallManager = () => {

    const location =
        useLocation();


    const [
        currentUser,
        setCurrentUser
    ] = useState(null);


    const [
        callState,
        setCallState
    ] = useState(null);


    const [
        localStream,
        setLocalStream
    ] = useState(null);


    const [
        remoteStream,
        setRemoteStream
    ] = useState(null);


    const peerRef =
        useRef(null);


    const localStreamRef =
        useRef(null);


    const remoteStreamRef =
        useRef(null);


    const callRef =
        useRef(null);


    const pendingCandidatesRef =
        useRef([]);


    /*
    =====================================================
    LOAD CURRENT USER
    =====================================================
    */

    useEffect(() => {

        try {

            const saved =
                localStorage.getItem(
                    "user"
                );

            if (!saved) {

                setCurrentUser(
                    null
                );

                return;

            }

            const parsed =
                JSON.parse(saved);

            setCurrentUser(
                parsed
            );

        } catch (error) {

            console.error(
                "Global call user error:",
                error
            );

            setCurrentUser(
                null
            );

        }

    }, [
        location.pathname
    ]);


    const currentUserId =
        getId(currentUser);


    /*
    =====================================================
    CLEANUP
    =====================================================
    */

    const cleanupCall =
        useCallback(() => {

            try {

                if (
                    callRef.current?.roomId
                ) {

                    socket.emit(
                        "leave-room",
                        callRef.current.roomId
                    );

                }

            } catch (_) {}


            closePeerConnection(
                peerRef.current
            );


            peerRef.current =
                null;


            stopMediaStream(
                localStreamRef.current
            );


            stopMediaStream(
                remoteStreamRef.current
            );


            localStreamRef.current =
                null;


            remoteStreamRef.current =
                null;


            pendingCandidatesRef.current =
                [];


            callRef.current =
                null;


            setLocalStream(
                null
            );


            setRemoteStream(
                null
            );


            setCallState(
                null
            );


        }, []);


    /*
    =====================================================
    CREATE PEER
    =====================================================
    */

    const createPeer =
        useCallback(
            (receiverId) => {

                const peer =
                    createPeerConnection({

                        onIceCandidate:
                            candidate => {

                                if (
                                    !candidate ||
                                    !receiverId ||
                                    !currentUserId
                                ) {
                                    return;
                                }


                                socket.emit(
                                    "webrtc-ice-candidate",
                                    {
                                        receiverId,
                                        callerId:
                                            currentUserId,
                                        candidate,
                                        roomId:
                                            callRef.current
                                                ?.roomId
                                    }
                                );

                            },


                        onTrack:
                            event => {

                                let stream =
                                    event.streams?.[0];


                                if (
                                    !stream
                                ) {

                                    stream =
                                        remoteStreamRef.current ||
                                        new MediaStream();

                                }


                                if (
                                    event.track &&
                                    !stream
                                        .getTracks()
                                        .some(
                                            track =>
                                                track.id ===
                                                event.track.id
                                        )
                                ) {

                                    stream.addTrack(
                                        event.track
                                    );

                                }


                                remoteStreamRef.current =
                                    stream;


                                setRemoteStream(
                                    stream
                                );

                            },


                        onConnectionStateChange:
                            state => {

                                console.log(
                                    "📞 Global call state:",
                                    state
                                );


                                if (
                                    state ===
                                    "failed"
                                ) {

                                    setTimeout(
                                        () => {

                                            if (
                                                peerRef.current &&
                                                peerRef.current
                                                    .connectionState ===
                                                    "failed"
                                            ) {

                                                cleanupCall();

                                            }

                                        },
                                        5000
                                    );

                                }

                            }

                    });


                peerRef.current =
                    peer;


                if (
                    localStreamRef.current
                ) {

                    addLocalTracks(
                        peer,
                        localStreamRef.current
                    );

                }


                return peer;

            },
            [
                cleanupCall,
                currentUserId
            ]
        );


    /*
    =====================================================
    ACCEPT GLOBAL CALL
    =====================================================
    */

    const acceptCall =
        useCallback(
            async () => {

                const call =
                    callRef.current ||
                    callState;


                if (!call) {
                    return;
                }


                try {

                    const stream =
                        await getUserMedia({

                            audio: true,

                            video:
                                call.type ===
                                "video"

                        });


                    localStreamRef.current =
                        stream;


                    setLocalStream(
                        stream
                    );


                    callRef.current = {

                        ...call,

                        accepted:
                            true

                    };


                    if (
                        call.roomId
                    ) {

                        socket.emit(
                            "join-room",
                            call.roomId
                        );

                    }


                    /*
                    IMPORTANT:
                    Create peer BEFORE sending
                    accept-call so the offer can
                    be handled immediately.
                    */

                    createPeer(
                        getId(
                            call.callerId
                        )
                    );


                    socket.emit(
                        "accept-call",
                        {

                            roomId:
                                call.roomId,

                            callerId:
                                getId(
                                    call.callerId
                                ),

                            receiverId:
                                currentUserId,

                            type:
                                call.type

                        }
                    );


                    setCallState(
                        previous => ({

                            ...(previous || {}),
                            ...call,

                            mode:
                                "accepted",

                            accepted:
                                true

                        })
                    );


                } catch (error) {

                    console.error(
                        "Global accept call error:",
                        error
                    );


                    try {

                        socket.emit(
                            "reject-call",
                            {

                                callerId:
                                    getId(
                                        call.callerId
                                    ),

                                receiverId:
                                    currentUserId,

                                roomId:
                                    call.roomId

                            }
                        );

                    } catch (_) {}


                    cleanupCall();

                }

            },
            [
                callState,
                cleanupCall,
                createPeer,
                currentUserId
            ]
        );


    /*
    =====================================================
    REJECT
    =====================================================
    */

    const rejectCall =
        useCallback(() => {

            const call =
                callRef.current ||
                callState;


            if (
                call?.callerId
            ) {

                socket.emit(
                    "reject-call",
                    {

                        callerId:
                            getId(
                                call.callerId
                            ),

                        receiverId:
                            currentUserId,

                        roomId:
                            call.roomId

                    }
                );

            }


            cleanupCall();

        }, [
            callState,
            cleanupCall,
            currentUserId
        ]);


    /*
    =====================================================
    END
    =====================================================
    */

    const endCall =
        useCallback(() => {

            const call =
                callRef.current ||
                callState;


            if (
                call?.roomId
            ) {

                socket.emit(
                    "end-call",
                    {

                        roomId:
                            call.roomId

                    }
                );

            }


            cleanupCall();

        }, [
            callState,
            cleanupCall
        ]);


    /*
    =====================================================
    GLOBAL SOCKET LISTENER
    =====================================================
    */

    useEffect(() => {

        /*
         * Messenger.jsx already owns the
         * complete call system on /messenger.
         *
         * Therefore GlobalCallManager must
         * stay silent there to avoid duplicate
         * WebRTC listeners.
         */

        if (
            location.pathname ===
            "/messenger"
        ) {

            return undefined;

        }


        if (
            !currentUserId
        ) {

            return undefined;

        }


        connectSocket(
            currentUserId
        );


        /*
        =================================================
        INCOMING CALL
        =================================================
        */

        const onIncomingCall =
            data => {

                if (
                    !data ||
                    !data.callerId
                ) {
                    return;
                }


                /*
                 * Ignore self-call
                 */

                if (
                    getId(
                        data.callerId
                    ) ===
                    currentUserId
                ) {

                    return;

                }


                /*
                 * If already in a call,
                 * tell caller that we're busy.
                 */

                if (
                    callRef.current
                ) {

                    socket.emit(
                        "call-busy",
                        {

                            callerId:
                                getId(
                                    data.callerId
                                ),

                            receiverId:
                                currentUserId,

                            roomId:
                                data.roomId

                        }
                    );

                    return;

                }


                const incoming = {

                    ...data,

                    mode:
                        "incoming"

                };


                callRef.current =
                    incoming;


                if (
                    data.roomId
                ) {

                    socket.emit(
                        "join-room",
                        data.roomId
                    );

                }


                setCallState(
                    incoming
                );


                /*
                 * Optional browser notification
                 */

                try {

                    if (
                        "Notification" in
                        window
                    ) {

                        if (
                            Notification.permission ===
                            "granted"
                        ) {

                            new Notification(
                                data.callerName ||
                                "Incoming call",
                                {

                                    body:
                                        `${
                                            data.type ===
                                            "video"
                                                ? "Video"
                                                : "Voice"
                                        } call incoming`

                                }
                            );

                        }

                    }

                } catch (_) {}

            };


        /*
        =================================================
        CALL REJECTED
        =================================================
        */

        const onCallRejected =
            () => {

                cleanupCall();

            };


        /*
        =================================================
        CALL ENDED
        =================================================
        */

        const onCallEnded =
            () => {

                cleanupCall();

            };


        /*
        =================================================
        CALL BUSY
        =================================================
        */

        const onCallBusy =
            () => {

                cleanupCall();

            };


        /*
        =================================================
        WEBRTC OFFER
        =================================================
        */

        const onOffer =
            async data => {

                if (
                    !data?.offer
                ) {
                    return;
                }


                const call =
                    callRef.current;


                /*
                 * Only handle offers belonging
                 * to the current global call.
                 */

                if (
                    !call ||
                    getId(
                        call.callerId
                    ) !==
                    getId(
                        data.callerId
                    )
                ) {

                    return;

                }


                try {

                    const peer =
                        peerRef.current ||
                        createPeer(
                            getId(
                                data.callerId
                            )
                        );


                    if (
                        !peer
                    ) {
                        return;
                    }


                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            data.offer
                        )
                    );


                    /*
                     * Flush ICE candidates
                     */

                    const pending =
                        pendingCandidatesRef.current;


                    pendingCandidatesRef.current =
                        [];


                    for (
                        const candidate
                        of pending
                    ) {

                        try {

                            await peer.addIceCandidate(
                                new RTCIceCandidate(
                                    candidate
                                )
                            );

                        } catch (
                            error
                        ) {

                            console.error(
                                "Global pending ICE error:",
                                error
                            );

                        }

                    }


                    /*
                     * Make sure local tracks
                     * exist before answer.
                     */

                    if (
                        localStreamRef.current
                    ) {

                        addLocalTracks(
                            peer,
                            localStreamRef.current
                        );

                    }


                    const answer =
                        await peer.createAnswer();


                    await peer.setLocalDescription(
                        answer
                    );


                    socket.emit(
                        "webrtc-answer",
                        {

                            receiverId:
                                getId(
                                    data.callerId
                                ),

                            callerId:
                                currentUserId,

                            roomId:
                                data.roomId,

                            answer

                        }
                    );


                    setCallState(
                        previous => ({

                            ...(previous || {}),
                            ...call,

                            ...data,

                            mode:
                                "accepted"

                        })
                    );


                } catch (error) {

                    console.error(
                        "Global WebRTC offer error:",
                        error
                    );

                }

            };


        /*
        =================================================
        ICE CANDIDATE
        =================================================
        */

        const onIceCandidate =
            async data => {

                if (
                    !data?.candidate
                ) {
                    return;
                }


                const peer =
                    peerRef.current;


                if (
                    !peer
                ) {

                    pendingCandidatesRef.current
                        .push(
                            data.candidate
                        );

                    return;

                }


                try {

                    if (
                        peer.remoteDescription
                    ) {

                        await peer.addIceCandidate(
                            new RTCIceCandidate(
                                data.candidate
                            )
                        );

                    } else {

                        pendingCandidatesRef.current
                            .push(
                                data.candidate
                            );

                    }

                } catch (error) {

                    console.error(
                        "Global ICE error:",
                        error
                    );

                }

            };


        socket.on(
            "incoming-call",
            onIncomingCall
        );


        socket.on(
            "call-rejected",
            onCallRejected
        );


        socket.on(
            "call-ended",
            onCallEnded
        );


        socket.on(
            "call-busy",
            onCallBusy
        );


        socket.on(
            "webrtc-offer",
            onOffer
        );


        socket.on(
            "webrtc-ice-candidate",
            onIceCandidate
        );


        /*
        =================================================
        CLEAN LISTENERS
        =================================================
        */

        return () => {

            socket.off(
                "incoming-call",
                onIncomingCall
            );


            socket.off(
                "call-rejected",
                onCallRejected
            );


            socket.off(
                "call-ended",
                onCallEnded
            );


            socket.off(
                "call-busy",
                onCallBusy
            );


            socket.off(
                "webrtc-offer",
                onOffer
            );


            socket.off(
                "webrtc-ice-candidate",
                onIceCandidate
            );

        };

    }, [
        currentUserId,
        location.pathname,
        cleanupCall,
        createPeer
    ]);


    /*
    =====================================================
    DO NOT RENDER ON MESSENGER
    =====================================================
    */

    if (
        !currentUserId ||
        location.pathname ===
            "/messenger"
    ) {

        return null;

    }


    /*
    =====================================================
    RENDER CALL MODAL
    =====================================================
    */

    return (

        <CallModal

            visible={
                Boolean(
                    callState
                )
            }

            type={
                callState?.type ||
                "audio"
            }

            mode={
                callState?.mode ||
                "incoming"
            }

            callerName={
                callState?.callerName ||
                "User"
            }

            callerAvatar={
                callState?.callerAvatar ||
                ""
            }

            localStream={
                localStream
            }

            remoteStream={
                remoteStream
            }

            onAccept={
                acceptCall
            }

            onReject={
                rejectCall
            }

            onEnd={
                endCall
            }

        />

    );

};


export default GlobalCallManager;
