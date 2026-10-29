import {
    addDirectCallVideoTransceiver,
    ensureDirectCallVideoTransceiver,
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

test("renegotiates when first attaching a camera to a pre-negotiated video section", async () => {
    const sender = {
        track: null,
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

    await expect(
        replaceDirectCallVideoTrack(peer, { kind: "video" })
    ).resolves.toBe(true);
    expect(sender.replaceTrack).toHaveBeenCalledTimes(1);
});

test("allows both connected peers to enable their cameras independently", async () => {
    const makePeer = () => {
        const sender = {
            replaceTrack: jest.fn().mockResolvedValue(undefined)
        };
        return {
            sender,
            peer: {
                getTransceivers: () => [{
                    receiver: { track: { kind: "video" } },
                    sender,
                    currentDirection: "sendrecv",
                    direction: "sendrecv"
                }]
            }
        };
    };
    const first = makePeer();
    const second = makePeer();
    const firstCamera = { kind: "video" };
    const secondCamera = { kind: "video" };

    await expect(
        replaceDirectCallVideoTrack(first.peer, firstCamera)
    ).resolves.toBe(true);
    await expect(
        replaceDirectCallVideoTrack(second.peer, secondCamera)
    ).resolves.toBe(true);

    expect(first.sender.replaceTrack).toHaveBeenCalledWith(firstCamera);
    expect(second.sender.replaceTrack).toHaveBeenCalledWith(secondCamera);
});

test("checks negotiation on the selected send-capable video section", async () => {
    const receiveOnlySender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const sendReceiveSender = {
        track: { kind: "video" },
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

    await expect(
        replaceDirectCallVideoTrack(peer, { kind: "video" })
    ).resolves.toBe(false);
    expect(receiveOnlySender.replaceTrack).not.toHaveBeenCalled();
    expect(sendReceiveSender.replaceTrack).toHaveBeenCalledTimes(1);
});

test("adds a sendrecv video transceiver when an existing call has no video section", async () => {
    const sender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const transceiver = {
        receiver: { track: { kind: "video" } },
        sender,
        currentDirection: null,
        direction: "sendrecv"
    };
    const peer = {
        addTransceiver: jest.fn().mockReturnValue(transceiver),
        getTransceivers: () => []
    };
    const track = { kind: "video" };

    await expect(
        replaceDirectCallVideoTrack(peer, track)
    ).resolves.toBe(true);

    expect(peer.addTransceiver).toHaveBeenCalledWith(
        "video",
        { direction: "sendrecv" }
    );
    expect(track.enabled).toBe(true);
    expect(sender.replaceTrack).toHaveBeenCalledWith(track);
});

test("reuses a sendrecv video transceiver before renegotiating the call", () => {
    const transceiver = {
        receiver: { track: { kind: "video" } },
        sender: { track: null },
        currentDirection: null,
        direction: "sendrecv"
    };
    const peer = {
        addTransceiver: jest.fn(),
        getTransceivers: () => [transceiver]
    };

    expect(ensureDirectCallVideoTransceiver(peer)).toBe(transceiver);
    expect(peer.addTransceiver).not.toHaveBeenCalled();
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

test("enables sending on an existing receive-only video transceiver", async () => {
    const sender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined)
    };
    const transceiver = {
        receiver: { track: { kind: "video" } },
        sender,
        currentDirection: "recvonly",
        direction: "recvonly"
    };
    const peer = { getTransceivers: () => [transceiver] };

    await expect(
        replaceDirectCallVideoTrack(peer, { kind: "video" })
    ).resolves.toBe(true);

    expect(transceiver.direction).toBe("sendrecv");
    expect(sender.replaceTrack).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "video", enabled: true })
    );
});

test("fails explicitly when the peer has no video transceiver", async () => {
    await expect(replaceDirectCallVideoTrack({ getTransceivers: () => [] }, null))
        .rejects.toThrow("Video is not available in this call.");
});
