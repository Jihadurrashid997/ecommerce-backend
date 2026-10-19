export const createLiveKitE2EEWorker = () =>
    new Worker(
        new URL("livekit-client/e2ee-worker", import.meta.url)
    );
