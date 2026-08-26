/*
=========================================================
WEBRTC SERVICE
=========================================================

Responsibilities:

1. Create RTCPeerConnection
2. Handle ICE candidates
3. Handle remote tracks
4. Get microphone/camera
5. Add local tracks
6. Replace camera/audio tracks
7. Close peer safely
8. Stop media streams

TURN can be supplied through Vite environment variables:

VITE_TURN_URL
VITE_TURN_USERNAME
VITE_TURN_CREDENTIAL

Example:

VITE_TURN_URL=turn:your-server:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password

STUN works for many networks.
TURN is required for networks where direct P2P
connection is impossible.
=========================================================
*/


const buildIceServers = () => {

    const servers = [

        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302"
            ]
        }

    ];


    const turnUrl =
        typeof import.meta !== "undefined"
            ? import.meta.env?.VITE_TURN_URL
            : undefined;


    const turnUsername =
        typeof import.meta !== "undefined"
            ? import.meta.env?.VITE_TURN_USERNAME
            : undefined;


    const turnCredential =
        typeof import.meta !== "undefined"
            ? import.meta.env?.VITE_TURN_CREDENTIAL
            : undefined;


    if (
        turnUrl &&
        turnUsername &&
        turnCredential
    ) {

        servers.push({

            urls:
                turnUrl,

            username:
                turnUsername,

            credential:
                turnCredential

        });

    }


    return servers;

};


const ICE_SERVERS = {

    iceServers:
        buildIceServers(),

    iceCandidatePoolSize:
        10,

    bundlePolicy:
        "max-bundle",

    rtcpMuxPolicy:
        "require",

    iceTransportPolicy:
        "all"

};


/*
=========================================================
CREATE PEER CONNECTION
=========================================================
*/

export const createPeerConnection = ({
    onIceCandidate,
    onTrack,
    onConnectionStateChange,
    onIceConnectionStateChange,
    onNegotiationNeeded
} = {}) => {

    if (
        typeof RTCPeerConnection ===
        "undefined"
    ) {

        throw new Error(
            "WebRTC is not supported by this browser."
        );

    }


    const peer =
        new RTCPeerConnection(
            ICE_SERVERS
        );


    /*
    -----------------------------------------------------
    ICE CANDIDATE
    -----------------------------------------------------
    */

    peer.onicecandidate =
        event => {

            if (
                !event.candidate
            ) {
                return;
            }


            if (
                typeof onIceCandidate ===
                "function"
            ) {

                onIceCandidate(
                    event.candidate
                );

            }

        };


    /*
    -----------------------------------------------------
    REMOTE TRACK
    -----------------------------------------------------
    */

    peer.ontrack =
        event => {

            if (
                typeof onTrack !==
                "function"
            ) {
                return;
            }


            onTrack(
                event
            );

        };


    /*
    -----------------------------------------------------
    CONNECTION STATE
    -----------------------------------------------------
    */

    peer.onconnectionstatechange =
        () => {

            if (
                typeof onConnectionStateChange ===
                "function"
            ) {

                onConnectionStateChange(
                    peer.connectionState,
                    peer
                );

            }

        };


    /*
    -----------------------------------------------------
    ICE CONNECTION STATE
    -----------------------------------------------------
    */

    peer.oniceconnectionstatechange =
        () => {

            if (
                typeof onIceConnectionStateChange ===
                "function"
            ) {

                onIceConnectionStateChange(
                    peer.iceConnectionState,
                    peer
                );

            }

        };


    /*
    -----------------------------------------------------
    NEGOTIATION
    -----------------------------------------------------
    */

    peer.onnegotiationneeded =
        async () => {

            if (
                typeof onNegotiationNeeded !==
                "function"
            ) {
                return;
            }


            try {

                await onNegotiationNeeded(
                    peer
                );

            } catch (error) {

                console.error(
                    "WebRTC negotiation error:",
                    error
                );

            }

        };


    return peer;

};


/*
=========================================================
GET USER MEDIA
=========================================================
*/

export const getUserMedia =
    async ({
        audio = true,
        video = false,
        facingMode = "user"
    } = {}) => {

        if (
            typeof navigator ===
            "undefined" ||
            !navigator.mediaDevices ||
            typeof navigator.mediaDevices.getUserMedia !==
                "function"
        ) {

            throw new Error(
                "Microphone/camera access is not available. Use HTTPS or localhost and a supported browser."
            );

        }


        const constraints = {

            audio:
                audio
                    ? {
                          echoCancellation:
                              true,

                          noiseSuppression:
                              true,

                          autoGainControl:
                              true,

                          channelCount:
                              1,

                          sampleRate:
                              48000
                      }
                    : false,


            video:
                video
                    ? {
                          facingMode: {
                              ideal:
                                  facingMode
                          },

                          width: {
                              ideal:
                                  1280,
                              max:
                                  1920
                          },

                          height: {
                              ideal:
                                  720,
                              max:
                                  1080
                          },

                          frameRate: {
                              ideal:
                                  30,
                              max:
                                  30
                          }
                      }
                    : false

        };


        try {

            return await navigator
                .mediaDevices
                .getUserMedia(
                    constraints
                );

        } catch (error) {

            /*
            Some devices reject advanced
            audio constraints. Retry with
            simple constraints.
            */

            if (
                audio &&
                error?.name ===
                    "OverconstrainedError"
            ) {

                return navigator
                    .mediaDevices
                    .getUserMedia({

                        audio: true,

                        video:
                            video
                                ? {
                                      facingMode: {
                                          ideal:
                                              facingMode
                                      }
                                  }
                                : false

                    });

            }


            throw error;

        }

    };


