import axios from "axios";


const API_URL =
    (
        process.env.REACT_APP_API_URL ||
        "https://ecommerce-api-9wc9.onrender.com/api"
    ).replace(/\/+$/, "");


const api =
    axios.create({

        baseURL: API_URL,

        headers: {

            "Content-Type":
                "application/json"

        },

        timeout: 15000

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

    (error) =>
        Promise.reject(error)

);


// ======================================================
// RESPONSE INTERCEPTOR
// ======================================================

api.interceptors.response.use(

    (response) =>
        response,

    (error) => {

        const status =
            error.response?.status;


        if (status === 401) {

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
