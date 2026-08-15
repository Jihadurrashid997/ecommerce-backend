const express = require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const {
    sendMessage,
    getConversation,
    markSeen,
    getUnreadCount,
    getUnreadByUser
} =
    require("../controllers/messageController");


/* =========================================================
   SEND MESSAGE
========================================================= */

router.post(
    "/send",
    auth(),
    sendMessage
);


/* =========================================================
   GET CONVERSATION
========================================================= */

router.get(
    "/conversation/:userId",
    auth(),
    getConversation
);


/* =========================================================
   MARK CONVERSATION AS SEEN
========================================================= */

router.put(
    "/seen/:userId",
    auth(),
    markSeen
);


/* =========================================================
   TOTAL UNREAD COUNT
========================================================= */

router.get(
    "/unread",
    auth(),
    getUnreadCount
);


/* =========================================================
   UNREAD COUNT BY USER
========================================================= */

router.get(
    "/unread/by-user",
    auth(),
    getUnreadByUser
);


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;
