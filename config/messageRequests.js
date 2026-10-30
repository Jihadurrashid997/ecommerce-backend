const readBoundedInteger = (name, fallback, minimum, maximum) => {
    const raw = process.env[name];
    if (raw === undefined || raw === "") {
        return fallback;
    }

    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(
            `${name} must be an integer between ${minimum} and ${maximum}.`
        );
    }

    return value;
};

const getMessageRequestConfig = () => ({
    maxPer24Hours: readBoundedInteger(
        "MESSENGER_MESSAGE_REQUESTS_PER_24H",
        5,
        1,
        100
    ),
    deleteCooldownDays: readBoundedInteger(
        "MESSENGER_MESSAGE_REQUEST_DELETE_COOLDOWN_DAYS",
        30,
        1,
        365
    )
});

module.exports = {
    getMessageRequestConfig
};
