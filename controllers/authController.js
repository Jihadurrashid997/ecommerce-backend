const User =
    require("../models/User");

const bcrypt =
    require("bcryptjs");

const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");

const {
    sendPasswordResetEmail
} = require("../services/emailService");


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


/*
=========================================================
FORGOT PASSWORD (step 1 of 3)
Generates a 6-digit numeric code (valid 10 minutes),
stores its HASH in the DB (never the raw code), and
emails the person that code.
=========================================================
*/

exports.forgotPassword = async (req, res) => {

    try {

        const email =
            String(req.body?.email || "")
                .trim()
                .toLowerCase();

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required."
            });

        }

        const user =
            await User.findOne({ email });

        /*
         * Always respond with the same success message
         * whether or not the email exists - this prevents
         * someone from using this endpoint to discover
         * which emails are registered on the site.
         */

        const genericResponse = {
            success: true,
            message:
                "If an account exists for that email, a verification code has been sent."
        };

        if (!user) {
            return res.json(genericResponse);
        }

        const code =
            String(
                crypto.randomInt(100000, 999999)
            );

        const hashedCode =
            crypto
                .createHash("sha256")
                .update(code)
                .digest("hex");

        user.resetPasswordToken = hashedCode;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save();

        const emailResult =
            await sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                code
            });

        if (!emailResult.sent) {

            // Email isn't configured or failed to send -
            // let the admin know via server logs, but still
            // don't reveal this to the requester (same
            // reasoning as above).
            console.warn(
                "Password reset email not sent:",
                emailResult.reason
            );

        }

        return res.json(genericResponse);

    } catch (error) {

        console.error("FORGOT PASSWORD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });

    }

};


/*
=========================================================
VERIFY RESET CODE (step 2 of 3)
Checks the 6-digit code against the stored hash and
expiry. On success, issues a short-lived JWT (15 min)
that step 3 uses to actually set the new password -
without that, anyone could call reset-password directly
on any email with no code at all.
=========================================================
*/

exports.verifyResetCode = async (req, res) => {

    try {

        const email =
            String(req.body?.email || "")
                .trim()
                .toLowerCase();

        const code =
            String(req.body?.code || "").trim();

        if (!email || !code) {

            return res.status(400).json({
                success: false,
                message: "Email and code are required."
            });

        }

        const hashedCode =
            crypto
                .createHash("sha256")
                .update(code)
                .digest("hex");

        const user =
            await User.findOne({
                email,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: { $gt: Date.now() }
            }).select("+resetPasswordToken +resetPasswordExpires");

        if (!user) {

            return res.status(400).json({
                success: false,
                message: "That code is incorrect or has expired."
            });

        }

        // One-time use - clear it now that it's been
        // verified, so it can't be replayed.
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        const resetToken =
            jwt.sign(
                {
                    id: user._id,
                    purpose: "password-reset"
                },
                process.env.JWT_SECRET,
                { expiresIn: "15m" }
            );

        return res.json({
            success: true,
            resetToken
        });

    } catch (error) {

        console.error("VERIFY RESET CODE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });

    }

};


/*
=========================================================
RESET PASSWORD (step 3 of 3)
Takes the short-lived resetToken from step 2 and sets
the new password.
=========================================================
*/

exports.resetPassword = async (req, res) => {

    try {

        const resetToken =
            req.body?.resetToken;

        const password =
            String(req.body?.password || "");

        if (!resetToken || !password) {

            return res.status(400).json({
                success: false,
                message: "Missing verification. Please verify your code again."
            });

        }

        if (password.length < 6) {

            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters."
            });

        }

        let decoded;

        try {

            decoded =
                jwt.verify(
                    resetToken,
                    process.env.JWT_SECRET
                );

        } catch (_) {

            return res.status(400).json({
                success: false,
                message: "This session has expired. Please request a new code."
            });

        }

        if (decoded?.purpose !== "password-reset") {

            return res.status(400).json({
                success: false,
                message: "Invalid reset session."
            });

        }

        const user =
            await User.findById(decoded.id);

        if (!user) {

            return res.status(400).json({
                success: false,
                message: "Account not found."
            });

        }

        user.password =
            await bcrypt.hash(password, 12);

        await user.save();

        return res.json({
            success: true,
            message: "Your password has been reset. You can now log in."
        });

    } catch (error) {

        console.error("RESET PASSWORD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });

    }

};
