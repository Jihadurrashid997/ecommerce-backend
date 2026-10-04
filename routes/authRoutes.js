const express =
    require("express");

const router =
    express.Router();


const {
    register,
    login,
    me,
    forgotPassword,
    verifyResetCode,
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
FORGOT PASSWORD - step 1: request a code
POST /api/auth/forgot-password
Body: { email }
*/

router.post(
    "/forgot-password",
    forgotPassword
);


/*
FORGOT PASSWORD - step 2: verify the code
POST /api/auth/verify-reset-code
Body: { email, code }
Returns: { resetToken } on success
*/

router.post(
    "/verify-reset-code",
    verifyResetCode
);


/*
FORGOT PASSWORD - step 3: set the new password
POST /api/auth/reset-password
Body: { resetToken, password }
*/

router.post(
    "/reset-password",
    resetPassword
);


module.exports =
    router;
