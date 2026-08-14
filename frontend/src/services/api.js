import axios from "axios";

/* =========================================================
   JR STORE - CENTRAL API
========================================================= */

const API_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";

const api = axios.create({
    baseURL: API_URL,

    timeout: 60000,

    headers: {
        "Content-Type": "application/json"
    }
});

/* =========================================================
   REQUEST
========================================================= */

api.interceptors.request.use(
    config => {

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

    error => {
        return Promise.reject(error);
    }
);

/* =========================================================
   RESPONSE
========================================================= */

api.interceptors.response.use(
    response => response,

    error => {

        const status =
            error.response?.status;

        const data =
            error.response?.data;

        const requestUrl =
            error.config?.url || "";

        const isLogin =
            requestUrl.includes("/auth/login");

        const isRegister =
            requestUrl.includes("/auth/register");

        /*
         * Authentication failure should NOT
         * destroy an existing session during login.
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

        const message =
            data?.message ||
            data?.error ||
            (
                error.code === "ECONNABORTED"
                    ? "Server response timeout. Please try again."
                    : error.message
            ) ||
            "Something went wrong.";

        error.jrMessage =
            message;

        return Promise.reject(
            error
        );
    }
);

export default api;
