const ICE_SERVERS = {
    iceServers: [
        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302"
            ]
        }
    ]
};

export const createPeerConnection = ({
    onIceCandidate,
    onTrack,
    onConnectionStateChange
}) => {
    const peer = new RTCPeerConnection(
        ICE_SERVERS
    );

    peer.onicecandidate = (event) => {
        if (
            event.candidate &&
            typeof onIceCandidate === "function"
        ) {
            onIceCandidate(event.candidate);
        }
    };

    peer.ontrack = (event) => {
        if (typeof onTrack === "function") {
            onTrack(event);
        }
    };

    peer.onconnectionstatechange = () => {
        if (
            typeof onConnectionStateChange === "function"
        ) {
            onConnectionStateChange(
                peer.connectionState
            );
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
        audio,
        video
    });
};

export const addLocalTracks = (
    peer,
    stream
) => {
    if (!peer || !stream) {
        return;
    }

    stream.getTracks().forEach((track) => {
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

    stream.getTracks().forEach(
        (track) => {
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
    closePeerConnection,
    stopMediaStream
};
