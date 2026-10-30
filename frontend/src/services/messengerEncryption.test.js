import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";
import {
    decryptMessageRecord,
    deriveConversationCipher,
    encryptMessageText,
    createMessengerKeyBackup,
    ensureMessengerIdentity,
    getConversationEncryptionId,
    getGroupSafetyCode,
    encryptMessengerMediaFile,
    decryptMessengerMediaFile,
    getEncryptedMediaMetadata,
    MAX_MESSENGER_ATTACHMENT_BYTES,
    encryptGroupMessageText,
    decryptGroupMessageRecord,
    getSafetyCode,
    restoreMessengerIdentity,
    createGroupCallKeyEnvelopes,
    unwrapGroupCallKey,
    isEncryptedGroupMessage
} from "./messengerEncryption";

beforeAll(() => {
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: webcrypto
    });
});

beforeEach(() => {
    window.localStorage.clear();
});

test("end-to-end media encryption enforces the 500MB attachment limit", async () => {
    await expect(encryptMessengerMediaFile({
        name: "large-scan.pdf",
        type: "application/pdf",
        size: MAX_MESSENGER_ATTACHMENT_BYTES + 1,
        arrayBuffer: jest.fn()
    })).rejects.toThrow("Choose a file that is 500MB or smaller to encrypt.");
});

test("one-to-one ECDH keys encrypt text that only the matching peer can decrypt", async () => {
    const api = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const alice = await ensureMessengerIdentity(api, "alice");
    const bob = await ensureMessengerIdentity(api, "bob");
    const aliceCipher = await deriveConversationCipher(
        alice.privateKey,
        bob.publicKey,
        getConversationEncryptionId("alice", "bob")
    );
    const bobCipher = await deriveConversationCipher(
        bob.privateKey,
        alice.publicKey,
        getConversationEncryptionId("bob", "alice")
    );
    const ciphertext = await encryptMessageText(
        "Secret conversation",
        aliceCipher,
        getConversationEncryptionId("alice", "bob")
    );
    const encryptedMedia = await encryptMessengerMediaFile({
        name: "secret.pdf",
        type: "application/pdf",
        size: 4,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer
    });
    const encryptedMediaMetadata = await encryptMessageText(
        JSON.stringify(encryptedMedia.metadata),
        aliceCipher,
        getConversationEncryptionId("alice", "bob")
    );

    const decrypted = await decryptMessageRecord(
        {
            message: ciphertext,
            isEncrypted: true
        },
        bobCipher,
        getConversationEncryptionId("bob", "alice")
    );
    const decryptedMediaMetadata = await decryptMessageRecord(
        {
            message: encryptedMediaMetadata,
            isEncrypted: true,
            fileUrl: "/uploads/secret.bin"
        },
        bobCipher,
        getConversationEncryptionId("bob", "alice")
    );

    expect(decrypted.message).toBe("Secret conversation");
    expect(decrypted.isEncrypted).toBe(true);
    expect(ciphertext).not.toContain("Secret conversation");
    expect(
        getEncryptedMediaMetadata(decryptedMediaMetadata.message).fileName
    ).toBe("secret.pdf");
    expect(api.put).toHaveBeenCalledTimes(2);
});

test("one-to-one safety codes match on both participants' devices", async () => {
    const api = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const alice = await ensureMessengerIdentity(api, "alice");
    const bob = await ensureMessengerIdentity(api, "bob");

    await expect(
        getSafetyCode(alice.publicKey, bob.publicKey)
    ).resolves.toBe(
        await getSafetyCode(bob.publicKey, alice.publicKey)
    );
});

test("a registered account key is not replaced when the device has no local key", async () => {
    const api = {
        get: jest.fn().mockResolvedValue({
            data: {
                data: {
                    publicKey: {
                        kty: "EC",
                        crv: "P-256",
                        x: "registered",
                        y: "key"
                    }
                }
            }
        }),
        put: jest.fn()
    };

    await expect(
        ensureMessengerIdentity(api, "alice")
    ).rejects.toThrow("already has an encryption key registered");

    expect(window.localStorage.getItem("jr-messenger-e2ee-v1:alice")).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
});

