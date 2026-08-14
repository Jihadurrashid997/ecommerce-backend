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

} =
    require("../controllers/userController");

const auth =
    require("../middleware/auth");


// ======================================================
// IMPORTANT ROUTE ORDER
// Specific routes MUST come before /:id
// ======================================================


// MY PROFILE

router.get(
    "/profile",
    auth(),
    getProfile
);


// UPDATE PROFILE

router.put(
    "/profile",
    auth(),
    updateProfile
);


// CHAT USERS

router.get(
    "/chat-users",
    auth(),
    getChatUsers
);


// PUBLIC USER SEARCH
// No authentication required

router.get(
    "/search",
    searchUsers
);


// PUBLIC PROFILE

router.get(
    "/public/:id",
    getPublicProfile
);


// ADMIN USERS

router.get(
    "/",
    auth(["admin"]),
    getUsers
);


// ADMIN DELETE

router.delete(
    "/:id",
    auth(["admin"]),
    deleteUser
);


module.exports =
    router;
