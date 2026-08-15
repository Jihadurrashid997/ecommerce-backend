const ICE_SERVERS = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302"
            ]
        }
    ]
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

    peer.onicecandidate = (event) => {

        if (
            event.candidate &&
            typeof onIceCandidate === "function"
        ) {
            onIceCandidate(
                event.candidate
            );
        }
    };

    peer.ontrack = (event) => {

        if (
            typeof onTrack === "function"
        ) {
            onTrack(event);
        }
    };

    peer.onconnectionstatechange = () => {

        if (
            typeof onConnectionStateChange ===
            "function"
        ) {
            onConnectionStateChange(
                peer.connectionState
            );
        }
    };

    peer.oniceconnectionstatechange = () => {

        if (
            typeof onIceConnectionStateChange ===
            "function"
        ) {
            onIceConnectionStateChange(
                peer.iceConnectionState
            );
        }
    };

    peer.onnegotiationneeded = () => {

        if (
            typeof onNegotiationNeeded ===
            "function"
        ) {
            onNegotiationNeeded(peer);
        }
    };

    return peer;
};

export const getUserMedia = async ({
    audio = true,
    video = false
} = {}) => {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error(
            "Your browser does not support microphone/camera access."
        );
    }

    return navigator.mediaDevices.getUserMedia({
        audio: Boolean(audio),
        video: Boolean(video)
    });
};

export const addLocalTracks = (
    peer,
    stream
) => {

    if (!peer || !stream) {
        return;
    }

    stream
        .getTracks()
        .forEach((track) => {

            const alreadyAdded =
                peer
                    .getSenders()
                    .some(
                        (sender) =>
                            sender.track === track
                    );

            if (!alreadyAdded) {

                peer.addTrack(
                    track,
                    stream
                );

            }

        });
};

export const replaceVideoTrack = (
    peer,
    track
) => {

    if (!peer || !track) {
        return false;
    }

    const sender =
        peer
            .getSenders()
            .find(
                (item) =>
                    item.track?.kind ===
                    "video"
            );

    if (!sender) {
        return false;
    }

    sender.replaceTrack(track);

    return true;
};

export const replaceAudioTrack = (
    peer,
    track
) => {

    if (!peer || !track) {
        return false;
    }

    const sender =
        peer
            .getSenders()
            .find(
                (item) =>
                    item.track?.kind ===
                    "audio"
            );

    if (!sender) {
        return false;
    }

    sender.replaceTrack(track);

    return true;
};

export const addIceCandidate = async (
    peer,
    candidate
) => {

    if (
        !peer ||
        !candidate
    ) {
        return;
    }

    try {

        await peer.addIceCandidate(
            candidate
        );

    } catch (error) {

        console.error(
            "WebRTC ICE candidate error:",
            error
        );

    }
};

export const closePeerConnection = (
    peer
) => {

    if (!peer) {
        return;
    }

    try {

        peer.onicecandidate = null;
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        peer.oniceconnectionstatechange = null;
        peer.onnegotiationneeded = null;

        peer
            .getSenders()
            .forEach((sender) => {

                try {
                    sender.replaceTrack(null);
                } catch (_) {}

            });

        peer.close();

    } catch (error) {

        console.error(
            "WebRTC close error:",
            error
        );

    }
};

export const stopMediaStream = (
    stream
) => {

    if (!stream) {
        return;
    }

    stream
        .getTracks()
        .forEach((track) => {

            try {

                track.stop();

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
    closePeerConnection,
    stopMediaStream
};
