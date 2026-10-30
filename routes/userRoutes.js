const express = require("express");

const router =
    express.Router();

const {

    getUsers,
    getChatUsers,
    getMessengerPreferences,
    updateMessengerPreference,
    getProfile,
    updateProfile,
    searchUsers,
    getPublicProfile,
    deleteUser,
    blockUser,
    unblockUser,
    getBlockedUsers,
    getSettings,
    updateSettings,
    changePassword,
    getSocialStats,
    toggleFollow,
    getFollowing,
    getFollowRequests,
    respondToFollowRequest

} =
    require("../controllers/userController");

const auth =
    require("../middleware/auth");

const {
    profileUpload,
    handle
} = require("../middleware/postUpload");


// ======================================================
// IMPORTANT ROUTE ORDER
// Specific routes MUST come before /:id
// ======================================================


// MY PROFILE
router.get("/settings", auth(), getSettings);
router.patch("/settings", auth(), updateSettings);
router.patch("/change-password", auth(), changePassword);
router.get("/blocked", auth(), getBlockedUsers);

router.get(
    "/profile",
    auth(),
    getProfile
);


// UPDATE PROFILE

router.put(
    "/profile",
    auth(),
    handle(profileUpload, "profileImage"),
    updateProfile
);


// CHAT USERS

router.get(
    "/chat-users",
    auth(),
    getChatUsers
);

router.get(
    "/messenger-preferences",
    auth(),
    getMessengerPreferences
);

router.patch(
    "/messenger-preferences/:conversationId",
    auth(),
    updateMessengerPreference
);


// SOCIAL (follow + profile stats)

router.get(
    "/social/:id",
    auth(),
    getSocialStats
);

router.post(
    "/follow/:id",
    auth(),
    toggleFollow
);

router.get(
    "/follow-requests",
    auth(),
    getFollowRequests
);

router.post(
    "/follow-requests/:id/respond",
    auth(),
    respondToFollowRequest
);

router.get(
    "/following",
    auth(),
    getFollowing
);


// BLOCK / UNBLOCK

router.post(
    "/block/:id",
    auth(),
    blockUser
);

router.post(
    "/unblock/:id",
    auth(),
    unblockUser
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
