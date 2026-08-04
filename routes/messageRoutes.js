const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {

    sendMessage,
    getConversation,
    markSeen

} = require("../controllers/messageController");

router.post("/send", auth(), sendMessage);

router.get("/conversation/:userId", auth(), getConversation);

router.put("/seen/:userId", auth(), markSeen);

module.exports = router;
