const express = require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const messageUpload =
    require("../middleware/messageUpload");

const {
    sendMessage,
    saveEncryptionPublicKey,
    getEncryptionPublicKey,
    saveEncryptionKeyBackup,
    getEncryptionKeyBackup,
    getConversation,
    getAttachmentDownload,
    getRecentConversations,
    markSeen,
    getUnreadCount,
    getUnreadByUser,
    reactToMessage,
    editMessage,
    deleteMessage,
    migrateMessageAttachment,
    createCallLog
} = require("../controllers/messageController");
const {
    createMessageRequest,
    getMessageRequests,
    acceptMessageRequest,
    deleteMessageRequest,
    blockMessageRequestSender,
    reportMessageRequest
} = require("../controllers/messageRequestController");
const {
    startLiveLocation,
    updateLiveLocation,
    stopLiveLocation,
    getLiveLocations
} = require("../controllers/liveLocationController");


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
                                ? `File is too large (max ${Math.round(messageUpload.maxFileSize / (1024 * 1024))}MB).`
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
    messageUpload.cleanup,
    handleUpload,
    messageUpload.validateContent,
    sendMessage
);

router.put(
    "/encryption-key",
    auth(),
    saveEncryptionPublicKey
);

router.put(
    "/encryption-key-backup",
    auth(),
    saveEncryptionKeyBackup
);

router.get(
    "/encryption-key-backup",
    auth(),
    getEncryptionKeyBackup
);

router.get(
    "/encryption-key/:userId",
    auth(),
    getEncryptionPublicKey
);


/* =========================================================
   GET CONVERSATION
========================================================= */

router.get(
    "/conversation/:userId",
    auth(),
    getConversation
);

router.get(
    "/:id/attachment-download",
    auth(),
    getAttachmentDownload
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

router.post(
    "/call-log",
    auth(),
    createCallLog
);

router.post(
    "/requests",
    auth(),
    handleUpload,
    messageUpload.validateContent,
    createMessageRequest
);

router.get(
    "/live-locations",
    auth(),
    getLiveLocations
);

router.post(
    "/live-locations",
    auth(),
    startLiveLocation
);

router.patch(
    "/live-locations/:shareId",
    auth(),
    updateLiveLocation
);

router.delete(
    "/live-locations/:shareId",
    auth(),
    stopLiveLocation
);

router.get(
    "/requests",
    auth(),
    getMessageRequests
);

router.post(
    "/requests/:id/accept",
    auth(),
    acceptMessageRequest
);

router.delete(
    "/requests/:id",
    auth(),
    deleteMessageRequest
);

router.post(
    "/requests/:id/block",
    auth(),
    blockMessageRequestSender
);

router.post(
    "/requests/:id/report",
    auth(),
    reportMessageRequest
);

router.post(
    "/:id/migrate-attachment",
    auth(),
    migrateMessageAttachment
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
