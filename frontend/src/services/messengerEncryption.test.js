import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";
import {
    decryptMessageRecord,
    deriveConversationCipher,
    encryptMessageText,
    ensureMessengerIdentity,
    getConversationEncryptionId,
    getSafetyCode
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
