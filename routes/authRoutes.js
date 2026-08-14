```javascript
const express = require("express");

const router = express.Router();

const {
    register,
    login,
    me
} = require("../controllers/authController");


// ======================================================
// REGISTER
// ======================================================

router.post(
    "/register",
    register
);


// ======================================================
// LOGIN
// ======================================================

router.post(
    "/login",
    login
);


// ======================================================
// CURRENT USER
// ======================================================

const auth = require("../middleware/auth");

router.get(
    "/me",
    auth(),
    me
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;
```
