import axios from "axios";

/*
=========================================================
JR STORE - CENTRAL API CONFIGURATION
=========================================================

IMPORTANT:
Frontend:
https://ecommerce-backend-1-a9y7.onrender.com

Backend API:
https://ecommerce-api-9wc9.onrender.com

We intentionally keep the production API URL fixed here.
This prevents an incorrect Render REACT_APP_API_URL
environment variable from breaking login/search/chat.
=========================================================
*/

const API_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";


const api = axios.create({

    baseURL: API_URL,

    headers: {
        "Content-Type": "application/json"
    },

    timeout: 30000

});


/*
=========================================================
REQUEST INTERCEPTOR
=========================================================
*/

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


/*
=========================================================
RESPONSE INTERCEPTOR
=========================================================
*/

api.interceptors.response.use(

    (response) => {

        return response;

    },

    (error) => {

        const status =
            error.response?.status;

        /*
        Do NOT immediately logout on every 401
        from login/register requests.
        */

        const requestUrl =
            error.config?.url || "";

        const isAuthRequest =
            requestUrl.includes("/auth/login") ||
            requestUrl.includes("/auth/register");

        if (
            status === 401 &&
            !isAuthRequest
        ) {

            localStorage.removeItem("token");
            localStorage.removeItem("user");

        }

        return Promise.reject(error);

    }

);


export default api;
