const User = require("../models/User");

// ==========================
// GET ALL USERS - ADMIN
// ==========================

exports.getUsers = async (req, res) => {
    try {

        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 });

        res.json(users);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: err.message
        });

    }
};


// ==========================
// GET MY PROFILE
// ==========================

exports.getProfile = async (req, res) => {
    try {

        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: err.message
        });

    }
};


// ==========================
// UPDATE MY PROFILE
// ==========================

exports.updateProfile = async (req, res) => {
    try {

        const {
            name,
            bio,
            location,
            profileImage
        } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }


        // ==========================
        // UPDATE NAME
        // ==========================

        if (
            typeof name === "string" &&
            name.trim()
        ) {
            user.name = name.trim();
        }


        // ==========================
        // UPDATE BIO
        // ==========================

        if (typeof bio === "string") {

            user.bio = bio.trim();

        }


        // ==========================
        // UPDATE LOCATION
        // ==========================

        if (typeof location === "string") {

            user.location = location.trim();

        }


        // ==========================
        // UPDATE PROFILE IMAGE
        // ==========================

        if (typeof profileImage === "string") {

            user.profileImage =
                profileImage.trim();

        }


        const updatedUser =
            await user.save();


        const safeUser =
            await User.findById(updatedUser._id)
                .select("-password");


        res.json({
            success: true,
            message: "Profile updated successfully",
            user: safeUser
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: err.message
        });

    }
};


// ==========================
// DELETE USER - ADMIN
// ==========================

exports.deleteUser = async (req, res) => {
    try {

        const user =
            await User.findById(req.params.id);

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        await User.findByIdAndDelete(
            req.params.id
        );

        res.json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: err.message
        });

    }
};
