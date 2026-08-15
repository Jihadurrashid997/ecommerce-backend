// frontend/src/services/api.js

import axios from "axios";

const API_BASE_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";

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

        if (status === 401) {

            /*
             * Do not immediately remove authentication
             * because some protected requests may fail
             * temporarily.
             */

            console.warn(
                "Authentication failed:",
                error?.response?.data
            );
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

    return `https://ecommerce-api-9wc9.onrender.com/${cleanPath}`;

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

    const params = {
        page,
        limit
    };

    if (userId) {
        params.userId =
            String(userId);
    }

    if (receiverId) {
        params.receiverId =
            String(receiverId);
    }

    if (roomId) {
        params.roomId =
            String(roomId);
    }

    return api.get(
        "/messages",
        {
            params
        }
    );

};


export const sendMessage = async (
    messageData
) => {

    return api.post(
        "/messages",
        messageData
    );

};


export const markMessageSeen = async (
    messageId
) => {

    if (!messageId) {
        throw new Error(
            "messageId is required"
        );
    }

    return api.patch(
        `/messages/${messageId}/seen`
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
