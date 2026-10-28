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

export const replaceDirectCallVideoTrack = async (peer, track) => {
    const videoTransceivers = (peer?.getTransceivers() || [])
        .filter(
            transceiver =>
                transceiver.receiver?.track?.kind === "video"
        );
    const hasNegotiatedDirection =
        videoTransceivers.some(
            transceiver =>
                transceiver.currentDirection !== null &&
                transceiver.currentDirection !== undefined
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
        (!hasNegotiatedDirection &&
            videoTransceivers.find(
                transceiver =>
                    transceiver.direction?.includes("send")
            ));

    if (!videoTransceiver?.sender) {
        throw new Error("Video is not available in this call.");
    }

    if (track) {
        track.enabled = true;
    }

    await videoTransceiver.sender.replaceTrack(track || null);
};
