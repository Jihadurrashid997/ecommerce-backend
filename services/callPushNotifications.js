const crypto = require("node:crypto");
const { connect: connectHttp2 } = require("node:http2");
const { GoogleAuth } = require("google-auth-library");
const DeviceSession = require("../models/DeviceSession");

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
let cachedApnsToken;
let cachedApnsTokenExpiresAt = 0;

const base64Url = value => Buffer.from(value).toString("base64url");

const buildIncomingCallEvent = call => ({
    eventId: crypto.randomUUID(),
    serverCallId: call.callId,
    hasVideo: call.type === "video",
    startedAt: new Date(call.createdAt || Date.now()).toISOString(),
    caller: {
        id: call.callerId,
        displayName: call.callerName || "Messenger contact",
        ...(call.callerAvatar ? { avatarUrl: call.callerAvatar } : {})
    },
    metadata: {
        roomId: call.roomId,
        callerId: call.callerId,
        receiverId: call.receiverId,
        callerName: call.callerName || "Messenger contact",
        receiverName: call.receiverName || "Messenger contact",
        type: call.type === "video" ? "video" : "audio"
    }
});

const getFirebaseAccount = () => {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        throw new Error("FCM_SERVICE_ACCOUNT_JSON is not configured.");
    }

    let account;
    try {
        account = JSON.parse(raw);
    } catch (error) {
        throw new Error(`FCM_SERVICE_ACCOUNT_JSON is invalid: ${error.message}`);
    }
    if (
        !account.client_email ||
        !account.private_key ||
        !account.project_id
    ) {
        throw new Error("FCM service account JSON is missing required fields.");
    }
    return account;
};

const getApnsToken = () => {
    if (cachedApnsToken && Date.now() < cachedApnsTokenExpiresAt) {
        return cachedApnsToken;
    }
    const key = process.env.APNS_AUTH_KEY?.replace(/\\n/g, "\n");
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    if (!key || !keyId || !teamId) {
        throw new Error(
            "APNS_AUTH_KEY, APNS_KEY_ID, and APNS_TEAM_ID are required for iOS call pushes."
        );
    }

    const header = base64Url(JSON.stringify({
        alg: "ES256",
        kid: keyId,
        typ: "JWT"
    }));
    const claims = base64Url(JSON.stringify({
        iss: teamId,
        iat: Math.floor(Date.now() / 1000)
    }));
    const signer = crypto.createSign("SHA256");
    signer.update(`${header}.${claims}`);
    const signature = base64Url(
        signer.sign({ key, dsaEncoding: "ieee-p1363" })
    );
    cachedApnsToken = `${header}.${claims}.${signature}`;
    cachedApnsTokenExpiresAt = Date.now() + 50 * 60 * 1000;
    return cachedApnsToken;
};

const sendApnsCall = async (token, event) => {
    const authorization = `bearer ${getApnsToken()}`;
    const host = process.env.APNS_PRODUCTION === "true"
        ? "api.push.apple.com"
        : "api.sandbox.push.apple.com";
    const topic = `${process.env.APNS_BUNDLE_ID || "com.ecommercebackend.messenger"}.voip`;
    const client = connectHttp2(`https://${host}`);
    try {
        await new Promise((resolve, reject) => {
            const request = client.request({
                ":method": "POST",
                ":path": `/3/device/${token}`,
                authorization,
                "apns-topic": topic,
                "apns-push-type": "voip",
                "apns-priority": "10",
                "content-type": "application/json"
            });
            let status = 0;
            let responseBody = "";
            request.on("response", headers => {
                status = Number(headers[":status"]);
            });
            request.on("data", chunk => {
                responseBody += chunk;
            });
            request.on("end", () => {
                if (status === 200) {
                    resolve();
                } else {
                    reject(new Error(`APNs returned ${status}: ${responseBody}`));
                }
            });
            request.on("error", reject);
            request.end(JSON.stringify({ incomingCall: event }));
        });
    } finally {
        client.close();
    }
};

const sendFcmCall = async (token, event) => {
    const account = getFirebaseAccount();
    const auth = new GoogleAuth({
        credentials: account,
        scopes: [FCM_SCOPE]
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken) {
        throw new Error("Google did not return an FCM access token.");
    }

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: {
                    token,
                    data: {
                        messageType: "incomingCall",
                        incomingCall: JSON.stringify(event)
                    },
                    android: { priority: "HIGH" }
                }
            })
        }
    );
    if (!response.ok) {
        throw new Error(`FCM returned ${response.status}: ${await response.text()}`);
    }
};

const sendFcmCallEnded = async (token, callId, reason) => {
    const account = getFirebaseAccount();
    const auth = new GoogleAuth({
        credentials: account,
        scopes: [FCM_SCOPE]
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken) {
        throw new Error("Google did not return an FCM access token.");
    }

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: {
                    token,
                    data: {
                        messageType: "callEnded",
                        callEnded: JSON.stringify({
                            eventId: crypto.randomUUID(),
                            serverCallId: callId,
                            reason
                        })
                    },
                    android: { priority: "HIGH" }
                }
            })
        }
    );
    if (!response.ok) {
        throw new Error(`FCM returned ${response.status}: ${await response.text()}`);
    }
};

const sendIncomingCallPush = async (receiverId, call) => {
    const devices = await DeviceSession.find({
        user: receiverId,
        "callPushToken.token": { $exists: true }
    })
        .select("callPushToken")
        .lean();
    if (devices.length === 0) {
        return 0;
    }

    const event = buildIncomingCallEvent(call);
    const results = await Promise.allSettled(
        devices.map(device => {
            const push = device.callPushToken;
            return push.type === "APNS_VOIP"
                ? sendApnsCall(push.token, event)
                : sendFcmCall(push.token, event);
        })
    );
    const failures = results.filter(result => result.status === "rejected");
    failures.forEach(result => {
        console.error("NATIVE CALL PUSH ERROR:", result.reason);
    });
    return results.length - failures.length;
};

const sendCallEndedPush = async (receiverId, callId, reason = "remoteEnded") => {
    if (!receiverId || !callId) {
        return 0;
    }
    const devices = await DeviceSession.find({
        user: receiverId,
        "callPushToken.type": "FCM",
        "callPushToken.token": { $exists: true }
    })
        .select("callPushToken")
        .lean();
    const results = await Promise.allSettled(
        devices.map(device =>
            sendFcmCallEnded(
                device.callPushToken.token,
                callId,
                reason
            )
        )
    );
    const failures = results.filter(result => result.status === "rejected");
    failures.forEach(result => {
        console.error("SEND NATIVE CALL END PUSH ERROR:", result.reason);
    });
    return results.length - failures.length;
};

module.exports = {
    buildIncomingCallEvent,
    sendIncomingCallPush,
    sendCallEndedPush
};
