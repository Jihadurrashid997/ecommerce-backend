const { OAuth2Client } = require("google-auth-library");

exports.verifyCredential = async credential => {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (
        !payload?.sub ||
        !payload.email ||
        payload.email_verified !== true
    ) {
        throw new Error("Google credential is missing verified account claims.");
    }

    return {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        name: payload.name || ""
    };
};
