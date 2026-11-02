export const addDirectCallVideoTransceiver = (peer, stream) => {
    const videoTrack = stream?.getVideoTracks()[0];
    return peer.addTransceiver(
        videoTrack || "video",
        {
            direction: "sendrecv",
            ...(stream && { streams: [stream] })
        }
    );
};

export const ensureDirectCallVideoTransceiver = peer => {
    const videoTransceivers = (peer?.getTransceivers() || [])
        .filter(
            transceiver =>
                transceiver.receiver?.track?.kind === "video"
        );
    const videoTransceiver =
        videoTransceivers.find(
            transceiver =>
                transceiver.sender?.track?.kind === "video"
        ) ||
        videoTransceivers.find(
            transceiver =>
                transceiver.currentDirection?.includes("send")
        ) ||
        videoTransceivers.find(
            transceiver =>
                transceiver.currentDirection == null &&
                transceiver.direction?.includes("send")
        ) ||
        videoTransceivers.find(
            transceiver =>
                transceiver.currentDirection !== "stopped" &&
                transceiver.sender
        );

    if (videoTransceiver?.sender) {
        if (!videoTransceiver.direction?.includes("send")) {
            videoTransceiver.direction = "sendrecv";
        }
        return videoTransceiver;
    }

    if (!peer || typeof peer.addTransceiver !== "function") {
        throw new Error("Video is not available in this call.");
    }

    return peer.addTransceiver("video", { direction: "sendrecv" });
};

export const attachLocalTracksToRemoteOffer = async (peer, stream) => {
    if (!peer || !stream) {
        return;
    }

    const transceivers = peer.getTransceivers();
    for (const track of stream.getTracks()) {
        const transceiver = transceivers.find(
            item =>
                item.mid !== null &&
                item.currentDirection !== "stopped" &&
                item.receiver?.track?.kind === track.kind
        );
        if (!transceiver?.sender) {
            throw new Error(
                `The remote call offer has no ${track.kind} media section.`
            );
        }

        if (!transceiver.direction?.includes("send")) {
            transceiver.direction = "sendrecv";
        }
        await transceiver.sender.replaceTrack(track);
    }
};

export const replaceDirectCallVideoTrack = async (peer, track) => {
    const videoTransceiver = ensureDirectCallVideoTransceiver(peer);
    const sender = videoTransceiver.sender;
    const requiresNegotiation =
        !videoTransceiver.currentDirection?.includes("send") ||
        (!sender.track && Boolean(track));

    if (track) {
        track.enabled = true;
    }

    await sender.replaceTrack(track || null);
    return requiresNegotiation;
};
