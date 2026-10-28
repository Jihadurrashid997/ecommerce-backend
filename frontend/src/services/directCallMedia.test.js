import {
    addDirectCallVideoTransceiver,
    replaceDirectCallVideoTrack
} from "./directCallMedia";

test("pre-negotiates a sendrecv video transceiver for voice calls", () => {
    const peer = {
        addTransceiver: jest.fn()
    };
    const stream = {
        getVideoTracks: () => []
    };

    addDirectCallVideoTransceiver(peer, stream);

    expect(peer.addTransceiver).toHaveBeenCalledWith(
        "video",
        { direction: "sendrecv", streams: [stream] }
    );
});

test("attaches an existing camera track to the pre-negotiated transceiver", () => {
    const track = { kind: "video" };
    const stream = {
        getVideoTracks: () => [track]
    };
    const peer = {
        addTransceiver: jest.fn()
    };

    addDirectCallVideoTransceiver(peer, stream);

    expect(peer.addTransceiver).toHaveBeenCalledWith(
        track,
        { direction: "sendrecv", streams: [stream] }
    );
});

test("replaces the negotiated voice-call video sender when camera state changes", async () => {
    const track = { kind: "video" };
    const sender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const peer = {
        getTransceivers: () => [{
            receiver: { track: { kind: "video" } },
            sender,
            currentDirection: "sendrecv",
            direction: "sendrecv"
        }]
    };

    await replaceDirectCallVideoTrack(peer, track);
    await replaceDirectCallVideoTrack(peer, null);

    expect(sender.replaceTrack).toHaveBeenNthCalledWith(1, track);
    expect(sender.replaceTrack).toHaveBeenNthCalledWith(2, null);
});

test("replaces the send-capable video transceiver when the peer has multiple video sections", async () => {
    const track = { kind: "video", enabled: false };
    const receiveOnlySender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const sendReceiveSender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const peer = {
        getTransceivers: () => [
            {
                receiver: { track: { kind: "video" } },
                sender: receiveOnlySender,
                currentDirection: "recvonly",
                direction: "sendrecv"
            },
            {
                receiver: { track: { kind: "video" } },
                sender: sendReceiveSender,
                currentDirection: "sendrecv",
                direction: "sendrecv"
            }
        ]
    };

    await replaceDirectCallVideoTrack(peer, track);

    expect(track.enabled).toBe(true);
    expect(receiveOnlySender.replaceTrack).not.toHaveBeenCalled();
    expect(sendReceiveSender.replaceTrack).toHaveBeenCalledWith(track);
});

test("does not select a negotiated receive-only video transceiver for sending", async () => {
    const sender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const peer = {
        getTransceivers: () => [{
            receiver: { track: { kind: "video" } },
            sender,
            currentDirection: "recvonly",
            direction: "sendrecv"
        }]
    };

    await expect(
        replaceDirectCallVideoTrack(peer, { kind: "video" })
    ).rejects.toThrow("Video is not available in this call.");
    expect(sender.replaceTrack).not.toHaveBeenCalled();
});

test("fails explicitly when the peer has no video transceiver", async () => {
    await expect(replaceDirectCallVideoTrack({ getTransceivers: () => [] }, null))
        .rejects.toThrow("Video is not available in this call.");
});
