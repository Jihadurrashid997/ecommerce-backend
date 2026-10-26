export const addDirectCallVideoTransceiver = (peer, stream) => {
    const videoTrack = stream?.getVideoTracks()[0];
    return peer.addTransceiver(
        videoTrack || "video",
        {
            direction: "sendrecv",
            ...(videoTrack && { streams: [stream] })
        }
    );
};

export const replaceDirectCallVideoTrack = async (peer, track) => {
    const videoTransceiver = peer
        ?.getTransceivers()
        .find(
            transceiver =>
                transceiver.receiver?.track?.kind === "video"
        );

    if (!videoTransceiver?.sender) {
        throw new Error("Video is not available in this call.");
    }

    await videoTransceiver.sender.replaceTrack(track || null);
};
