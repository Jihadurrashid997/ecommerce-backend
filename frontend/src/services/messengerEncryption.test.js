import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";
import {
    decryptMessageRecord,
    deriveConversationCipher,
    encryptMessageText,
    createMessengerKeyBackup,
    ensureMessengerIdentity,
    getConversationEncryptionId,
    getSafetyCode,
    restoreMessengerIdentity
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

    const decrypted = await decryptMessageRecord(
        {
            message: ciphertext,
            isEncrypted: true
        },
        bobCipher,
        getConversationEncryptionId("bob", "alice")
    );

    expect(decrypted.message).toBe("Secret conversation");
    expect(decrypted.isEncrypted).toBe(true);
    expect(ciphertext).not.toContain("Secret conversation");
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
