const User = require("../models/User");

// ==========================
// Get All Users
// ==========================

exports.getUsers = async (req, res) => {

    try {

        const users = await User
            .find()
            .select("-password");

        res.json(users);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: err.message
        });

    }

};


// ==========================
// Update My Profile
// ==========================

exports.updateProfile = async (req, res) => {

    try {

        const {
            name,
            bio,
            location,
            profileImage
        } = req.body;


        const user = await User.findById(
            req.user.id
        );


        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }


        // Update Name

        if (name !== undefined) {

            if (!name.trim()) {

                return res.status(400).json({
                    message: "Name cannot be empty"
                });

            }

            user.name = name.trim();

        }


        // Update Bio

        if (bio !== undefined) {

            user.bio = bio.trim();

        }


        // Update Location

        if (location !== undefined) {

            user.location =
                location.trim();

        }


        // Update Profile Image

        if (profileImage !== undefined) {

            user.profileImage =
                profileImage;

        }


        await user.save();


        const updatedUser =
            await User
                .findById(user._id)
                .select("-password");


        res.json({

            message:
                "Profile updated successfully",

            user: updatedUser

        });


    } catch (err) {

        console.error(err);

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

        const user =
            await User.findById(
                req.params.id
            );


        if (!user) {

            return res.status(404).json({

                message:
                    "User not found"

            });

        }


        await User.findByIdAndDelete(
            req.params.id
        );


        res.json({

            message:
                "User deleted successfully"

        });


    } catch (err) {

        console.error(err);

        res.status(500).json({

            message:
                err.message

        });

    }

};
