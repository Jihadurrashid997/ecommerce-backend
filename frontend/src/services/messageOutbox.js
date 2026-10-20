const getStorageKey = userId =>
    `jr-messenger-outbox:${String(userId || "")}`;

export const createClientMessageId = () => {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
};

export const getQueuedMessages = userId => {
    if (!userId) {
        return [];
    }

    const serialized = window.localStorage.getItem(getStorageKey(userId));
    if (!serialized) {
        return [];
    }

    const messages = JSON.parse(serialized);
    if (!Array.isArray(messages)) {
        throw new Error("The saved Messenger outbox is invalid.");
    }
    return messages;
};

export const queueMessage = (userId, message) => {
    const queued = getQueuedMessages(userId);
    if (queued.some(item => item.clientMessageId === message.clientMessageId)) {
        return queued;
    }
    if (queued.length >= 100) {
        throw new Error(
            "The offline message queue is full. Connect to the internet and try again."
        );
    }

    const next = [...queued, message];
    window.localStorage.setItem(
        getStorageKey(userId),
        JSON.stringify(next)
    );
    return next;
};

export const removeQueuedMessage = (userId, clientMessageId) => {
    const next = getQueuedMessages(userId).filter(
        message => message.clientMessageId !== clientMessageId
    );
    const key = getStorageKey(userId);
    if (next.length) {
        window.localStorage.setItem(key, JSON.stringify(next));
    } else {
        window.localStorage.removeItem(key);
    }
    return next;
};