test("a passphrase-protected key backup restores the same encrypted identity on another device", async () => {
    const registrationApi = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const originalIdentity = await ensureMessengerIdentity(
        registrationApi,
        "alice"
    );
    const peerIdentity = await ensureMessengerIdentity(
        registrationApi,
        "bob"
    );
    const conversationId = getConversationEncryptionId("alice", "bob");
    const originalCipher = await deriveConversationCipher(
        originalIdentity.privateKey,
        peerIdentity.publicKey,
        conversationId
    );
    const encryptedHistory = await encryptMessageText(
        "Recovered secret",
        originalCipher,
        conversationId
    );
    const passphrase = "correct horse battery staple";
    const backup = await createMessengerKeyBackup(
        originalIdentity,
        "alice",
        passphrase
    );

    expect(backup.ciphertext).not.toContain(originalIdentity.privateKeyJwk.d);
    window.localStorage.clear();

    const restoreApi = {
        get: jest.fn(async path => {
            if (path === "/messages/encryption-key-backup") {
                return { data: { data: { backup } } };
            }

            if (path === "/messages/encryption-key/alice") {
                return {
                    data: {
                        data: {
                            publicKey: originalIdentity.publicKey
                        }
                    }
                };
            }

            throw new Error(`Unexpected GET ${path}`);
        })
    };
    const restoredIdentity = await restoreMessengerIdentity(
        restoreApi,
        "alice",
        passphrase
    );
    const restoredCipher = await deriveConversationCipher(
        restoredIdentity.privateKey,
        peerIdentity.publicKey,
        conversationId
    );
    const recoveredMessage = await decryptMessageRecord(
        {
            message: encryptedHistory,
            isEncrypted: true
        },
        restoredCipher,
        conversationId
    );

    expect(restoredIdentity.publicKey).toEqual(originalIdentity.publicKey);
    expect(window.localStorage.getItem("jr-messenger-e2ee-v1:alice")).not.toBeNull();
    expect(recoveredMessage.message).toBe("Recovered secret");
});

test("an incorrect recovery passphrase cannot restore a device key", async () => {
    const registrationApi = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const identity = await ensureMessengerIdentity(registrationApi, "alice");
    const backup = await createMessengerKeyBackup(
        identity,
        "alice",
        "correct horse battery staple"
    );
    window.localStorage.clear();

    await expect(
        restoreMessengerIdentity(
            {
                get: jest.fn().mockResolvedValue({
                    data: { data: { backup } }
                })
            },
            "alice",
            "incorrect recovery phrase"
        )
    ).rejects.toThrow("Check the passphrase");

    expect(window.localStorage.getItem("jr-messenger-e2ee-v1:alice")).toBeNull();
});

test("a key backup cannot be restored into a different account", async () => {
    const registrationApi = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const identity = await ensureMessengerIdentity(registrationApi, "alice");
    const backup = await createMessengerKeyBackup(
        identity,
        "alice",
        "correct horse battery staple"
    );

    await expect(
        restoreMessengerIdentity(
            {
                get: jest.fn().mockResolvedValue({
                    data: { data: { backup } }
                })
            },
            "bob",
            "correct horse battery staple"
        )
    ).rejects.toThrow("Check the passphrase");

    expect(window.localStorage.getItem("jr-messenger-e2ee-v1:bob")).toBeNull();
});

