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

TURN can be supplied through Create React App
environment variables (REACT_APP_ prefix - this
project builds with react-scripts, not Vite):

REACT_APP_TURN_URL
REACT_APP_TURN_USERNAME
REACT_APP_TURN_CREDENTIAL

Example (set these in Render's Environment tab for
the frontend service, then redeploy):

REACT_APP_TURN_URL=turn:global.relay.metered.ca:80
REACT_APP_TURN_USERNAME=your-username
REACT_APP_TURN_CREDENTIAL=your-password

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
        },

        /*
         * FREE PUBLIC TURN FALLBACK (OpenRelay project).
         *
         * STUN alone only helps two peers discover a
         * direct path to each other, and that direct path
         * often doesn't exist at all - most mobile carrier
         * networks and many corporate/home routers use NAT
         * types that block direct peer-to-peer connections
         * entirely. Without a relay (TURN) server, the call
         * UI can still say "connected" (that's just the
         * signaling/negotiation succeeding) while no actual
         * audio/video ever flows - which matches "kotha
         * bolle kono kotha jai na" / video not visible
         * between two mobile devices exactly.
         *
         * This free relay keeps calls working out of the
         * box. For production-scale reliability, replace it
         * with your own TURN server (coturn, Twilio,
         * Metered, Xirsys, etc.) via the VITE_TURN_* env
         * vars below - those are appended on top of, not
         * instead of, this fallback.
         */
        {
            urls:
                "turn:openrelay.metered.ca:80",
            username:
                "openrelayproject",
            credential:
                "openrelayproject"
        },
        {
            urls:
                "turn:openrelay.metered.ca:443",
            username:
                "openrelayproject",
            credential:
                "openrelayproject"
        },
        {
            urls:
                "turn:openrelay.metered.ca:443?transport=tcp",
            username:
                "openrelayproject",
            credential:
                "openrelayproject"
        }

    ];


    /*
     * This project builds with Create React App
     * (react-scripts), which only exposes environment
     * variables prefixed REACT_APP_ via process.env -
     * baked in at build time. import.meta.env is a Vite
     * feature and does not exist here, so it's kept only
     * as a fallback for portability if this project is
     * ever migrated to Vite.
     */

    const readEnv = name => {

        try {

            if (
                typeof process !== "undefined" &&
                process.env &&
                process.env[`REACT_APP_${name}`]
            ) {

                return process.env[`REACT_APP_${name}`];

            }

        } catch (_) {}

        try {

            if (
                typeof import.meta !== "undefined" &&
                import.meta.env
            ) {

                return import.meta.env[`VITE_${name}`];

            }

        } catch (_) {}

        return undefined;

    };


    const turnUrl =
        readEnv("TURN_URL");


    const turnUsername =
        readEnv("TURN_USERNAME");


    const turnCredential =
        readEnv("TURN_CREDENTIAL");


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

                console.log(
                    "🧊 ICE gathering finished (null candidate)"
                );

                return;
            }


            // typ host = same network, typ srflx = STUN
            // (public IP discovered), typ relay = TURN
            // relay actually being used. If you NEVER see
            // "relay" here on a cross-network call, the
            // TURN server isn't reachable/working and
            // that's why the call can't connect.
            console.log(
                "🧊 Local ICE candidate:",
                event.candidate.type,
                event.candidate.protocol,
                event.candidate.address ||
                    event.candidate.candidate
            );


            if (
                typeof onIceCandidate ===
                "function"
            ) {

                onIceCandidate(
                    event.candidate
                );

            }

        };


    peer.onicegatheringstatechange =
        () => {

            console.log(
                "🧊 ICE gathering state:",
                peer.iceGatheringState
            );

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

            console.log(
                "📞 peer.connectionState:",
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
