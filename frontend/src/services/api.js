```javascript
import axios from "axios";


// ======================================================
// API BASE URL
// ======================================================

const API_URL = (
    process.env.REACT_APP_API_URL ||
    "https://ecommerce-api-9wc9.onrender.com/api"
).replace(/\/+$/, "");


const api = axios.create({

    baseURL: API_URL,

    headers: {
        "Content-Type": "application/json"
    },

    timeout: 30000

});


// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

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


        // Only clear login data
        // when server actually returns 401

        if (status === 401) {

            localStorage.removeItem("token");
            localStorage.removeItem("user");

        }


        return Promise.reject(error);

    }

);


export default api;
```