test("encrypted group text is readable only by members included in its key envelope", async () => {
    const users = [
        "507f1f77bcf86cd799439011",
        "507f191e810c19729de860ea",
        "507f191e810c19729de860eb",
        "507f191e810c19729de860ec"
    ];
    const registrationApi = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const identities = await Promise.all(
        users.map(userId =>
            ensureMessengerIdentity(registrationApi, userId)
        )
    );
    const publicKeys = new Map(
        users.map((userId, index) => [userId, identities[index].publicKey])
    );
    const api = {
        get: jest.fn(async path => {
            const userId = path.split("/").pop();
            return {
                data: {
                    data: {
                        publicKey: publicKeys.get(userId)
                    }
                }
            };
        })
    };
    const groupId = "507f191e810c19729de860ed";
    const groupMembers = users.slice(0, 3);
    const encrypted = await encryptGroupMessageText({
        api,
        text: "Private group conversation",
        groupId,
        senderId: users[0],
        identity: identities[0],
        participants: groupMembers
    });
    const storedMessage = {
        sender: users[0],
        groupId,
        message: encrypted,
        isEncrypted: true
    };
    const bobMessage = await decryptGroupMessageRecord(
        api,
        storedMessage,
        groupId,
        users[1],
        identities[1]
    );
    const aliceMessage = await decryptGroupMessageRecord(
        api,
        storedMessage,
        groupId,
        users[0],
        identities[0]
    );
    const newMemberMessage = await decryptGroupMessageRecord(
        api,
        storedMessage,
        groupId,
        users[3],
        identities[3]
    );
    const media = await encryptMessengerMediaFile({
        name: "private-voice.webm",
        type: "audio/webm",
        size: 3,
        arrayBuffer: async () => new Uint8Array([3, 4, 5]).buffer
    });
    const encryptedMediaMetadata = await encryptGroupMessageText({
        api,
        text: JSON.stringify(media.metadata),
        groupId,
        senderId: users[0],
        identity: identities[0],
        participants: groupMembers
    });
    const decryptedMediaMetadata = await decryptGroupMessageRecord(
        api,
        {
            ...storedMessage,
            message: encryptedMediaMetadata
        },
        groupId,
        users[1],
        identities[1]
    );
    const envelope = JSON.parse(
        Buffer.from(encrypted.slice("e2eg:v1:".length), "base64url").toString()
    );
    envelope.ciphertext =
        `${envelope.ciphertext[0] === "A" ? "B" : "A"}` +
        envelope.ciphertext.slice(1);
    const tamperedMessage = await decryptGroupMessageRecord(
        api,
        {
            ...storedMessage,
            message: `e2eg:v1:${Buffer.from(
                JSON.stringify(envelope)
            ).toString("base64url")}`
        },
        groupId,
        users[1],
        identities[1]
    );

    expect(isEncryptedGroupMessage(encrypted)).toBe(true);
    expect(encrypted).not.toContain("Private group conversation");
    expect(bobMessage.message).toBe("Private group conversation");
    expect(aliceMessage.message).toBe("Private group conversation");
    expect(newMemberMessage.decryptionFailed).toBe(true);
    expect(newMemberMessage.message).toMatch(/before you joined/);
    expect(
        getEncryptedMediaMetadata(decryptedMediaMetadata.message).fileType
    ).toBe("audio/webm");
    expect(tamperedMessage.decryptionFailed).toBe(true);
    expect(tamperedMessage.message).toBe(
        "Unable to decrypt this message on this device."
    );
});

test("group verification codes are stable regardless of participant order", async () => {
    const api = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const alice = await ensureMessengerIdentity(api, "507f1f77bcf86cd799439011");
    const bob = await ensureMessengerIdentity(api, "507f191e810c19729de860ea");
    const aliceKey = {
        userId: "507f1f77bcf86cd799439011",
        publicKey: alice.publicKey
    };
    const bobKey = {
        userId: "507f191e810c19729de860ea",
        publicKey: bob.publicKey
    };

    await expect(
        getGroupSafetyCode([aliceKey, bobKey])
    ).resolves.toBe(
        await getGroupSafetyCode([bobKey, aliceKey])
    );
});

