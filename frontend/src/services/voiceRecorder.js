const SUPPORTED_VOICE_MIME_TYPES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac"
];

const stopStream = stream => {
    stream?.getTracks().forEach(track => track.stop());
};

export const startVoiceRecording = async ({
    getUserMedia,
    MediaRecorderClass
}) => {
    if (
        typeof getUserMedia !== "function" ||
        typeof MediaRecorderClass !== "function"
    ) {
        const error = new Error(
            "Voice recording is not supported by this browser."
        );
        error.name = "NotSupportedError";
        throw error;
    }

    const stream = await getUserMedia({ audio: true });

    try {
        const mimeType =
            SUPPORTED_VOICE_MIME_TYPES.find(type =>
                MediaRecorderClass.isTypeSupported?.(type)
            ) || "";
        const recorder = mimeType
            ? new MediaRecorderClass(stream, { mimeType })
            : new MediaRecorderClass(stream);
        const chunks = [];

        recorder.ondataavailable = event => {
            if (event.data?.size > 0) {
                chunks.push(event.data);
            }
        };
        recorder.start();

        return { stream, recorder, chunks };
    } catch (error) {
        stopStream(stream);
        throw error;
    }
};

export const finishVoiceRecording = (recorder, chunks = []) => {
    if (!recorder) {
        return Promise.resolve(null);
    }

    const createBlob = () =>
        new Blob(chunks, {
            type:
                recorder.mimeType ||
                chunks[0]?.type ||
                "audio/webm"
        });

    if (recorder.state === "inactive") {
        return Promise.resolve(createBlob());
    }

    return new Promise((resolve, reject) => {
        const onStop = () => resolve(createBlob());
        if (typeof recorder.addEventListener === "function") {
            recorder.addEventListener("stop", onStop, { once: true });
        } else {
            recorder.onstop = onStop;
        }

        try {
            recorder.stop();
        } catch (error) {
            reject(error);
        }
    });
};
