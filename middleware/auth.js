const jwt = require("jsonwebtoken");

const User = require("../models/User");

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

            // Database hiccup: fall back to the token's own
            // data instead of locking everybody out.
            console.error("Auth account lookup failed:", err.message);

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
