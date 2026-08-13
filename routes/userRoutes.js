const express = require("express");

const router =
    express.Router();


const {
    getUsers,
    getChatUsers,
    getProfile,
    updateProfile,
    searchUsers,
    getPublicProfile,
    deleteUser
} = require("../controllers/userController");


const auth =
    require("../middleware/auth");


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
// CHAT USERS
// ==========================

router.get(
    "/chat-users",
    auth(),
    getChatUsers
);


// ==========================
// SEARCH USERS
// ==========================

router.get(
    "/search",
    searchUsers
);


// ==========================
// PUBLIC USER PROFILE
// ==========================

router.get(
    "/public/:id",
    getPublicProfile
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
