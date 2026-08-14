import axios from "axios";

const API_URL = (
    process.env.REACT_APP_API_URL ||
    "https://ecommerce-api-9wc9.onrender.com/api"
).replace(/\/+$/, "");

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json"
    }
});


// ================================
// REQUEST INTERCEPTOR
// ================================

api.interceptors.request.use(
    (config) => {

        const token = localStorage.getItem("token");

        if (token) {

            config.headers = config.headers || {};

            config.headers.Authorization =
                `Bearer ${token}`;
        }

        return config;
    },

    (error) => {
        return Promise.reject(error);
    }
);


// ================================
// RESPONSE INTERCEPTOR
// ================================

api.interceptors.response.use(
    (response) => {
        return response;
    },

    (error) => {

        if (error.response?.status === 401) {

            const currentPath =
                window.location.pathname;

            // Do not automatically destroy
            // login state while already on login/register.
            if (
                currentPath !== "/login" &&
                currentPath !== "/register"
            ) {

                localStorage.removeItem("token");
                localStorage.removeItem("user");
            }
        }

        return Promise.reject(error);
    }
);


export default api;
