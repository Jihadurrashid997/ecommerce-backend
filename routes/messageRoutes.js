const express = require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const messageUpload =
    require("../middleware/messageUpload");

const {
    sendMessage,
    getConversation,
    getRecentConversations,
    markSeen,
    getUnreadCount,
    getUnreadByUser
} = require("../controllers/messageController");


/* =========================================================
   SEND MESSAGE

   messageUpload.single("file") parses an optional file
   attachment (image, pdf, doc, txt, zip - see
   middleware/messageUpload.js) sent from the chat's
   attach/image buttons. Plain text messages continue to
   work exactly as before since the field is optional.
========================================================= */

router.post(
    "/send",
    auth(),
    messageUpload.single("file"),
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
   GET RECENT CONVERSATIONS
========================================================= */

router.get(
    "/recent",
    auth(),
    getRecentConversations
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
