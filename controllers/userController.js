const User =
    require("../models/User");


// ==========================
// GET ALL USERS - ADMIN
// ==========================

exports.getUsers =
    async (req, res) => {

        try {

            const users =
                await User.find()
                    .select("-password")
                    .sort({
                        createdAt: -1
                    });


            res.json(users);


        } catch (err) {

            console.error(err);


            res.status(500).json({

                message:
                    err.message

            });

        }

    };


// ==========================
// GET CHAT USERS
// ==========================

exports.getChatUsers =
    async (req, res) => {

        try {

            const currentUserId =
                req.user.id;


            const users =
                await User.find({

                    _id: {
                        $ne:
                            currentUserId
                    }

                })
                    .select(
                        "_id name email role bio location profileImage avatar image createdAt"
                    )
                    .sort({
                        name: 1
                    });


            res.json({

                success:
                    true,

                users

            });


        } catch (err) {

            console.error(
                "Get chat users error:",
                err
            );


            res.status(500).json({

                success:
                    false,

                message:
                    err.message

            });

        }

    };


// ==========================
// GET MY PROFILE
// ==========================

exports.getProfile =
    async (req, res) => {

        try {

            const user =
                await User.findById(
                    req.user.id
                )
                    .select("-password");


            if (!user) {

                return res.status(404).json({

                    message:
                        "User not found"

                });

            }


            res.json({

                success:
                    true,

                user

            });


        } catch (err) {

            console.error(err);


            res.status(500).json({

                message:
                    err.message

            });

        }

    };


// ==========================
// UPDATE MY PROFILE
// ==========================

exports.updateProfile =
    async (req, res) => {

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


            const updatedUser =
                await user.save();


            const safeUser =
                await User.findById(
                    updatedUser._id
                )
                    .select("-password");


            res.json({

                success:
                    true,

                message:
                    "Profile updated successfully",

                user:
                    safeUser

            });


        } catch (err) {

            console.error(err);


            res.status(500).json({

                message:
                    err.message

            });

        }

    };


// ==========================
// SEARCH USERS
// ==========================

exports.searchUsers = async (req, res) => {

    try {

        const keyword =
            String(
                req.query.q ||
                req.query.search ||
                ""
            ).trim();


        // Empty search
        if (!keyword) {

            return res.json({
                success: true,
                users: []
            });

        }


        // Escape regex characters
        const escapedKeyword =
            keyword.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );


        // ==========================================
        // FIND ALL STRING FIELDS FROM USER SCHEMA
        // ==========================================

        const searchableFields =
            Object.keys(User.schema.paths)
                .filter(field => {

                    const schemaType =
                        User.schema.paths[field];

                    return (
                        schemaType.instance === "String" &&
                        field !== "password" &&
                        field !== "__v"
                    );

                });


        console.log(
            "Search fields:",
            searchableFields
        );


        // ==========================================
        // BUILD SEARCH QUERY
        // ==========================================

        const searchConditions =
            searchableFields.map(field => ({

                [field]: {
                    $regex: escapedKeyword,
                    $options: "i"
                }

            }));


        // ==========================================
        // SEARCH
        // ==========================================

        const users =
            await User.find({

                $or: searchConditions

            })
            .select(
                "_id name username email role bio location profileImage avatar image firstName lastName createdAt"
            )
            .limit(30);


        console.log(
            `User search "${keyword}" → ${users.length} users`
        );


        // ==========================================
        // RESPONSE
        // ==========================================

        return res.status(200).json({

            success: true,

            users

        });


    } catch (err) {

        console.error(
            "SEARCH USERS ERROR:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to search users",

            error:
                err.message

        });

    }

};

// ==========================
// GET PUBLIC PROFILE
// ==========================

exports.getPublicProfile =
    async (req, res) => {

        try {

            const user =
                await User.findById(
                    req.params.id
                )
                    .select(
                        "_id name email username role bio location profileImage avatar image createdAt"
                    );


            if (!user) {

                return res.status(404).json({

                    message:
                        "User not found"

                });

            }


            res.json({

                success:
                    true,

                user

            });


        } catch (err) {

            console.error(
                "Get public profile error:",
                err
            );


            res.status(500).json({

                message:
                    err.message

            });

        }

    };


// ==========================
// DELETE USER - ADMIN
// ==========================

exports.deleteUser =
    async (req, res) => {

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

                success:
                    true,

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