test("group call keys are wrapped for each member and reject outsiders or tampering", async () => {
    const users = [
        "507f1f77bcf86cd799439011",
        "507f191e810c19729de860ea",
        "507f191e810c19729de860eb"
    ];
    const registrationApi = {
        get: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        put: jest.fn().mockResolvedValue({ data: { success: true } })
    };
    const identities = await Promise.all(
        users.map(userId => ensureMessengerIdentity(registrationApi, userId))
    );
    const publicKeys = new Map(
        users.map((userId, index) => [userId, identities[index].publicKey])
    );
    const api = {
        get: jest.fn(async path => ({
            data: {
                data: {
                    publicKey: publicKeys.get(path.split("/").pop())
                }
            }
        }))
    };
    const groupId = "507f191e810c19729de860ec";
    const callKey = await createGroupCallKeyEnvelopes({
        api,
        groupId,
        userId: users[0],
        participants: users.slice(0, 2),
        identity: identities[0]
    });
    const bobEnvelope = callKey.envelopes.find(
        envelope => envelope.userId === users[1]
    );
    const bobKey = await unwrapGroupCallKey({
        api,
        groupId,
        userId: users[1],
        senderId: users[0],
        keyId: callKey.keyId,
        envelope: bobEnvelope,
        identity: identities[1]
    });
    const aliceKey = await unwrapGroupCallKey({
        api,
        groupId,
        userId: users[0],
        senderId: users[0],
        keyId: callKey.keyId,
        envelope: callKey.envelopes.find(
            envelope => envelope.userId === users[0]
        ),
        identity: identities[0]
    });

    expect(Array.from(new Uint8Array(bobKey))).toEqual(
        Array.from(new Uint8Array(aliceKey))
    );
    expect(new Uint8Array(aliceKey)).toEqual(new Uint8Array(callKey.key));
    await expect(
        unwrapGroupCallKey({
            api,
            groupId,
            userId: users[2],
            senderId: users[0],
            keyId: callKey.keyId,
            envelope: bobEnvelope,
            identity: identities[2]
        })
    ).rejects.toThrow();
    await expect(
        unwrapGroupCallKey({
            api,
            groupId,
            userId: users[1],
            senderId: users[0],
            keyId: callKey.keyId,
            envelope: {
                ...bobEnvelope,
                iv: `${bobEnvelope.iv[0] === "A" ? "B" : "A"}${bobEnvelope.iv.slice(1)}`
            },
            identity: identities[1]
        })
    ).rejects.toThrow();
});

test("Messenger media encryption hides file bytes and restores metadata and content", async () => {
    const originalBytes = new TextEncoder().encode("private audio/image bytes");
    const file = {
        name: "private-photo.png",
        type: "image/png",
        size: originalBytes.byteLength,
        arrayBuffer: async () =>
            originalBytes.buffer.slice(
                originalBytes.byteOffset,
                originalBytes.byteOffset + originalBytes.byteLength
            )
    };
    const encrypted = await encryptMessengerMediaFile(file);

    expect(encrypted.ciphertext).not.toEqual(originalBytes);
    expect(encrypted.ciphertext.byteLength).toBe(originalBytes.byteLength + 16);
    expect(getEncryptedMediaMetadata(JSON.stringify(encrypted.metadata)))
        .toMatchObject({
            fileName: "private-photo.png",
            fileType: "image/png"
        });

    const decrypted = await decryptMessengerMediaFile(
        encrypted.ciphertext,
        encrypted.metadata
    );
    expect(Array.from(decrypted)).toEqual(Array.from(originalBytes));
});

test("tampered Messenger media and malformed metadata are rejected", async () => {
    const file = {
        name: "voice-note.webm",
        type: "audio/webm",
        size: 7,
        arrayBuffer: async () => new TextEncoder().encode("voice!!").buffer
    };
    const encrypted = await encryptMessengerMediaFile(file);
    const tampered = new Uint8Array(encrypted.ciphertext);
    tampered[tampered.length - 1] ^= 1;

    await expect(
        decryptMessengerMediaFile(tampered, encrypted.metadata)
    ).rejects.toThrow();
    expect(
        getEncryptedMediaMetadata(JSON.stringify({
            ...encrypted.metadata,
            key: "invalid"
        }))
    ).toBeNull();
});
