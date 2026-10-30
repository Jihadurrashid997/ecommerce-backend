const summarizeTracks = stream =>
    (stream?.getTracks?.() || []).map(track => ({
        kind: track.kind,
        readyState: track.readyState,
        enabled: Boolean(track.enabled),
        muted: Boolean(track.muted)
    }));

const summarizeVideo = video => video ? {
    readyState: video.readyState,
    width: video.videoWidth,
    height: video.videoHeight,
    paused: Boolean(video.paused)
} : null;

const summarizeIceServers = peer => {
    const result = { stunCount: 0, turnCount: 0 };
    const servers = peer?.getConfiguration?.().iceServers || [];
    servers.forEach(server => {
        const urls = Array.isArray(server.urls)
            ? server.urls
            : [server.urls];
        urls.forEach(url => {
            const scheme = String(url || "").split(":", 1)[0].toLowerCase();
            if (scheme === "stun" || scheme === "stuns") {
                result.stunCount += 1;
            } else if (scheme === "turn" || scheme === "turns") {
                result.turnCount += 1;
            }
        });
    });
    return result;
};

const summarizeRtp = stat => ({
    direction: stat.type === "inbound-rtp" ? "inbound" : "outbound",
    kind: stat.kind || stat.mediaType || "unknown",
    packets: stat.packetsReceived ?? stat.packetsSent ?? null,
    packetsLost: stat.packetsLost ?? null,
    bytes: stat.bytesReceived ?? stat.bytesSent ?? null,
    jitter: stat.jitter ?? null,
    frames: stat.framesDecoded ?? stat.framesReceived ?? stat.framesSent ?? null,
    frameWidth: stat.frameWidth ?? null,
    frameHeight: stat.frameHeight ?? null
});

export const collectWebRtcDiagnostics = async ({
    peer,
    role,
    localStream,
    remoteStream,
    localVideo,
    remoteVideo
}) => {
    const report = peer?.getStats
        ? await peer.getStats()
        : new Map();
    const stats = [...report.values()];
    const transport = stats.find(item =>
        item.type === "transport" && item.selectedCandidatePairId
    );
    const selectedPair = transport
        ? report.get(transport.selectedCandidatePairId)
        : stats.find(item =>
            item.type === "candidate-pair" &&
            item.state === "succeeded" &&
            (item.selected || item.nominated)
        );
    const localCandidate = selectedPair
        ? report.get(selectedPair.localCandidateId)
        : null;
    const remoteCandidate = selectedPair
        ? report.get(selectedPair.remoteCandidateId)
        : null;

    return {
        capturedAt: new Date().toISOString(),
        role: ["caller", "receiver"].includes(role) ? role : "unknown",
        connection: {
            state: peer?.connectionState || "unavailable",
            iceState: peer?.iceConnectionState || "unavailable",
            signalingState: peer?.signalingState || "unavailable",
            gatheringState: peer?.iceGatheringState || "unavailable"
        },
        iceServers: summarizeIceServers(peer),
        tracks: {
            local: summarizeTracks(localStream),
            remote: summarizeTracks(remoteStream)
        },
        video: {
            local: summarizeVideo(localVideo),
            remote: summarizeVideo(remoteVideo)
        },
        selectedCandidatePair: selectedPair ? {
            state: selectedPair.state || null,
            protocol: selectedPair.protocol || null,
            localCandidateType: localCandidate?.candidateType || null,
            remoteCandidateType: remoteCandidate?.candidateType || null,
            roundTripTime: selectedPair.currentRoundTripTime ?? null
        } : null,
        rtp: stats
            .filter(item =>
                item.type === "inbound-rtp" ||
                item.type === "outbound-rtp"
            )
            .map(summarizeRtp)
    };
};
