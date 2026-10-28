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

test("replaces a negotiated voice-call video sender without renegotiating", async () => {
    const track = { kind: "video" };
    const sender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const peer = {
        getTransceivers: () => [{
            receiver: { track: { kind: "video" } },
            sender
        }]
    };

    await replaceDirectCallVideoTrack(peer, track);
    await replaceDirectCallVideoTrack(peer, null);

    expect(sender.replaceTrack).toHaveBeenNthCalledWith(1, track);
    expect(sender.replaceTrack).toHaveBeenNthCalledWith(2, null);
});

test("fails explicitly when the peer has no video transceiver", async () => {
    await expect(replaceDirectCallVideoTrack({ getTransceivers: () => [] }, null))
        .rejects.toThrow("Video is not available in this call.");
});
