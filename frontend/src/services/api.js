// frontend/src/services/api.js

import axios from "axios";

const DEFAULT_API_BASE_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";

const configuredApiUrl =
    process.env.REACT_APP_API_URL || DEFAULT_API_BASE_URL;

const API_BASE_URL =
    configuredApiUrl.replace(/\/+$/, "").endsWith("/api")
        ? configuredApiUrl.replace(/\/+$/, "")
        : `${configuredApiUrl.replace(/\/+$/, "")}/api`;

export const getSocketBaseUrl = () =>
    (
        process.env.REACT_APP_SOCKET_URL ||
        API_BASE_URL.replace(/\/api$/, "")
    ).replace(/\/+$/, "");

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,

    headers: {
        "Content-Type": "application/json"
    }
});


/* =========================================================
   REQUEST INTERCEPTOR
========================================================= */

api.interceptors.request.use(
    (config) => {

        try {

            const token =
                localStorage.getItem("token");

            if (token) {

                config.headers =
                    config.headers || {};

                config.headers.Authorization =
                    `Bearer ${token}`;
            }

        } catch (error) {

            console.warn(
                "Auth token read error:",
                error
            );

        }

        return config;

    },

    (error) => {

        return Promise.reject(
            error
        );

    }
);


/* =========================================================
   RESPONSE INTERCEPTOR
========================================================= */

api.interceptors.response.use(
    (response) => {

        return response;

    },

    async (error) => {

        const status =
            error?.response?.status;

        if (
            status === 403 &&
            /suspended/i.test(error?.response?.data?.message || "") &&
            localStorage.getItem("token")
        ) {

            localStorage.removeItem("token");
            localStorage.removeItem("user");

            if (
                typeof window !== "undefined" &&
                !window.location.pathname.startsWith("/login")
            ) {

                window.location.href = "/login";

            }

        }

        if (status === 401) {

            const hadToken =
                Boolean(
                    localStorage.getItem("token")
                );

            /*
             * A 401 with no stored token just means a
             * login/signup attempt was rejected (wrong
             * email or password) - that's a normal form
             * error, not a session problem, so leave it
             * to the calling screen to show its own
             * message.
             *
             * A 401 WITH a stored token means the token
             * itself is invalid or expired (e.g. it's
             * been 7+ days, the server's JWT secret
             * changed, etc). Previously this just logged
             * a warning and left the stale token in
             * place, so every subsequent action (sending
             * a message, etc) kept failing with the same
             * raw "Invalid or Expired Token" alert and
             * the person had no way out except manually
             * clearing storage. Now we clear the stale
             * session and send them back to log in again.
             */

            if (hadToken) {

                console.warn(
                    "Session expired - logging out.",
                    error?.response?.data
                );

                localStorage.removeItem("token");
                localStorage.removeItem("user");

                if (
                    typeof window !== "undefined" &&
                    !window.location.pathname.startsWith(
                        "/login"
                    )
                ) {

                    window.location.href =
                        "/login?sessionExpired=1";

                }

            } else {

                console.warn(
                    "Authentication failed:",
                    error?.response?.data
                );

            }

        }

        if (!error.response) {

            console.error(
                "Network error:",
                error?.message
            );

        }

        return Promise.reject(
            error
        );

    }
);


/* =========================================================
   API URL HELPER
========================================================= */

export const getApiUrl = (
    endpoint = ""
) => {

    const cleanEndpoint =
        String(endpoint)
            .replace(/^\/+/, "");

    return `${API_BASE_URL}/${cleanEndpoint}`;

};


/* =========================================================
   UPLOAD URL HELPER
========================================================= */

export const getUploadUrl = (
    filePath = ""
) => {

    if (!filePath) {
        return "";
    }

    const value =
        String(filePath);

    if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("blob:") ||
        value.startsWith("data:")
    ) {
        return value;
    }

    const cleanPath =
        value.replace(/^\/+/, "");

    return `${getSocketBaseUrl()}/${cleanPath}`;
};


/* =========================================================
   MESSAGE API
========================================================= */

export const getMessages = async ({
    userId,
    receiverId,
    roomId,
    page = 1,
    limit = 50
} = {}) => {

    const conversationUserId = receiverId || roomId || userId;

    if (!conversationUserId) {
        throw new Error("A conversation user ID is required");
    }

    return api.get(
        `/messages/conversation/${conversationUserId}`,
        { params: { page, limit } }
    );

};


export const sendMessage = async (
    messageData
) => {

    return api.post("/messages/send", messageData);

};


export const markMessageSeen = async (
    userId
) => {

    if (!userId) {
        throw new Error(
            "userId is required"
        );
    }

    return api.put(
        `/messages/seen/${userId}`
    );

};


export const deleteMessage = async (
    messageId
) => {

    if (!messageId) {
        throw new Error(
            "messageId is required"
        );
    }

    return api.delete(
        `/messages/${messageId}`
    );

};


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default api;
