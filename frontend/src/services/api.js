import axios from "axios";

const api = axios.create({

    baseURL:
        "https://ecommerce-api-9wc9.onrender.com/api",

    headers: {
        "Content-Type": "application/json"
    }

});


// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

api.interceptors.request.use(

    (config) => {

        const token =
            localStorage.getItem("token");

        if (token) {

            config.headers.Authorization =
                `Bearer ${token}`;

        }

        return config;

    },

    (error) => {

        return Promise.reject(error);

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

        if (
            error.response?.status === 401
        ) {

            localStorage.removeItem("token");
            localStorage.removeItem("user");

        }

        return Promise.reject(error);

    }

);


export default api;
