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

        if (!name || !email || !password) {

            return res.status(400).json({
                message: "Please provide name, email and password"
            });

        }

        if (password.length < 8) {

            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });

        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {

            return res.status(400).json({
                message: "User already exists with this email"
            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const user = await User.create({

            name: name.trim(),

            email: normalizedEmail,

            password: hashedPassword,

            role: "customer"

        });

        res.status(201).json({

            message: "Registration successful",

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }

        });

    } catch (err) {

        res.status(500).json({
            message: err.message
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

        if (!email || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });

        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        }).select("+password");

        if (!user) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }

        const isMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!isMatch) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }

        if (!process.env.JWT_SECRET) {

            return res.status(500).json({
                message: "JWT_SECRET is not configured"
            });

        }

        const token = jwt.sign(

            {
                id: user._id,
                role: user.role
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "1d"
            }

        );

        res.status(200).json({

            message: "Login successful",

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }

        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};
