const express =
    require("express");

const router =
    express.Router();


const {
    register,
    login,
    me,
    forgotPassword,
    resetPassword
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


/*
FORGOT PASSWORD
POST /api/auth/forgot-password
Body: { email }
*/

router.post(
    "/forgot-password",
    forgotPassword
);


/*
RESET PASSWORD
POST /api/auth/reset-password/:token
Body: { password }
*/

router.post(
    "/reset-password/:token",
    resetPassword
);


module.exports =
    router;
