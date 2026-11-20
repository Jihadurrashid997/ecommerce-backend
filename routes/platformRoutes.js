const express = require("express");
const router = express.Router();
const platform = require("../controllers/platformController");

router.get("/settings", platform.getSettings);
router.get("/android-release/latest", platform.getLatestAndroidRelease);

module.exports = router;
