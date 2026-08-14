const express =
    require("express");

const router =
    express.Router();


const {
    register,
    login,
    me
} =
    require("../controllers/authController");


const auth =
    require("../middleware/auth");


/*
=========================================================
AUTH ROUTES
=========================================================
*/


/*
REGISTER
POST /api/auth/register
*/

router.post(
    "/register",
    register
);


/*
LOGIN
POST /api/auth/login
*/

router.post(
    "/login",
    login
);


/*
CURRENT USER
GET /api/auth/me

Requires:
Authorization: Bearer TOKEN
*/

router.get(
    "/me",
    auth(),
    me
);


module.exports =
    router;
