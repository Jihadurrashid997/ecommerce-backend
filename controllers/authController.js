const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// ==============================
// REGISTER
// ==============================

exports.register = async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;


        // ==========================
        // VALIDATION
        // ==========================

        if (
            !name ||
            !email ||
            !password
        ) {

            return res.status(400).json({
                message:
                    "Please provide name, email and password"
            });

        }


        if (password.length < 8) {

            return res.status(400).json({
                message:
                    "Password must be at least 8 characters"
            });

        }


        // ==========================
        // NORMALIZE EMAIL
        // ==========================

        const normalizedEmail =
            email.trim().toLowerCase();


        // ==========================
        // CHECK EXISTING USER
        // ==========================

        const existingUser =
            await User.findOne({
                email: normalizedEmail
            });


        if (existingUser) {

            return res.status(400).json({
                message:
                    "User already exists with this email"
            });

        }


        // ==========================
        // HASH PASSWORD
        // ==========================

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        // ==========================
        // CREATE USER
        // ==========================

        const user =
            await User.create({

                name:
                    name.trim(),

                email:
                    normalizedEmail,

                password:
                    hashedPassword,

                role:
                    "customer"

            });


        // ==========================
        // RESPONSE
        // ==========================

        res.status(201).json({

            success: true,

            message:
                "Registration successful",

            user: {

                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                role:
                    user.role

            }

        });


    } catch (err) {

        console.error(
            "Registration error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};



// ==============================
// LOGIN
// ==============================

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // ==========================
        // VALIDATION
        // ==========================

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({

                message:
                    "Email and password are required"

            });

        }


        // ==========================
        // NORMALIZE EMAIL
        // ==========================

        const normalizedEmail =
            email.trim().toLowerCase();


        // ==========================
        // FIND USER
        // ==========================

        const user =
            await User.findOne({
                email: normalizedEmail
            }).select("+password");


        if (!user) {

            return res.status(401).json({

                message:
                    "Invalid email or password"

            });

        }


        // ==========================
        // CHECK PASSWORD
        // ==========================

        const isMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!isMatch) {

            return res.status(401).json({

                message:
                    "Invalid email or password"

            });

        }


        // ==========================
        // CHECK JWT SECRET
        // ==========================

        if (!process.env.JWT_SECRET) {

            return res.status(500).json({

                message:
                    "JWT_SECRET is not configured"

            });

        }


        // ==========================
        // CREATE JWT
        // ==========================

        const token =
            jwt.sign(

                {
                    id:
                        user._id,

                    role:
                        user.role

                },

                process.env.JWT_SECRET,

                {
                    expiresIn:
                        "1d"
                }

            );


        // ==========================
        // LOGIN RESPONSE
        // ==========================

        res.status(200).json({

            success: true,

            message:
                "Login successful",

            token,

            user: {

                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                role:
                    user.role

            }

        });


    } catch (err) {

        console.error(
            "Login error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};



// ==============================
// VERIFY CURRENT USER
// ==============================

exports.me = async (req, res) => {

    try {

        const user =
            await User.findById(
                req.user.id
            ).select("-password");


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        res.status(200).json({

            success: true,

            user: {

                id:
                    user._id,

                name:
                    user.name,

                email:
                    user.email,

                role:
                    user.role

            }

        });


    } catch (err) {

        console.error(
            "Verify user error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};
