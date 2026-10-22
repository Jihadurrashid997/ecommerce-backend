const getSSLCommerzConfig = (env = process.env) => {
    const mode = String(env.SSLCOMMERZ_MODE || "sandbox").trim().toLowerCase();
    if (mode !== "sandbox") {
        throw new Error(
            "Live SSLCommerz payments are disabled. Use SSLCOMMERZ_MODE=sandbox."
        );
    }

    const storeId = String(env.SSLCOMMERZ_SANDBOX_STORE_ID || "").trim();
    const storePassword = String(
        env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD || ""
    ).trim();
    const serverUrl = String(env.SERVER_URL || "").trim().replace(/\/+$/, "");
    const clientUrl = String(env.CLIENT_URL || "").trim().replace(/\/+$/, "");

    if (!storeId || !storePassword) {
        throw new Error(
            "Sandbox credentials are not configured. Set SSLCOMMERZ_SANDBOX_STORE_ID and SSLCOMMERZ_SANDBOX_STORE_PASSWORD."
        );
    }

    let parsedServerUrl;
    let parsedClientUrl;
    try {
        parsedServerUrl = new URL(serverUrl);
        parsedClientUrl = new URL(clientUrl);
    } catch (_error) {
        throw new Error("SERVER_URL and CLIENT_URL must be valid absolute URLs.");
    }

    if (
        !["http:", "https:"].includes(parsedServerUrl.protocol) ||
        !["http:", "https:"].includes(parsedClientUrl.protocol)
    ) {
        throw new Error("SERVER_URL and CLIENT_URL must use HTTP or HTTPS.");
    }
    if (
        env.NODE_ENV === "production" &&
        (
            parsedServerUrl.protocol !== "https:" ||
            parsedClientUrl.protocol !== "https:"
        )
    ) {
        throw new Error("Production payment callback URLs must use HTTPS.");
    }

    return {
        mode,
        storeId,
        storePassword,
        serverUrl,
        clientUrl,
        isLive: false
    };
};

module.exports = { getSSLCommerzConfig };
