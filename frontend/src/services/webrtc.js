const ICE_SERVERS = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302"
            ]
        }

        /*
        TURN server থাকলে এখানে add করবে:

        {
            urls: "turn:YOUR_TURN_SERVER:3478",
            username: "YOUR_USERNAME",
            credential: "YOUR_PASSWORD"
        }
        */
    ],

    iceCandidatePoolSize: 10
};


export const createPeerConnection = ({
    onIceCandidate,
    onTrack,
    onConnectionStateChange,
    onIceConnectionStateChange,
    onNegotiationNeeded
} = {}) => {

    const peer =
        new RTCPeerConnection(
            ICE_SERVERS
        );


    peer.onicecandidate =
        event => {

            if (
                event.candidate &&
                typeof onIceCandidate ===
                    "function"
            ) {

                onIceCandidate(
                    event.candidate
                );

            }

        };


    peer.ontrack =
        event => {

            if (
                typeof onTrack ===
                "function"
            ) {

                onTrack(event);

            }

        };


    peer.onconnectionstatechange =
        () => {

            if (
                typeof onConnectionStateChange ===
                "function"
            ) {

                onConnectionStateChange(
                    peer.connectionState
                );

            }

        };


    peer.oniceconnectionstatechange =
        () => {

            if (
                typeof onIceConnectionStateChange ===
                "function"
            ) {

                onIceConnectionStateChange(
                    peer.iceConnectionState
                );

            }

        };


    peer.onnegotiationneeded =
        () => {

            if (
                typeof onNegotiationNeeded ===
                "function"
            ) {

                onNegotiationNeeded(
                    peer
                );

            }

        };


    return peer;
};


export const getUserMedia =
    async ({
        audio = true,
        video = false,
        facingMode = "user"
    } = {}) => {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone/camera access."
            );

        }


        const constraints = {

            audio: Boolean(audio),

            video:
                video
                    ? {
                          facingMode: {
                              ideal:
                                  facingMode
                          },

                          width: {
                              ideal: 1280
                          },

                          height: {
                              ideal: 720
                          },

                          frameRate: {
                              ideal: 30,
                              max: 30
                          }
                      }
                    : false

        };


        return navigator.mediaDevices
            .getUserMedia(
                constraints
            );

    };


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


        stream
            .getTracks()
            .forEach(
                track => {

                    const exists =
                        peer
                            .getSenders()
                            .some(
                                sender =>
                                    sender.track &&
                                    sender.track.id ===
                                        track.id
                            );


                    if (!exists) {

                        peer.addTrack(
                            track,
                            stream
                        );

                    }

                }
            );

    };


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
                "No video sender found."
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
                "Video track replace error:",
                error
            );

            return false;

        }

    };


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

            return false;

        }


        try {

            await sender.replaceTrack(
                track
            );

            return true;

        } catch (error) {

            console.error(
                "Audio track replace error:",
                error
            );

            return false;

        }

    };


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

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
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


export const closePeerConnection =
    peer => {

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

    closePeerConnection,

    stopMediaStream

};
