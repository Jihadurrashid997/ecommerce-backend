import axios from "axios";


const API_URL =
    "https://ecommerce-api-9wc9.onrender.com/api";


const api =
    axios.create({

        baseURL:
            API_URL,

        timeout:
            20000,

        headers: {
            "Content-Type":
                "application/json"
        }

    });


// ======================================================
// REQUEST
// ======================================================

api.interceptors.request.use(

    config => {

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

    error =>
        Promise.reject(error)

);


// ======================================================
// RESPONSE
// ======================================================

api.interceptors.response.use(

    response =>
        response,

    error => {

        if (
            error.response?.status ===
            401
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
