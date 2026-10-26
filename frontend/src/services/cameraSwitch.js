const getFacingMode = track => {
    const settings = track.getSettings?.();
    if (settings?.facingMode) {
        return settings.facingMode;
    }

    const label = track.label?.toLowerCase() || "";
    if (/(back|rear|environment)/.test(label)) {
        return "environment";
    }
    if (/(front|user|facetime)/.test(label)) {
        return "user";
    }
    return "";
};

const requestCamera = async (mediaDevices, facingMode) => {
    try {
        return await mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { exact: facingMode } }
        });
    } catch (error) {
        if (
            !["OverconstrainedError", "ConstraintNotSatisfiedError", "NotFoundError"]
                .includes(error?.name)
        ) {
            throw error;
        }

        return mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: facingMode } }
        });
    }
};

const createStreamWithAudio = (audioTracks, videoTrack) =>
    new MediaStream([...audioTracks, videoTrack]);

export const switchCameraStream = async ({
    stream,
    peer,
    facingMode,
    mediaDevices = navigator.mediaDevices
}) => {
    const currentVideoTrack = stream?.getVideoTracks()[0];
    if (!currentVideoTrack) {
        throw new Error("No active camera is available to switch.");
    }

    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    const audioTracks = stream.getAudioTracks();
    const sender = peer?.getSenders()
        .find(item => item.track?.kind === "video") ||
        peer?.getTransceivers()
            .find(item => item.receiver?.track?.kind === "video")
            ?.sender;

    currentVideoTrack.stop();

    let replacementStream;
    try {
        replacementStream = await requestCamera(mediaDevices, nextFacingMode);
        const replacementTrack = replacementStream.getVideoTracks()[0];
        if (!replacementTrack) {
            throw new Error("The selected camera did not provide a video track.");
        }

        const actualFacingMode = getFacingMode(replacementTrack);
        if (actualFacingMode && actualFacingMode !== nextFacingMode) {
            throw new Error("The device opened the wrong camera.");
        }
        if (peer && !sender) {
            throw new Error("The active call has no video sender to switch.");
        }
        if (sender) {
            await sender.replaceTrack(replacementTrack);
        }

        replacementStream.getAudioTracks().forEach(track => track.stop());
        return {
            facingMode: nextFacingMode,
            stream: createStreamWithAudio(audioTracks, replacementTrack)
        };
    } catch (error) {
        const switchError = new Error(
            error?.message || "Could not switch to the other camera."
        );
        switchError.name = error?.name || "Error";
        replacementStream?.getTracks().forEach(track => track.stop());

        try {
            const restoredStream = await requestCamera(mediaDevices, facingMode);
            const restoredTrack = restoredStream.getVideoTracks()[0];
            if (!restoredTrack) {
                throw new Error("The previous camera could not be restored.");
            }
            if (sender) {
                await sender.replaceTrack(restoredTrack);
            }

            restoredStream.getAudioTracks().forEach(track => track.stop());
            switchError.restoredStream = createStreamWithAudio(
                audioTracks,
                restoredTrack
            );
        } catch (restoreError) {
            switchError.restoreError = restoreError;
        }

        throw switchError;
    }
};
