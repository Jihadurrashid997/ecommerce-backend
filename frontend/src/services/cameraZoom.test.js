import { applyCameraZoom, getCameraZoomInfo } from "./cameraZoom";

const createTrack = ({
    min = 1,
    max = 10,
    step = 0.5,
    zoom = 1
} = {}) => {
    let currentZoom = zoom;
    return {
        getCapabilities: () => ({ zoom: { min, max, step } }),
        getSettings: () => ({ zoom: currentZoom }),
        applyConstraints: jest.fn(async constraints => {
            currentZoom = constraints.advanced[0].zoom;
        })
    };
};

test("reports the supported camera zoom range within 0.5x to 10x", () => {
    const track = createTrack({ min: 0.1, max: 20, zoom: 2 });

    expect(getCameraZoomInfo(track)).toEqual({
        range: { min: 0.5, max: 10, step: 0.5 },
        value: 2
    });
});

test("applies zoom to the outgoing camera track", async () => {
    const track = createTrack();

    await expect(applyCameraZoom(track, 5)).resolves.toBe(5);
    expect(track.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ zoom: 5 }]
    });
});

test("reports when a camera has no adjustable zoom", async () => {
    const track = createTrack({ min: 1, max: 1 });

    expect(getCameraZoomInfo(track).range).toBeNull();
    await expect(applyCameraZoom(track, 2))
        .rejects.toThrow("This camera does not support zoom.");
});
