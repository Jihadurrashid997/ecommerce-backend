const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const { OAuth2Client } = require("google-auth-library");
const googleAuthService = require("../services/googleAuthService");

const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
const originalClientId = process.env.GOOGLE_CLIENT_ID;

after(() => {
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
    if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
    } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
});

test("verifies the Google ID token against the configured client ID", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-web-client-id";
    let verificationOptions;
    OAuth2Client.prototype.verifyIdToken = async options => {
        verificationOptions = options;
        return {
            getPayload: () => ({
                sub: "google-subject-123",
                email: "user@example.com",
                email_verified: true,
                name: "Google User"
            })
        };
    };

    const identity = await googleAuthService.verifyCredential("signed-id-token");

    assert.deepEqual(verificationOptions, {
        idToken: "signed-id-token",
        audience: "google-web-client-id"
    });
    assert.deepEqual(identity, {
        googleId: "google-subject-123",
        email: "user@example.com",
        emailVerified: true,
        name: "Google User"
    });
});

test("rejects Google ID tokens without a verified email claim", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-web-client-id";
    OAuth2Client.prototype.verifyIdToken = async () => ({
        getPayload: () => ({
            sub: "google-subject-123",
            email: "user@example.com",
            email_verified: false
        })
    });

    await assert.rejects(
        googleAuthService.verifyCredential("signed-id-token"),
        /verified account claims/
    );
});
