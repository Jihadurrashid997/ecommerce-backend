const LOCATION_MESSAGE_PREFIX = "📍 Approximate location\n";

const isValidCoordinates = (latitude, longitude) =>
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

export const createLocationMessage = (latitude, longitude) => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!isValidCoordinates(lat, lon)) {
        throw new Error("A valid location is required.");
    }

    return `${LOCATION_MESSAGE_PREFIX}${lat.toFixed(4)},${lon.toFixed(4)}`;
};

export const parseLocationMessage = message => {
    if (typeof message !== "string" || !message.startsWith(LOCATION_MESSAGE_PREFIX)) {
        return null;
    }

    const match = message
        .slice(LOCATION_MESSAGE_PREFIX.length)
        .match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);

    if (!match) {
        return null;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (!isValidCoordinates(latitude, longitude)) {
        return null;
    }

    return {
        latitude,
        longitude,
        mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`
    };
};
