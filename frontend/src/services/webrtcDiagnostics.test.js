import { collectWebRtcDiagnostics } from "./webrtcDiagnostics";

test("collects call state and media counters without exposing candidate addresses or TURN secrets", async () => {
    const stats = new Map([
        ["transport", {
            type: "transport",
            selectedCandidatePairId: "pair"
        }],
        ["pair", {
            type: "candidate-pair",
            state: "succeeded",
            protocol: "udp",
            localCandidateId: "local-candidate",
            remoteCandidateId: "remote-candidate",
            currentRoundTripTime: 0.04
        }],
        ["local-candidate", {
            type: "local-candidate",
            candidateType: "relay",
            address: "192.0.2.10",
            candidate: "candidate:secret-local-value"
        }],
        ["remote-candidate", {
            type: "remote-candidate",
            candidateType: "srflx",
            address: "198.51.100.20",
            candidate: "candidate:secret-remote-value"
        }],
        ["video-inbound", {
            type: "inbound-rtp",
            kind: "video",
            packetsReceived: 120,
            packetsLost: 2,
            framesDecoded: 90,
            frameWidth: 640,
            frameHeight: 480
        }]
    ]);
    const peer = {
        connectionState: "connected",
        iceConnectionState: "connected",
        signalingState: "stable",
        iceGatheringState: "complete",
        getConfiguration: () => ({
            iceServers: [
                { urls: "stun:stun.example.test" },
                {
                    urls: "turns:turn.example.test:443",
                    username: "private-user",
                    credential: "private-secret"
                }
            ]
        }),
        getStats: jest.fn().mockResolvedValue(stats)
    };

    const diagnostics = await collectWebRtcDiagnostics({
        peer,
        role: "receiver",
        localStream: {
            getTracks: () => [
                { kind: "audio", readyState: "live", enabled: true, muted: false }
            ]
        },
        remoteStream: {
            getTracks: () => [
                { kind: "video", readyState: "live", enabled: true, muted: false }
            ]
        },
        localVideo: { readyState: 4, videoWidth: 640, videoHeight: 480, paused: false },
        remoteVideo: { readyState: 4, videoWidth: 640, videoHeight: 480, paused: false }
    });

    expect(diagnostics.role).toBe("receiver");
    expect(diagnostics.connection.iceState).toBe("connected");
    expect(diagnostics.iceServers).toEqual({ stunCount: 1, turnCount: 1 });
    expect(diagnostics.selectedCandidatePair).toEqual({
        state: "succeeded",
        protocol: "udp",
        localCandidateType: "relay",
        remoteCandidateType: "srflx",
        roundTripTime: 0.04
    });
    expect(diagnostics.video.remote).toEqual({
        readyState: 4,
        width: 640,
        height: 480,
        paused: false
    });
    expect(diagnostics.rtp).toEqual([{
        direction: "inbound",
        kind: "video",
        packets: 120,
        packetsLost: 2,
        bytes: null,
        jitter: null,
        frames: 90,
        frameWidth: 640,
        frameHeight: 480
    }]);

    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain("192.0.2.10");
    expect(serialized).not.toContain("198.51.100.20");
    expect(serialized).not.toContain("candidate:secret");
    expect(serialized).not.toContain("private-user");
    expect(serialized).not.toContain("private-secret");
    expect(serialized).not.toContain("turn.example.test");
});
