const express = require("express");

const router =
    express.Router();


const {
    register,
    login,
    me
} = require("../controllers/authController");


const auth =
    require("../middleware/auth");



// ==================================================
// PUBLIC ROUTES
// ==================================================


// ==============================
// REGISTER
// ==============================

router.post(
    "/register",
    register
);


// ==============================
// LOGIN
// ==============================

router.post(
    "/login",
    login
);



// ==================================================
// PROTECTED ROUTES
// ==================================================


// ==============================
// VERIFY CURRENT USER
// ==============================

router.get(
    "/me",
    auth(),
    me
);


// ==============================
// PROFILE
// ==============================

router.get(
    "/profile",
    auth(),
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                "Welcome to your profile!",

            user:
                req.user

        });

    }
);



module.exports = router;
