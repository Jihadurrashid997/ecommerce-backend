const jwt = require("jsonwebtoken");

const User = require("../models/User");
const DeviceSession = require("../models/DeviceSession");

/*
=========================================================
AUTH MIDDLEWARE

1. Verifies the JWT.
2. Looks the account up (cached for 30s) so that:
     - a SUSPENDED or DELETED account stops working
       immediately, even though its token is still valid;
     - a role change (customer -> seller -> admin) takes
       effect without waiting for the token to expire.

auth.invalidate(userId) clears the cache for one account -
the admin controls call it right after changing someone.
=========================================================
*/

const CACHE_TTL_MS = 30 * 1000;

const cache = new Map();

const getAccountState = async id => {

    const key = String(id);

    const hit = cache.get(key);

    if (hit && hit.expires > Date.now()) {
        return hit.state;
    }

    const found =
        await User.findById(key)
            .select("role isSuspended suspendedReason")
            .lean();

    const state =
        found
            ? {
                exists: true,
                role: found.role,
                isSuspended: Boolean(found.isSuspended),
                reason: found.suspendedReason || ""
            }
            : { exists: false };

    cache.set(key, { state, expires: Date.now() + CACHE_TTL_MS });

    return state;

};


const auth = (roles = []) => {

    return async (req, res, next) => {

        const authHeader =
            req.header("Authorization");

        // ==========================
        // TOKEN CHECK
        // ==========================

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                message: "Authorization token missing"
            });

        }

        const token =
            authHeader.split(" ")[1];

        let decoded;

        try {

            decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );

        } catch (err) {

            console.error("Auth middleware error:", err);

            return res.status(401).json({
                message: "Invalid or Expired Token"
            });

        }

        req.user = decoded;

        if (decoded.sid) {
            try {
                const activeSession = await DeviceSession.findOne({
                    user: decoded.id,
                    sessionId: decoded.sid,
                    deviceId: decoded.deviceId
                }).select("_id lastActiveAt");

                if (!activeSession) {
                    return res.status(401).json({
                        message: "This device session has been revoked. Log in again."
                    });
                }

                if (
                    !activeSession.lastActiveAt ||
                    Date.now() - activeSession.lastActiveAt.getTime() > 5 * 60 * 1000
                ) {
                    activeSession.lastActiveAt = new Date();
                    await activeSession.save();
                }
            } catch (error) {
                console.error("Auth device session check failed:", error);
                return res.status(503).json({
                    message: "Could not verify this device session. Try again shortly."
                });
            }
        }

        // ==========================
        // ACCOUNT STATE (suspension / live role)
        // ==========================

        try {

            const state =
                await getAccountState(decoded.id);

            if (!state.exists) {

                return res.status(401).json({
                    message: "Invalid or Expired Token"
                });

            }

            if (state.isSuspended) {

                return res.status(403).json({
                    message:
                        "Your account has been suspended." +
                        (state.reason ? ` Reason: ${state.reason}` : "")
                });

            }

            req.user.role = state.role;

        } catch (err) {
            console.error("Auth account lookup failed:", err);
            return res.status(503).json({
                success: false,
                message: "Could not verify account status. Please try again shortly."
            });
        }

        // ==========================
        // ROLE CHECK
        // ==========================

        if (
            roles.length > 0 &&
            !roles.includes(req.user.role)
        ) {

            return res.status(403).json({
                message: "Access Denied"
            });

        }

        next();

    };

};

auth.invalidate = id => {
    cache.delete(String(id));
};

module.exports = auth;
