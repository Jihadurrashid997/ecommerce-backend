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
=========================================================
*/


/*
=========================================================
ICE SERVERS
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

            urls: turnUrl,

            username: turnUsername,

            credential: turnCredential

        });

    }


    return servers;
};


const ICE_SERVERS = {

    iceServers: buildIceServers(),

    iceCandidatePoolSize: 10,

    bundlePolicy: "max-bundle",

    rtcpMuxPolicy: "require",

    iceTransportPolicy: "all"

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

    peer.onicecandidate = event => {

        if (!event.candidate) {
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

    peer.ontrack = event => {

        console.log(
            "📡 Remote track:",
            event.track?.kind,
            event.track?.readyState
        );


        if (
            typeof onTrack !==
            "function"
        ) {
            return;
        }


        /*
        Prefer browser-provided MediaStream.
        */

        let stream =
            event.streams?.[0] || null;


        /*
        If browser does not provide stream,
        create one.
        */

        if (!stream) {
            stream = new MediaStream();
        }


        /*
        Make sure the received track exists
        inside the stream.
        */

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

            try {

                stream.addTrack(
                    event.track
                );

            } catch (error) {

                console.warn(
                    "Could not add remote track:",
                    error
                );

            }

        }


        onTrack({

            ...event,

            streams: [stream]

        });

    };


    /*
    -----------------------------------------------------
    CONNECTION STATE
    -----------------------------------------------------
    */

    peer.onconnectionstatechange = () => {

        console.log(
            "📞 WebRTC connection:",
            peer.connectionState
        );


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

    peer.oniceconnectionstatechange = () => {

        console.log(
            "🧊 ICE connection:",
            peer.iceConnectionState
        );


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

    peer.onnegotiationneeded = async () => {

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

export const getUserMedia = async ({
    audio = true,
    video = false,
    facingMode = "user"
} = {}) => {

    if (
        typeof navigator ===
        "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices
            .getUserMedia !== "function"
    ) {

        throw new Error(
            "Microphone/camera access is not available. Use HTTPS or localhost."
        );

    }


    const constraints = {

        audio: audio
            ? {
                  echoCancellation: true,

                  noiseSuppression: true,

                  autoGainControl: true
              }
            : false,


        video: video
            ? {
                  facingMode: {
                      ideal: facingMode
                  },

                  width: {
                      ideal: 1280,
                      max: 1920
                  },

                  height: {
                      ideal: 720,
                      max: 1080
                  },

                  frameRate: {
                      ideal: 30,
                      max: 30
                  }
              }
            : false

    };


    try {

        const stream =
            await navigator
                .mediaDevices
                .getUserMedia(
                    constraints
                );


        console.log(
            "🎤 Local media:",
            stream
                .getTracks()
                .map(
                    track =>
                        `${track.kind}:${track.readyState}`
                )
        );


        return stream;

    } catch (error) {

        console.error(
            "getUserMedia error:",
            error
        );


        /*
        Retry with simple constraints.
        */

        if (
            error?.name ===
                "OverconstrainedError" ||
            error?.name ===
                "NotReadableError"
        ) {

            try {

                return await navigator
                    .mediaDevices
                    .getUserMedia({

                        audio: audio,

                        video: video

                    });

            } catch (retryError) {

                console.error(
                    "Simple getUserMedia retry failed:",
                    retryError
                );

                throw retryError;

            }

        }


        throw error;

    }

};


/*
=========================================================
ADD LOCAL TRACKS
=========================================================
*/

export const addLocalTracks = (
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
        .forEach(track => {

            const senderExists =
                existingSenders.some(
                    sender =>
                        sender.track?.kind ===
                            track.kind &&
                        sender.track?.id ===
                            track.id
                );


            if (senderExists) {
                return;
            }


            /*
            Avoid duplicate audio/video sender.
            */

            const sameKindSender =
                peer
                    .getSenders()
                    .find(
                        sender =>
                            sender.track?.kind ===
                            track.kind
                    );


            if (
                sameKindSender &&
                !sameKindSender.track
            ) {

                sameKindSender
                    .replaceTrack(track)
                    .catch(error => {

                        console.error(
                            "Track replace error:",
                            error
                        );

                    });

                return;

            }


            peer.addTrack(
                track,
                stream
            );

        });

};


/*
=========================================================
REPLACE VIDEO TRACK
=========================================================
*/

export const replaceVideoTrack = async (
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

export const replaceAudioTrack = async (
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

export const addIceCandidate = async (
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


        await peer.addIceCandidate(
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

export const getVideoSender = peer => {

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

export const getAudioSender = peer => {

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
CLOSE PEER CONNECTION
=========================================================
*/

export const closePeerConnection = peer => {

    if (!peer) {
        return;
    }


    try {

        peer.onicecandidate = null;

        peer.ontrack = null;

        peer.onconnectionstatechange =
            null;

        peer.oniceconnectionstatechange =
            null;

        peer.onnegotiationneeded = null;


        peer
            .getSenders()
            .forEach(sender => {

                try {

                    sender.replaceTrack(
                        null
                    );

                } catch (_) {}

            });


        if (
            peer.signalingState !==
            "closed"
        ) {

            peer.close();

        }

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

export const stopMediaStream = stream => {

    if (!stream) {
        return;
    }


    stream
        .getTracks()
        .forEach(track => {

            try {

                if (
                    track.readyState !==
                    "ended"
                ) {

                    track.stop();

                }

            } catch (error) {

                console.error(
                    "Media track stop error:",
                    error
                );

            }

        });

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
