const express = require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const {
    sendMessage,
    getConversation,
    markSeen
} =
    require("../controllers/messageController");


// ==========================
// SEND MESSAGE
// ==========================

router.post(
    "/send",
    auth(),
    sendMessage
);


// ==========================
// GET CONVERSATION
// ==========================

router.get(
    "/conversation/:userId",
    auth(),
    getConversation
);


// ==========================
// MARK SEEN
// ==========================

router.put(
    "/seen/:userId",
    auth(),
    markSeen
);


module.exports = router;
