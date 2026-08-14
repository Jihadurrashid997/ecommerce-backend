const User = require("../models/User");


// ======================================================
// GET ALL USERS - ADMIN
// ======================================================

exports.getUsers = async (req, res) => {

    try {

        const users =
            await User.find()
                .select("-password")
                .sort({
                    createdAt: -1
                });

        res.status(200).json(users);

    } catch (err) {

        console.error(
            "Get users error:",
            err
        );

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// ======================================================
// GET CHAT USERS
// ======================================================

exports.getChatUsers = async (req, res) => {

    try {

        const currentUserId =
            req.user.id;


        const users =
            await User.find({
                _id: {
                    $ne: currentUserId
                }
            })
            .select(
                "_id name email role bio location profileImage createdAt"
            )
            .sort({
                name: 1
            });


        res.status(200).json({

            success: true,

            users

        });

    } catch (err) {

        console.error(
            "Get chat users error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to load users."

        });

    }

};


// ======================================================
// GET MY PROFILE
// ======================================================

exports.getProfile = async (req, res) => {

    try {

        const user =
            await User.findById(
                req.user.id
            )
            .select("-password");


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        res.status(200).json({

            success: true,

            user

        });

    } catch (err) {

        console.error(
            "Get profile error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ======================================================
// UPDATE MY PROFILE
// ======================================================

exports.updateProfile = async (
    req,
    res
) => {

    try {

        const {
            name,
            bio,
            location,
            profileImage
        } = req.body;


        const user =
            await User.findById(
                req.user.id
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        if (
            typeof name === "string" &&
            name.trim()
        ) {

            user.name =
                name.trim();

        }


        if (
            typeof bio === "string"
        ) {

            user.bio =
                bio.trim();

        }


        if (
            typeof location === "string"
        ) {

            user.location =
                location.trim();

        }


        if (
            typeof profileImage === "string"
        ) {

            user.profileImage =
                profileImage.trim();

        }


        await user.save();


        const safeUser =
            await User.findById(
                user._id
            )
            .select("-password");


        res.status(200).json({

            success: true,

            message:
                "Profile updated successfully",

            user:
                safeUser

        });

    } catch (err) {

        console.error(
            "Update profile error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};


// ======================================================
// SEARCH USERS
// ======================================================
//
// Search is intentionally simple and reliable.
// It searches every actual text field currently
// available in the User model.
//
// ======================================================

exports.searchUsers = async (
    req,
    res
) => {

    try {

        const keyword =
            String(
                req.query.q ||
                req.query.search ||
                ""
            )
            .trim();


        if (!keyword) {

            return res.status(200).json({

                success: true,

                users: []

            });

        }


        const escaped =
            keyword.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );


        const users =
            await User.find({

                $or: [

                    {
                        name: {
                            $regex:
                                escaped,
                            $options:
                                "i"
                        }
                    },

                    {
                        email: {
                            $regex:
                                escaped,
                            $options:
                                "i"
                        }
                    },

                    {
                        bio: {
                            $regex:
                                escaped,
                            $options:
                                "i"
                        }
                    },

                    {
                        location: {
                            $regex:
                                escaped,
                            $options:
                                "i"
                        }
                    },

                    {
                        role: {
                            $regex:
                                escaped,
                            $options:
                                "i"
                        }
                    }

                ]

            })
            .select(
                "_id name email role bio location profileImage createdAt"
            )
            .sort({
                name: 1
            })
            .limit(50);


        res.status(200).json({

            success: true,

            users

        });

    } catch (err) {

        console.error(
            "Search users error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to search users."

        });

    }

};


// ======================================================
// GET PUBLIC PROFILE
// ======================================================

exports.getPublicProfile = async (
    req,
    res
) => {

    try {

        const userId =
            req.params.id;


        if (!userId) {

            return res.status(400).json({

                success: false,

                message:
                    "User ID is required"

            });

        }


        const user =
            await User.findById(
                userId
            )
            .select(
                "_id name email role bio location profileImage createdAt"
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        res.status(200).json({

            success: true,

            user

        });

    } catch (err) {

        console.error(
            "Public profile error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to load profile."

        });

    }

};


// ======================================================
// DELETE USER - ADMIN
// ======================================================

exports.deleteUser = async (
    req,
    res
) => {

    try {

        const user =
            await User.findById(
                req.params.id
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        await User.findByIdAndDelete(
            req.params.id
        );


        res.status(200).json({

            success: true,

            message:
                "User deleted successfully"

        });

    } catch (err) {

        console.error(
            "Delete user error:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};
