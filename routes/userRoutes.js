const express = require("express");
const router = express.Router();

const {
    getUsers,
    deleteUser
} = require("../controllers/userController");

const auth = require("../middleware/auth");

// Get all users
router.get("/", auth(["admin"]), getUsers);

// Delete user
router.delete("/:id", auth(["admin"]), deleteUser);

module.exports = router;