/*
=========================================================
ADD LOCAL TRACKS
=========================================================
*/

export const addLocalTracks =
    (
        peer,
        stream
    ) => {

        if (
            !peer ||
            !stream
        ) {
            return;
        }


        const existingSenders =
            peer.getSenders();


        stream
            .getTracks()
            .forEach(
                track => {

                    const alreadyAdded =
                        existingSenders.some(
                            sender =>
                                sender.track?.id ===
                                track.id
                        );


                    if (
                        alreadyAdded
                    ) {
                        return;
                    }


                    peer.addTrack(
                        track,
                        stream
                    );

                }
            );

    };


/*
=========================================================
REPLACE VIDEO TRACK
=========================================================
*/

export const replaceVideoTrack =
    async (
        peer,
        track
    ) => {

        if (
            !peer ||
            !track
        ) {
            return false;
        }


        const sender =
            peer
                .getSenders()
                .find(
                    item =>
                        item.track?.kind ===
                        "video"
                );


        if (!sender) {

            console.warn(
                "WebRTC video sender not found."
            );

            return false;

        }


        try {

            await sender.replaceTrack(
                track
            );

            return true;

        } catch (error) {

            console.error(
                "WebRTC video replace error:",
                error
            );

            return false;

        }

    };


/*
=========================================================
REPLACE AUDIO TRACK
=========================================================
*/

export const replaceAudioTrack =
    async (
        peer,
        track
    ) => {

        if (
            !peer ||
            !track
        ) {
            return false;
        }


        const sender =
            peer
                .getSenders()
                .find(
                    item =>
                        item.track?.kind ===
                        "audio"
                );


        if (!sender) {

            console.warn(
                "WebRTC audio sender not found."
            );

            return false;

        }


        try {

            await sender.replaceTrack(
                track
            );

            return true;

        } catch (error) {

            console.error(
                "WebRTC audio replace error:",
                error
            );

            return false;

        }

    };


/*
=========================================================
ADD ICE CANDIDATE
=========================================================
*/

export const addIceCandidate =
    async (
        peer,
        candidate
    ) => {

        if (
            !peer ||
            !candidate
        ) {
            return false;
        }


        try {

            const normalized =
                candidate instanceof
                RTCIceCandidate
                    ? candidate
                    : new RTCIceCandidate(
                          candidate
                      );


            await peer
                .addIceCandidate(
                    normalized
                );


            return true;

        } catch (error) {

            console.error(
                "WebRTC ICE candidate error:",
                error
            );

            return false;

        }

    };


/*
=========================================================
GET VIDEO SENDER
=========================================================
*/

export const getVideoSender =
    peer => {

        if (!peer) {
            return null;
        }


        return peer
            .getSenders()
            .find(
                sender =>
                    sender.track?.kind ===
                    "video"
            ) || null;

    };


/*
=========================================================
GET AUDIO SENDER
=========================================================
*/

export const getAudioSender =
    peer => {

        if (!peer) {
            return null;
        }


        return peer
            .getSenders()
            .find(
                sender =>
                    sender.track?.kind ===
                    "audio"
            ) || null;

    };


/*
=========================================================
CLOSE PEER
=========================================================
*/

export const closePeerConnection =
    peer => {

        if (!peer) {
            return;
        }


        try {

            peer.onicecandidate =
                null;

            peer.ontrack =
                null;

            peer.onconnectionstatechange =
                null;

            peer.oniceconnectionstatechange =
                null;

            peer.onnegotiationneeded =
                null;


            peer
                .getSenders()
                .forEach(
                    sender => {

                        try {

                            sender.replaceTrack(
                                null
                            );

                        } catch (_) {}

                    }
                );


            peer.close();

        } catch (error) {

            console.error(
                "WebRTC close error:",
                error
            );

        }

    };


/*
=========================================================
STOP MEDIA STREAM
=========================================================
*/

export const stopMediaStream =
    stream => {

        if (!stream) {
            return;
        }


        stream
            .getTracks()
            .forEach(
                track => {

                    try {

                        track.stop();

                    } catch (error) {

                        console.error(
                            "Media track stop error:",
                            error
                        );

                    }

                }
            );

    };


export default {

    createPeerConnection,

    getUserMedia,

    addLocalTracks,

    replaceVideoTrack,

    replaceAudioTrack,

    addIceCandidate,

    getVideoSender,

    getAudioSender,

    closePeerConnection,

    stopMediaStream

};
