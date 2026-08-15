import api from "./api";


/* =========================================================
   JR STORE - AUTH / USER ID SERVICE
========================================================= */


/* =========================================================
   STORAGE KEYS
========================================================= */

const TOKEN_KEY = "token";
const USER_KEY = "user";


/* =========================================================
   NORMALIZE USER ID
========================================================= */

export const normalizeUserId = (user) => {

    if (!user) {
        return null;
    }

    if (
        typeof user === "string" ||
        typeof user === "number"
    ) {
        return String(user);
    }

    return (
        user._id ||
        user.id ||
        user.userId ||
        user.user?._id ||
        user.user?.id ||
        null
    )
        ? String(
            user._id ||
            user.id ||
            user.userId ||
            user.user?._id ||
            user.user?.id
        )
        : null;
};


/* =========================================================
   GET TOKEN
========================================================= */

export const getToken = () => {

    return localStorage.getItem(
        TOKEN_KEY
    );

};


/* =========================================================
   GET STORED USER
========================================================= */

export const getStoredUser = () => {

    try {

        const raw =
            localStorage.getItem(
                USER_KEY
            );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);

    } catch (error) {

        console.error(
            "Stored user parse error:",
            error
        );

        localStorage.removeItem(
            USER_KEY
        );

        return null;
    }
};


/* =========================================================
   GET CURRENT USER ID
========================================================= */

export const getCurrentUserId = () => {

    const user =
        getStoredUser();

    return normalizeUserId(
        user
    );
};


/* =========================================================
   SAVE AUTH DATA
========================================================= */

export const saveAuthData = ({
    token,
    user
} = {}) => {

    if (token) {

        localStorage.setItem(
            TOKEN_KEY,
            token
        );

    }

    if (user) {

        localStorage.setItem(
            USER_KEY,
            JSON.stringify(user)
        );

    }
};


/* =========================================================
   CLEAR AUTH DATA
========================================================= */

export const clearAuthData = () => {

    localStorage.removeItem(
        TOKEN_KEY
    );

    localStorage.removeItem(
        USER_KEY
    );

};


/* =========================================================
   IS LOGGED IN
========================================================= */

export const isAuthenticated = () => {

    return Boolean(
        getToken() &&
        getCurrentUserId()
    );

};


/* =========================================================
   LOGIN
========================================================= */

export const loginUser = async (
    credentials
) => {

    const response =
        await api.post(
            "/auth/login",
            credentials
        );

    const data =
        response?.data || {};

    const token =
        data.token ||
        data.accessToken ||
        data.data?.token ||
        data.data?.accessToken;

    const user =
        data.user ||
        data.data?.user ||
        data.data;

    if (token || user) {

        saveAuthData({
            token,
            user
        });

    }

    return response;
};


/* =========================================================
   REGISTER
========================================================= */

export const registerUser = async (
    userData
) => {

    const response =
        await api.post(
            "/auth/register",
            userData
        );

    const data =
        response?.data || {};

    const token =
        data.token ||
        data.accessToken ||
        data.data?.token ||
        data.data?.accessToken;

    const user =
        data.user ||
        data.data?.user;

    if (token || user) {

        saveAuthData({
            token,
            user
        });

    }

    return response;
};


/* =========================================================
   REFRESH USER FROM BACKEND
========================================================= */

export const refreshCurrentUser = async () => {

    const userId =
        getCurrentUserId();

    if (!userId) {
        return null;
    }

    try {

        const response =
            await api.get(
                `/users/${userId}`
            );

        const data =
            response?.data || {};

        const user =
            data.user ||
            data.data ||
            data;

        if (user) {

            localStorage.setItem(
                USER_KEY,
                JSON.stringify(user)
            );

        }

        return user;

    } catch (error) {

        console.warn(
            "Could not refresh current user:",
            error?.response?.data ||
            error?.message ||
            error
        );

        return getStoredUser();
    }
};


/* =========================================================
   LOGOUT
========================================================= */

export const logoutUser = async () => {

    try {

        /*
         * If backend has logout endpoint,
         * this request can be handled there.
         */
        await api.post(
            "/auth/logout"
        );

    } catch (_) {

        /*
         * Logout must still happen locally
         * even if backend endpoint does not exist.
         */

    } finally {

        clearAuthData();

    }
};


/* =========================================================
   USER OBJECT FOR SOCKET
========================================================= */

export const getSocketUser = () => {

    const user =
        getStoredUser();

    const userId =
        normalizeUserId(
            user
        );

    if (!userId) {
        return null;
    }

    return {
        ...user,
        _id: userId,
        id: userId,
        userId
    };
};


/* =========================================================
   AUTH HEADER
========================================================= */

export const getAuthHeader = () => {

    const token =
        getToken();

    if (!token) {
        return {};
    }

    return {
        Authorization:
            `Bearer ${token}`
    };
};


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
    normalizeUserId,
    getToken,
    getStoredUser,
    getCurrentUserId,
    saveAuthData,
    clearAuthData,
    isAuthenticated,
    loginUser,
    registerUser,
    refreshCurrentUser,
    logoutUser,
    getSocketUser,
    getAuthHeader
};
