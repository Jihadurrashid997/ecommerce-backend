const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;

export const getCameraZoomInfo = track => {
    const zoom = track?.getCapabilities?.().zoom;
    if (
        !zoom ||
        !Number.isFinite(zoom.min) ||
        !Number.isFinite(zoom.max)
    ) {
        return { range: null, value: 1 };
    }

    const min = Math.max(MIN_ZOOM, zoom.min);
    const max = Math.min(MAX_ZOOM, zoom.max);
    if (max <= min) {
        return { range: null, value: 1 };
    }

    const currentZoom = track.getSettings?.().zoom;
    const value = Number.isFinite(currentZoom)
        ? Math.min(max, Math.max(min, currentZoom))
        : Math.min(max, Math.max(min, 1));

    return {
        range: {
            min,
            max,
            step: Number.isFinite(zoom.step) && zoom.step > 0
                ? zoom.step
                : 0.5
        },
        value
    };
};

export const applyCameraZoom = async (track, value) => {
    const { range } = getCameraZoomInfo(track);
    if (!range || typeof track?.applyConstraints !== "function") {
        throw new Error("This camera does not support zoom.");
    }
    if (!Number.isFinite(value) || value < range.min || value > range.max) {
        throw new Error(
            `This camera supports zoom from ${range.min}x to ${range.max}x.`
        );
    }

    await track.applyConstraints({
        advanced: [{ zoom: value }]
    });

    const appliedZoom = track.getSettings?.().zoom;
    return Number.isFinite(appliedZoom) ? appliedZoom : value;
};
