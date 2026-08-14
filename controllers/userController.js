const mongoose = require("mongoose");
const User = require("../models/User");

// ======================================================
// HELPERS
// ======================================================

const safeUserFields = [
    "_id",
    "name",
    "email",
    "role",
    "bio",
    "location",
    "profileImage",
    "avatar",
    "image",
    "createdAt"
];

const normalizeUser = (user) => {

    if (!user) {
        return null;
    }

    const object =
        typeof user.toObject === "function"
            ? user.toObject()
            : user;

    return {
        _id: object._id,
        name: object.name || "",
        email: object.email || "",
        role: object.role || "customer",
        bio: object.bio || "",
        location: object.location || "",
        profileImage:
            object.profileImage ||
            object.avatar ||
            object.image ||
            "",
        createdAt: object.createdAt
    };
};

const escapeRegex = (value) => {

    return String(value || "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};


// ======================================================
// GET ALL USERS - ADMIN
// ======================================================

exports.getUsers = async (req, res) => {

    try {

        const page =
            Math.max(
                parseInt(req.query.page, 10) || 1,
                1
            );

        const limit =
            Math.min(
                Math.max(
                    parseInt(req.query.limit, 10) || 50,
                    1
                ),
                100
            );

        const search =
            String(
                req.query.search ||
                req.query.q ||
                ""
            ).trim();

        const role =
            String(
                req.query.role ||
                ""
            ).trim();

        const filter = {};

        if (search) {

            const regex =
                new RegExp(
                    escapeRegex(search),
                    "i"
                );

            filter.$or = [
                { name: regex },
                { email: regex },
                { bio: regex },
                { location: regex }
            ];

        }

        if (
            role &&
            ["customer", "seller", "admin"].includes(role)
        ) {

            filter.role = role;

        }

        const total =
            await User.countDocuments(filter);

        const users =
            await User.find(filter)
                .select(safeUserFields.join(" "))
                .sort({
                    createdAt: -1
                })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

        res.json({

            success: true,

            users:
                users.map(normalizeUser),

            pagination: {

                page,
                limit,
                total,

                totalPages:
                    Math.ceil(total / limit)

            }

        });

    } catch (err) {

        console.error(
            "GET USERS ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load users."

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
                    safeUserFields.join(" ")
                )
                .sort({
                    name: 1
                })
                .lean();

        res.json({

            success: true,

            users:
                users.map(normalizeUser)

        });

    } catch (err) {

        console.error(
            "GET CHAT USERS ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load chat users."

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
                .select(
                    safeUserFields.join(" ")
                )
                .lean();

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        res.json({

            success: true,

            user:
                normalizeUser(user)

        });

    } catch (err) {

        console.error(
            "GET PROFILE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load profile."

        });

    }

};


// ======================================================
// UPDATE PROFILE
// ======================================================

exports.updateProfile = async (req, res) => {

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
                    "User not found."

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

        const updated =
            await User.findById(
                user._id
            )
                .select(
                    safeUserFields.join(" ")
                )
                .lean();

        res.json({

            success: true,

            message:
                "Profile updated successfully.",

            user:
                normalizeUser(updated)

        });

    } catch (err) {

        console.error(
            "UPDATE PROFILE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to update profile."

        });

    }

};


// ======================================================
// SEARCH USERS
// ======================================================

exports.searchUsers = async (req, res) => {

    try {

        const keyword =
            String(
                req.query.q ||
                req.query.search ||
                req.query.keyword ||
                ""
            ).trim();

        if (!keyword) {

            return res.json({

                success: true,

                users: [],

                total: 0

            });

        }

        const regex =
            new RegExp(
                escapeRegex(keyword),
                "i"
            );

        /*
         * IMPORTANT:
         * Only search real User fields.
         * Do not dynamically search schema fields.
         */

        const filter = {

            $or: [

                {
                    name: regex
                },

                {
                    email: regex
                },

                {
                    bio: regex
                },

                {
                    location: regex
                },

                {
                    role: regex
                }

            ]

        };

        const users =
            await User.find(filter)
                .select(
                    safeUserFields.join(" ")
                )
                .sort({
                    name: 1
                })
                .limit(50)
                .lean();

        res.status(200).json({

            success: true,

            users:
                users.map(normalizeUser),

            total:
                users.length

        });

    } catch (err) {

        console.error(
            "SEARCH USERS ERROR:",
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
// PUBLIC USER PROFILE
// ======================================================

exports.getPublicProfile = async (req, res) => {

    try {

        const id =
            String(
                req.params.id || ""
            ).trim();

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user ID."

            });

        }

        const user =
            await User.findById(id)
                .select(
                    safeUserFields.join(" ")
                )
                .lean();

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        res.json({

            success: true,

            user:
                normalizeUser(user)

        });

    } catch (err) {

        console.error(
            "PUBLIC PROFILE ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to load user profile."

        });

    }

};


// ======================================================
// DELETE USER - ADMIN
// ======================================================

exports.deleteUser = async (req, res) => {

    try {

        const id =
            String(
                req.params.id || ""
            ).trim();

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid user ID."

            });

        }

        if (
            id.toString() ===
            req.user.id.toString()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Admin cannot delete their own account."

            });

        }

        const user =
            await User.findById(id);

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found."

            });

        }

        await User.findByIdAndDelete(id);

        res.json({

            success: true,

            message:
                "User deleted successfully."

        });

    } catch (err) {

        console.error(
            "DELETE USER ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
                "Failed to delete user."

        });

    }

};
