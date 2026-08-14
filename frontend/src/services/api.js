// ============================================================
// JR STORE - CENTRAL API SERVICE
// ============================================================

import axios from "axios";

const API_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";

// ============================================================
// AXIOS INSTANCE
// ============================================================

const api = axios.create({

    baseURL: API_URL,

    timeout: 30000,

    headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
    }

});

// ============================================================
// REQUEST INTERCEPTOR
// ============================================================

api.interceptors.request.use(

    (config) => {

        const token =
            localStorage.getItem("token");

        if (token) {

            config.headers =
                config.headers || {};

            config.headers.Authorization =
                `Bearer ${token}`;

        }

        return config;

    },

    (error) => {

        return Promise.reject(error);

    }

);

// ============================================================
// RESPONSE INTERCEPTOR
// ============================================================

api.interceptors.response.use(

    (response) => {

        return response;

    },

    (error) => {

        const status =
            error?.response?.status;

        const requestUrl =
            error?.config?.url || "";

        const isLogin =
            requestUrl.includes(
                "/auth/login"
            );

        const isRegister =
            requestUrl.includes(
                "/auth/register"
            );

        /*
         * Never delete the login credentials/token here.
         *
         * A failed login must be handled by the login page.
         * This interceptor is only responsible for expired
         * authenticated sessions.
         */

        if (
            status === 401 &&
            !isLogin &&
            !isRegister
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "user"
            );

        }

        return Promise.reject(
            error
        );

    }

);

// ============================================================
// API HELPER
// ============================================================

export const getApiErrorMessage = (
    error,
    fallback = "Something went wrong"
) => {

    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback
    );

};

export default api;
