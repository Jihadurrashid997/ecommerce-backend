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
    getUnreadByUser,
    reactToMessage,
    editMessage,
    deleteMessage
} = require("../controllers/messageController");


const multer =
    require("multer");

/*
 * Without this wrapper, a rejected file (wrong type, too
 * large) throws inside messageUpload's multer instance and
 * falls through to Express's default error handler, which
 * can send back a raw HTML page or just drop the
 * connection depending on environment - the frontend then
 * sees a generic network error with no real message, which
 * looks exactly like "nothing happens" when sending a
 * photo/file/voice note.
 */

const handleUpload =
    (req, res, next) => {

        messageUpload.single("file")(
            req,
            res,
            error => {

                if (error instanceof multer.MulterError) {

                    return res.status(400).json({
                        success: false,
                        message:
                            error.code === "LIMIT_FILE_SIZE"
                                ? "File is too large (max 10MB)."
                                : `Upload error: ${error.message}`
                    });

                }

                if (error) {

                    return res.status(400).json({
                        success: false,
                        message:
                            error.message ||
                            "This file type isn't supported."
                    });

                }

                next();

            }
        );

    };


/* =========================================================
   SEND MESSAGE

   handleUpload parses an optional file attachment (image,
   pdf, doc, txt, zip, or voice note - see
   middleware/messageUpload.js) sent from the chat's
   attach/image/mic buttons, and turns any rejection into a
   clean JSON error. Plain text messages continue to work
   exactly as before since the field is optional.
========================================================= */

router.post(
    "/send",
    auth(),
    handleUpload,
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

/* =========================================================
   REACT TO A MESSAGE
========================================================= */

router.put(
    "/:id/react",
    auth(),
    reactToMessage
);


/* =========================================================
   EDIT A MESSAGE
========================================================= */

router.put(
    "/:id",
    auth(),
    editMessage
);


/* =========================================================
   DELETE A MESSAGE
========================================================= */

router.delete(
    "/:id",
    auth(),
    deleteMessage
);


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;
