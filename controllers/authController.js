const User =
    require("../models/User");

const bcrypt =
    require("bcryptjs");

const jwt =
    require("jsonwebtoken");


/*
=========================================================
HELPERS
=========================================================
*/

const createToken = (user) => {

    if (!process.env.JWT_SECRET) {

        throw new Error(
            "JWT_SECRET is not configured on the server"
        );

    }

    return jwt.sign(

        {
            id: user._id.toString(),
            role: user.role || "customer"
        },

        process.env.JWT_SECRET,

        {
            expiresIn: "7d"
        }

    );

};


const safeUser = (user) => {

    return {

        id:
            user._id,

        _id:
            user._id,

        name:
            user.name,

        email:
            user.email,

        role:
            user.role || "customer",

        bio:
            user.bio || "",

        location:
            user.location || "",

        profileImage:
            user.profileImage || "",

        createdAt:
            user.createdAt

    };

};


/*
=========================================================
REGISTER
=========================================================
*/

exports.register = async (
    req,
    res
) => {

    try {

        const {
            name,
            email,
            password
        } = req.body || {};


        const cleanName =
            String(name || "").trim();

        const normalizedEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        const cleanPassword =
            String(password || "");


        /*
        VALIDATION
        */

        if (
            !cleanName ||
            !normalizedEmail ||
            !cleanPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, email and password are required"

            });

        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(normalizedEmail)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Please enter a valid email address"

            });

        }


        if (
            cleanPassword.length < 8
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must be at least 8 characters"

            });

        }


        /*
        CHECK EXISTING USER
        */

        const existingUser =
            await User.findOne({

                email:
                    normalizedEmail

            });


        if (existingUser) {

            return res.status(409).json({

                success: false,

                message:
                    "An account already exists with this email"

            });

        }


        /*
        HASH PASSWORD
        */

        const hashedPassword =
            await bcrypt.hash(
                cleanPassword,
                12
            );


        /*
        CREATE USER
        */

        const user =
            await User.create({

                name:
                    cleanName,

                email:
                    normalizedEmail,

                password:
                    hashedPassword,

                role:
                    "customer"

            });


        /*
        CREATE TOKEN
        */

        const token =
            createToken(user);


        return res.status(201).json({

            success: true,

            message:
                "Registration successful",

            token,

            user:
                safeUser(user)

        });


    } catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );


        if (
            error.code === 11000
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "An account already exists with this email"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Registration failed. Please try again."

        });

    }

};


/*
=========================================================
LOGIN
=========================================================
*/

exports.login = async (
    req,
    res
) => {

    try {

        const {
            email,
            password
        } = req.body || {};


        const normalizedEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        const cleanPassword =
            String(password || "");


        /*
        VALIDATION
        */

        if (
            !normalizedEmail ||
            !cleanPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        /*
        FIND USER

        password is select:false
        so explicitly request it.
        */

        const user =
            await User.findOne({

                email:
                    normalizedEmail

            }).select(
                "+password"
            );


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        /*
        PASSWORD CHECK
        */

        let passwordMatched =
            false;


        const storedPassword =
            String(
                user.password || ""
            );


        /*
        NORMAL BCRYPT PASSWORD
        */

        if (
            storedPassword.startsWith("$2a$") ||
            storedPassword.startsWith("$2b$") ||
            storedPassword.startsWith("$2y$")
        ) {

            passwordMatched =
                await bcrypt.compare(
                    cleanPassword,
                    storedPassword
                );

        }

        /*
        LEGACY PASSWORD FALLBACK

        If an old account somehow contains
        a non-bcrypt password, verify it once
        and immediately upgrade it.
        */

        else if (
            storedPassword
        ) {

            passwordMatched =
                cleanPassword ===
                storedPassword;

        }


        if (!passwordMatched) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        /*
        AUTO-MIGRATE LEGACY PASSWORD
        */

        if (
            !storedPassword.startsWith("$2a$") &&
            !storedPassword.startsWith("$2b$") &&
            !storedPassword.startsWith("$2y$")
        ) {

            user.password =
                await bcrypt.hash(
                    cleanPassword,
                    12
                );

            await user.save();

        }


        /*
        CREATE JWT
        */

        const token =
            createToken(user);


        /*
        LOGIN RESPONSE
        */

        return res.status(200).json({

            success: true,

            message:
                "Login successful",

            token,

            user:
                safeUser(user)

        });


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Login server error. Please try again."

        });

    }

};


/*
=========================================================
CURRENT USER
=========================================================
*/

exports.me = async (
    req,
    res
) => {

    try {

        const user =
            await User.findById(
                req.user.id
            ).select(
                "-password"
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        return res.status(200).json({

            success: true,

            user:
                safeUser(user)

        });


    } catch (error) {

        console.error(
            "CURRENT USER ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to load current user"

        });

    }

};
