import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
    createLocalTracks,
    ExternalE2EEKeyProvider,
    isE2EESupported,
    Room
} from "livekit-client";
import api from "../services/api";
import {
    ensureMessengerIdentity,
    unwrapGroupCallKey
} from "../services/messengerEncryption";
import { createLiveKitE2EEWorker } from "../services/livekitE2EEWorker";
import GroupCallModal from "./GroupCallModal";

jest.mock("livekit-client", () => ({
    createLocalTracks: jest.fn(),
    ExternalE2EEKeyProvider: jest.fn(),
    isE2EESupported: jest.fn(),
    Room: jest.fn(),
    RoomEvent: {
        ParticipantConnected: "participantConnected",
        ParticipantDisconnected: "participantDisconnected",
        TrackSubscribed: "trackSubscribed",
        TrackUnsubscribed: "trackUnsubscribed",
        LocalTrackPublished: "localTrackPublished",
        LocalTrackUnpublished: "localTrackUnpublished",
        Disconnected: "disconnected",
        EncryptionError: "encryptionError"
    },
    Track: {
        Source: { Camera: "camera" },
        Kind: { Audio: "audio" }
    }
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn()
    }
}));

jest.mock("../services/messengerEncryption", () => ({
    createGroupCallKeyEnvelopes: jest.fn(),
    ensureMessengerIdentity: jest.fn(),
    unwrapGroupCallKey: jest.fn()
}));

jest.mock("../services/livekitE2EEWorker", () => ({
    createLiveKitE2EEWorker: jest.fn()
}));

const member = {
    _id: "507f1f77bcf86cd799439011",
    name: "Member",
    trackPublications: [],
    getTrackPublication: jest.fn(() => null),
    publishTrack: jest.fn()
};

const createRoom = () => ({
    localParticipant: member,
    remoteParticipants: new Map(),
    on: jest.fn(function on() {
        return this;
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    setE2EEEnabled: jest.fn().mockResolvedValue(undefined)
});

beforeEach(() => {
    jest.clearAllMocks();
    api.post.mockResolvedValue({
        data: {
            data: {
                serverUrl: "wss://calls.example.com",
                token: "call-token",
                isEncrypted: false,
                participants: [member._id]
            }
        }
    });
    api.get.mockRejectedValue({
        response: {
            status: 409,
            data: { code: "GROUP_CALL_E2EE_DISABLED" }
        }
    });
    isE2EESupported.mockReturnValue(false);
    createLocalTracks.mockResolvedValue([]);
    ensureMessengerIdentity.mockResolvedValue({ privateKey: {}, publicKey: {} });
    unwrapGroupCallKey.mockResolvedValue(new ArrayBuffer(32));
    createLiveKitE2EEWorker.mockReturnValue({ terminate: jest.fn() });
    ExternalE2EEKeyProvider.mockImplementation(() => ({
        setKey: jest.fn().mockResolvedValue(undefined)
    }));
    Room.mockImplementation(createRoom);
});

test("encrypted group calls fail closed when the browser lacks E2EE support", async () => {
    api.post.mockResolvedValue({
        data: {
            data: {
                serverUrl: "wss://calls.example.com",
                token: "call-token",
                isEncrypted: true,
                participants: [member._id]
            }
        }
    });
    api.get.mockRejectedValue({ response: { status: 404 } });
    jest.spyOn(console, "error").mockImplementation(() => {});

    render(
        <GroupCallModal
            group={{ _id: "507f191e810c19729de860ec", name: "Private group" }}
            currentUser={member}
        />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "will not fall back to an unencrypted connection"
    );
    expect(Room).not.toHaveBeenCalled();
    expect(createLocalTracks).not.toHaveBeenCalled();
});

test("unencrypted groups retain the existing LiveKit call flow", async () => {
    const onConnected = jest.fn();

    isE2EESupported.mockReturnValue(true);
    render(
        <GroupCallModal
            group={{ _id: "507f191e810c19729de860ec", name: "Friends" }}
            currentUser={member}
            onConnected={onConnected}
        />
    );

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));

    const room = Room.mock.results[0].value;
    expect(room.connect).toHaveBeenCalledWith(
        "wss://calls.example.com",
        "call-token"
    );
    expect(room.setE2EEEnabled).not.toHaveBeenCalled();
    expect(createLocalTracks).toHaveBeenCalledWith({
        audio: true,
        video: false
    });
});

test("encrypted group calls enable E2EE before connecting or publishing media", async () => {
    const onConnected = jest.fn();
    const track = { stop: jest.fn() };

    api.post.mockResolvedValue({
        data: {
            data: {
                serverUrl: "wss://calls.example.com",
                token: "call-token",
                isEncrypted: true,
                participants: [member._id]
            }
        }
    });
    api.get.mockResolvedValue({
        data: {
            data: {
                keyId: "key-id",
                senderId: member._id,
                envelope: { iv: "iv", wrappedKey: "wrapped" }
            }
        }
    });
    isE2EESupported.mockReturnValue(true);
    createLocalTracks.mockResolvedValue([track]);

    render(
        <GroupCallModal
            group={{ _id: "507f191e810c19729de860ec", name: "Private group" }}
            currentUser={member}
            onConnected={onConnected}
        />
    );

    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));

    const room = Room.mock.results[0].value;
    expect(room.setE2EEEnabled).toHaveBeenCalledWith(true);
    expect(room.setE2EEEnabled.mock.invocationCallOrder[0])
        .toBeLessThan(room.connect.mock.invocationCallOrder[0]);
    expect(room.connect.mock.invocationCallOrder[0])
        .toBeLessThan(member.publishTrack.mock.invocationCallOrder[0]);
    expect(room.connect).toHaveBeenCalledWith(
        "wss://calls.example.com",
        "call-token"
    );
    expect(createLiveKitE2EEWorker).toHaveBeenCalledTimes(1);
    expect(unwrapGroupCallKey).toHaveBeenCalledWith(
        expect.objectContaining({
            groupId: "507f191e810c19729de860ec",
            userId: member._id,
            keyId: "key-id"
        })
    );
});
