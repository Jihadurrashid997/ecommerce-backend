import axios from "axios";


const API_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";


const api =
    axios.create({

        baseURL: API_URL,

        headers: {
            "Content-Type":
                "application/json"
        },

        timeout: 30000

    });


// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

api.interceptors.request.use(

    (config) => {

        const token =
            localStorage.getItem(
                "token"
            );


        if (token) {

            config.headers =
                config.headers || {};

            config.headers.Authorization =
                `Bearer ${token}`;

        }


        return config;

    },


    (error) => {

        return Promise.reject(
            error
        );

    }

);


// ======================================================
// RESPONSE INTERCEPTOR
// ======================================================

api.interceptors.response.use(

    (response) => {

        return response;

    },


    (error) => {

        const status =
            error.response?.status;


        const url =
            error.config?.url || "";


        // Never clear login data because
        // login/register itself returned 401.
        const authRequest =
            url.includes(
                "/auth/login"
            ) ||
            url.includes(
                "/auth/register"
            );


        if (
            status === 401 &&
            !authRequest
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


export default api;
