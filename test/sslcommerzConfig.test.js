const assert = require("node:assert/strict");
const test = require("node:test");
const { getSSLCommerzConfig } = require("../services/sslcommerzConfig");

const sandboxEnv = {
    SSLCOMMERZ_MODE: "sandbox",
    SSLCOMMERZ_SANDBOX_STORE_ID: "sandbox-store",
    SSLCOMMERZ_SANDBOX_STORE_PASSWORD: "sandbox-password",
    SSLCOMMERZ_LIVE_STORE_ID: "live-store",
    SSLCOMMERZ_LIVE_STORE_PASSWORD: "live-password",
    SERVER_URL: "https://api.example.test/",
    CLIENT_URL: "https://client.example.test/",
    NODE_ENV: "production"
};

test("SSLCommerz configuration selects sandbox credentials and HTTPS callback origins", () => {
    const config = getSSLCommerzConfig(sandboxEnv);

    assert.equal(config.mode, "sandbox");
    assert.equal(config.storeId, "sandbox-store");
    assert.equal(config.storePassword, "sandbox-password");
    assert.equal(config.serverUrl, "https://api.example.test");
    assert.equal(config.clientUrl, "https://client.example.test");
    assert.equal(config.isLive, false);
    assert.equal(JSON.stringify(config).includes("live-password"), false);
});

test("SSLCommerz refuses live mode even when live credentials are present", () => {
    assert.throws(
        () => getSSLCommerzConfig({
            ...sandboxEnv,
            SSLCOMMERZ_MODE: "live"
        }),
        /live.*disabled/i
    );
});

test("SSLCommerz requires sandbox credentials and valid callback URLs", () => {
    assert.throws(
        () => getSSLCommerzConfig({
            ...sandboxEnv,
            SSLCOMMERZ_SANDBOX_STORE_PASSWORD: ""
        }),
        /SSLCOMMERZ_SANDBOX_STORE_PASSWORD/
    );
    assert.throws(
        () => getSSLCommerzConfig({
            ...sandboxEnv,
            SERVER_URL: "not-a-url"
        }),
        /valid absolute URLs/
    );
});

test("production SSLCommerz callbacks require HTTPS", () => {
    assert.throws(
        () => getSSLCommerzConfig({
            ...sandboxEnv,
            SERVER_URL: "http://api.example.test"
        }),
        /must use HTTPS/
    );
});
