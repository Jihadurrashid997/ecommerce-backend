const express = require("express");

const router = express.Router();

const {
    getUsers,
    getProfile,
    updateProfile,
    deleteUser
} = require("../controllers/userController");

const auth = require("../middleware/auth");


// ==========================
// MY PROFILE
// ==========================

router.get(
    "/profile",
    auth(),
    getProfile
);


// ==========================
// UPDATE MY PROFILE
// ==========================

router.put(
    "/profile",
    auth(),
    updateProfile
);


// ==========================
// ADMIN - GET ALL USERS
// ==========================

router.get(
    "/",
    auth(["admin"]),
    getUsers
);


// ==========================
// ADMIN - DELETE USER
// ==========================

router.delete(
    "/:id",
    auth(["admin"]),
    deleteUser
);


module.exports = router;
