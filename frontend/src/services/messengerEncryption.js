const ENCRYPTED_MESSAGE_PREFIX = "e2ee:v1:";
const KEY_STORAGE_PREFIX = "jr-messenger-e2ee-v1:";
const ECDH_ALGORITHM = {
    name: "ECDH",
    namedCurve: "P-256"
};

const getSubtleCrypto = () => {
    if (!window.crypto?.subtle) {
        throw new Error("This browser does not support secure chat encryption.");
    }

    return window.crypto.subtle;
};

const bytesToBase64 = bytes => {
    let binary = "";

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return window.btoa(binary);
};

const base64ToBytes = value => {
    const binary = window.atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
};

export const isEncryptedMessage = message =>
    typeof message === "string" &&
    message.startsWith(ENCRYPTED_MESSAGE_PREFIX);

export const getConversationEncryptionId = (firstUserId, secondUserId) =>
    [String(firstUserId), String(secondUserId)].sort().join(":");

export const ensureMessengerIdentity = async (api, userId) => {
    const subtle = getSubtleCrypto();
    const storageKey = `${KEY_STORAGE_PREFIX}${userId}`;
    let storedPair = null;

    try {
        const savedPair = window.localStorage.getItem(storageKey);
        storedPair = savedPair ? JSON.parse(savedPair) : null;
    } catch (error) {
        throw new Error(`Could not read this device's encryption key: ${error.message}`);
    }

    let privateKey;
    let publicKey;

    if (
        storedPair?.privateKey?.kty === "EC" &&
        storedPair?.publicKey?.kty === "EC"
    ) {
        try {
            privateKey = await subtle.importKey(
                "jwk",
                storedPair.privateKey,
                ECDH_ALGORITHM,
                false,
                ["deriveBits"]
            );
            publicKey = storedPair.publicKey;
        } catch (error) {
            throw new Error(`This device's encryption key is unreadable: ${error.message}`);
        }
    } else if (!storedPair) {
        try {
            await api.get(`/messages/encryption-key/${userId}`);
            throw new Error(
                "This account already has an encryption key registered. Use the original device; generating a new key could make encrypted history unreadable."
            );
        } catch (error) {
            if (error.response?.status !== 404) {
                throw error;
            }
        }

        const pair = await subtle.generateKey(
            ECDH_ALGORITHM,
            true,
            ["deriveBits"]
        );
        const privateJwk = await subtle.exportKey("jwk", pair.privateKey);
        publicKey = await subtle.exportKey("jwk", pair.publicKey);

        try {
            window.localStorage.setItem(
                storageKey,
                JSON.stringify({
                    privateKey: privateJwk,
                    publicKey
                })
            );
        } catch (error) {
            throw new Error(`Could not save this device's encryption key: ${error.message}`);
        }

        privateKey = await subtle.importKey(
            "jwk",
            privateJwk,
            ECDH_ALGORITHM,
            false,
            ["deriveBits"]
        );
    } else {
        throw new Error("This device has an incomplete encryption key. Do not clear browser storage.");
    }

    await api.put("/messages/encryption-key", { publicKey });

    return {
        privateKey,
        publicKey
    };
};

export const getPeerEncryptionKey = async (api, userId) => {
    const response = await api.get(`/messages/encryption-key/${userId}`);
    const publicKey = response.data?.data?.publicKey;

    if (
        publicKey?.kty !== "EC" ||
        publicKey?.crv !== "P-256" ||
        typeof publicKey.x !== "string" ||
        typeof publicKey.y !== "string"
    ) {
        throw new Error("This person has not set up an encryption key yet.");
    }

    return publicKey;
};

export const deriveConversationCipher = async (
    privateKey,
    peerPublicJwk,
    conversationId
) => {
    const subtle = getSubtleCrypto();
    const peerPublicKey = await subtle.importKey(
        "jwk",
        peerPublicJwk,
        ECDH_ALGORITHM,
        false,
        []
    );
    const sharedSecret = await subtle.deriveBits(
        {
            name: "ECDH",
            public: peerPublicKey
        },
        privateKey,
        256
    );

    const inputKey = await subtle.importKey(
        "raw",
        sharedSecret,
        "HKDF",
        false,
        ["deriveKey"]
    );

    return subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(32),
            info: new TextEncoder().encode(
                `jr-messenger-e2ee-v1:${conversationId}`
            )
        },
        inputKey,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
};

export const getSafetyCode = async (firstPublicJwk, secondPublicJwk) => {
    const subtle = getSubtleCrypto();
    const canonicalKeys = [firstPublicJwk, secondPublicJwk]
        .map(publicJwk =>
            JSON.stringify({
                crv: publicJwk.crv,
                kty: publicJwk.kty,
                x: publicJwk.x,
                y: publicJwk.y
            })
        )
        .sort()
        .join("|");
    const digest = await subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalKeys)
    );

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
        .match(/.{1,4}/g)
        .join(" ");
};

export const encryptMessageText = async (
    text,
    cipher,
    conversationId
) => {
    const subtle = getSubtleCrypto();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
            additionalData: new TextEncoder().encode(String(conversationId))
        },
        cipher,
        new TextEncoder().encode(text)
    );

    const payload = new Uint8Array(iv.length + encrypted.byteLength);
    payload.set(iv);
    payload.set(new Uint8Array(encrypted), iv.length);

    return `${ENCRYPTED_MESSAGE_PREFIX}${bytesToBase64(payload)}`;
};

export const decryptMessageRecord = async (
    message,
    cipher,
    conversationId
) => {
    if (!message || typeof message !== "object") {
        return message;
    }

    let decryptedMessage = message;

    if (isEncryptedMessage(message.message)) {
        try {
            const payload = base64ToBytes(
                message.message.slice(ENCRYPTED_MESSAGE_PREFIX.length)
            );

            if (payload.length <= 12) {
                throw new Error("Encrypted message payload is incomplete.");
            }

            const plaintext = await getSubtleCrypto().decrypt(
                {
                    name: "AES-GCM",
                    iv: payload.slice(0, 12),
                    additionalData: new TextEncoder().encode(
                        String(conversationId)
                    )
                },
                cipher,
                payload.slice(12)
            );

            decryptedMessage = {
                ...message,
                message: new TextDecoder().decode(plaintext),
                isEncrypted: true
            };
        } catch (error) {
            console.error("Encrypted message could not be decrypted:", error);
            decryptedMessage = {
                ...message,
                message: "Unable to decrypt this message on this device.",
                isEncrypted: true,
                decryptionFailed: true
            };
        }
    }

    const nested = {};

    for (const field of ["replyTo", "forwardedFrom"]) {
        const value = message[field];

        if (value && typeof value === "object") {
            nested[field] = await decryptMessageRecord(
                value,
                cipher,
                conversationId
            );
        }
    }

    return {
        ...decryptedMessage,
        ...nested
    };
};
