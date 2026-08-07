const User = require("../models/User");

// ==========================
// Get All Users
// ==========================
exports.getUsers = async (req, res) => {

    try {

        const users = await User.find().select("-password");

        res.json(users);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

// ==========================
// Delete User
// ==========================
exports.deleteUser = async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        await User.findByIdAndDelete(req.params.id);

        res.json({
            message: "User deleted successfully"
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};
