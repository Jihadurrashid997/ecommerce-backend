const DATABASE_NAME = "etop-home-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "drafts";

const openDatabase = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("Browser draft storage is unavailable."));
        return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "userId" });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open draft storage."));
});

const runRequest = async (mode, makeRequest) => {
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, mode);
            const request = makeRequest(transaction.objectStore(STORE_NAME));
            let result;

            request.onsuccess = () => {
                result = request.result;
            };
            request.onerror = () => reject(request.error || new Error("Draft storage request failed."));
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error || new Error("Draft storage transaction failed."));
            transaction.onabort = () => reject(transaction.error || new Error("Draft storage transaction was aborted."));
        });
    } finally {
        database.close();
    }
};

export const loadHomeDraft = async userId => {
    const draft = await runRequest("readonly", store => store.get(userId));
    if (!draft) return null;

    return {
        caption: typeof draft.caption === "string" ? draft.caption : "",
        visibility: ["public", "followers", "private"].includes(draft.visibility)
            ? draft.visibility
            : "public",
        files: Array.isArray(draft.files) ? draft.files : []
    };
};

export const saveHomeDraft = (userId, draft) =>
    runRequest("readwrite", store => store.put({
        userId,
        caption: draft.caption,
        visibility: draft.visibility,
        files: draft.files
    }));

export const clearHomeDraft = userId =>
    runRequest("readwrite", store => store.delete(userId));
