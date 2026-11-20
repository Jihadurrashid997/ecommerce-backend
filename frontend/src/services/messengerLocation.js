const LOCATION_MESSAGE_PREFIX = "📍 Approximate location\n";

const isValidCoordinates = (latitude, longitude) =>
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

export const createLocationMessage = (latitude, longitude, comment = "") => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!isValidCoordinates(lat, lon)) {
        throw new Error("A valid location is required.");
    }

    const trimmedComment = String(comment).trim();
    return `${LOCATION_MESSAGE_PREFIX}${lat.toFixed(4)},${lon.toFixed(4)}${
        trimmedComment ? `\n${trimmedComment}` : ""
    }`;
};

export const parseLocationMessage = message => {
    if (typeof message !== "string" || !message.startsWith(LOCATION_MESSAGE_PREFIX)) {
        return null;
    }

    const match = message
        .slice(LOCATION_MESSAGE_PREFIX.length)
        .match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\n([\s\S]*))?$/);

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
        comment: match[3] || "",
        mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        mapEmbedUrl:
            `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    };
};
