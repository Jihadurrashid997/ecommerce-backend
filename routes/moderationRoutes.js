const express = require("express");
const auth = require("../middleware/auth");
const { createReport } = require("../controllers/adminModerationController");

const router = express.Router();

router.post("/reports", auth(), createReport);

module.exports = router;
