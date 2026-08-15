import axios from "axios";

/* =========================================================
   JR STORE - CENTRAL API
========================================================= */

const API_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";

const api = axios.create({
    baseURL: API_URL,
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
    (error) =>
        Promise.reject(error)
);


/* =========================================================
   RESPONSE INTERCEPTOR
========================================================= */

api.interceptors.response.use(
    (response) =>
        response,

    (error) => {

        const status =
            error.response?.status;

        const url =
            error.config?.url || "";

        const isLogin =
            url.includes("/auth/login");

        const isRegister =
            url.includes("/auth/register");

        /*
         * Never remove authentication data while
         * login/register is being processed.
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

        return Promise.reject(error);

    }
);


/* =========================================================
   AUTH HELPERS
========================================================= */

export const getStoredToken = () =>
    localStorage.getItem("token");


export const getStoredUser = () => {

    try {

        const user =
            localStorage.getItem("user");

        return user
            ? JSON.parse(user)
            : null;

    } catch {

        return null;

    }

};


/* =========================================================
   USER ID HELPER
========================================================= */

export const getUserId = (user = null) => {

    const currentUser =
        user || getStoredUser();

    if (!currentUser) {
        return null;
    }

    return String(
        currentUser._id ||
        currentUser.id ||
        currentUser.userId ||
        ""
    ) || null;

};


/* =========================================================
   LOGOUT
========================================================= */

export const clearAuth = () => {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

};


/* =========================================================
   EXPORT
========================================================= */

export default api;
