const User =
    require("../models/User");

const bcrypt =
    require("bcryptjs");

const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");
const DeviceSession =
    require("../models/DeviceSession");
const auth =
    require("../middleware/auth");

const emailService =
    require("../services/emailService");

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_DELAY_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;


/*
=========================================================
HELPERS
=========================================================
*/

const createToken = (user, sessionId, deviceId) => {

    if (!process.env.JWT_SECRET) {

        throw new Error(
            "JWT_SECRET is not configured on the server"
        );

    }

    return jwt.sign(

        {
            id: user._id.toString(),
            role: user.role || "customer",
            sid: sessionId,
            deviceId
        },

        process.env.JWT_SECRET,

        {
            expiresIn: "7d"
        }

    );

};

const createDeviceToken = async (user, req) => {
    const requestedDeviceId = String(req.body?.deviceId || "");
    const deviceId = /^[a-f\d-]{16,80}$/i.test(requestedDeviceId)
        ? requestedDeviceId
        : crypto.randomUUID();
    const requestedName = String(req.body?.deviceName || "").trim();
    const name = requestedName
        .replace(/[<>]/g, "")
        .slice(0, 100) || "Browser device";
    const sessionId = crypto.randomUUID();

    await DeviceSession.findOneAndUpdate(
        { user: user._id, deviceId },
        {
            $set: {
                sessionId,
                name,
                lastActiveAt: new Date()
            },
            $setOnInsert: { user: user._id }
        },
        { upsert: true, new: true, runValidators: true }
    );

    return {
        token: createToken(user, sessionId, deviceId),
        deviceId
    };
};

const hashCode = value => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured on the server");
    }
    return crypto
        .createHmac("sha256", process.env.JWT_SECRET)
        .update(String(value))
        .digest("hex");
};

const createVerificationCode = () =>
    String(crypto.randomInt(100000, 1_000_000));

const genericResendResponse = res =>
    res.json({
        success: true,
        message: "If the account needs verification, a new code will be sent."
    });


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

        isVerified:
            Boolean(user.isVerified),

        emailVerified:
            user.emailVerified === true,

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

        if (cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Name must be 100 characters or fewer."
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
            cleanPassword.length < 8 ||
            Buffer.byteLength(cleanPassword, "utf8") > 72
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must be 8 to 72 bytes long"

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

        return res.status(201).json({

            success: true,

            message:
                "Registration successful. You can now sign in.",
            verificationRequired: false,
            email: normalizedEmail

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

exports.resendVerification = async (req, res) => {
    try {
        const email = String(req.body?.email || "")
            .trim()
            .toLowerCase();
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }
        if (!emailService.isEmailConfigured()) {
            return res.status(503).json({
                success: false,
                code: "EMAIL_NOT_CONFIGURED",
                message: "Email verification is not configured. Please contact support."
            });
        }

        const user = await User.findOne({ email }).select(
            "+emailVerificationLastSentAt"
        );
        if (!user || user.emailVerified === true) {
            return genericResendResponse(res);
        }
        if (
            user.emailVerificationLastSentAt &&
            Date.now() - user.emailVerificationLastSentAt.getTime() <
                CODE_RESEND_DELAY_MS
        ) {
            return genericResendResponse(res);
        }

        const code = createVerificationCode();
        const now = new Date();
        await User.updateOne(
            { _id: user._id, emailVerified: { $ne: true } },
            {
                $set: {
                    emailVerificationCodeHash: hashCode(code),
                    emailVerificationExpires: new Date(
                        now.getTime() + CODE_TTL_MS
                    ),
                    emailVerificationAttempts: 0,
                    emailVerificationLastSentAt: now
                }
            }
        );

        const emailResult = await emailService.sendVerificationEmail({
            to: user.email,
            name: user.name,
            code
        });
        if (!emailResult.sent) {
            await User.updateOne(
                { _id: user._id },
                { $unset: { emailVerificationLastSentAt: "" } }
            );
            return res.status(503).json({
                success: false,
                message: "We couldn't send the verification code. Please try again later."
            });
        }

        return genericResendResponse(res);
    } catch (error) {
        console.error("RESEND EMAIL VERIFICATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not send a verification code. Please try again."
        });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const email = String(req.body?.email || "")
            .trim()
            .toLowerCase();
        const code = String(req.body?.code || "").trim();
        if (!email || !/^\d{6}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: "Enter your email and the 6-digit verification code."
            });
        }

        const now = new Date();
        const verifiedUser = await User.findOneAndUpdate(
            {
                email,
                emailVerified: false,
                emailVerificationCodeHash: hashCode(code),
                emailVerificationExpires: { $gt: now },
                emailVerificationAttempts: { $lt: MAX_CODE_ATTEMPTS }
            },
            {
                $set: {
                    emailVerified: true,
                    emailVerifiedAt: now
                },
                $unset: {
                    emailVerificationCodeHash: "",
                    emailVerificationExpires: "",
                    emailVerificationAttempts: "",
                    emailVerificationLastSentAt: ""
                }
            },
            { new: true }
        ).select("_id");

        if (verifiedUser) {
            auth.invalidate(verifiedUser._id);
            return res.json({
                success: true,
                message: "Email verified. You can now sign in."
            });
        }

        await User.updateOne(
            {
                email,
                emailVerified: false,
                emailVerificationExpires: { $gt: now },
                emailVerificationAttempts: { $lt: MAX_CODE_ATTEMPTS }
            },
            { $inc: { emailVerificationAttempts: 1 } }
        );

        const existingUser = await User.findOne({ email }).select(
            "emailVerified"
        );
        if (existingUser?.emailVerified === true) {
            return res.json({
                success: true,
                message: "Email is already verified. You can sign in."
            });
        }

        return res.status(400).json({
            success: false,
            message: "That code is incorrect, expired, or has reached its attempt limit."
        });
    } catch (error) {
        console.error("VERIFY EMAIL ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not verify your email. Please try again."
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
        SUSPENDED ACCOUNTS CANNOT LOG IN
        */

        if (user.isSuspended) {

            return res.status(403).json({

                success: false,

                message:
                    "Your account has been suspended." +
                    (
                        user.suspendedReason
                            ? ` Reason: ${user.suspendedReason}`
                            : ""
                    )

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

        const { token, deviceId } =
            await createDeviceToken(user, req);


        /*
        LOGIN RESPONSE
        */

        return res.status(200).json({

            success: true,

            message:
                "Login successful",

            token,
            deviceId,

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

        if (!emailService.isEmailConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Password reset email is not configured. Please contact support."
            });
        }

        const user =
            await User.findOne({ email }).select(
                "+resetPasswordLastSentAt"
            );

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

        if (
            user.resetPasswordLastSentAt &&
            Date.now() - user.resetPasswordLastSentAt.getTime() <
                CODE_RESEND_DELAY_MS
        ) {
            return res.json(genericResponse);
        }

        const code = createVerificationCode();
        const now = new Date();
        const hashedCode = hashCode(code);

        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    resetPasswordToken: hashedCode,
                    resetPasswordExpires: new Date(
                        now.getTime() + CODE_TTL_MS
                    ),
                    resetPasswordAttempts: 0
                }
            }
        );

        const emailResult =
            await emailService.sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                code
            });

        if (!emailResult.sent) {

            console.warn(
                "Password reset email not sent:",
                emailResult.reason
            );

            await User.updateOne(
                { _id: user._id },
                {
                    $unset: {
                        resetPasswordToken: "",
                        resetPasswordExpires: "",
                        resetPasswordAttempts: ""
                    }
                }
            );

            return res.status(503).json({
                success: false,
                message: "We couldn't send the reset code. Please try again later."
            });

        }

        await User.updateOne(
            { _id: user._id },
            { $set: { resetPasswordLastSentAt: now } }
        );

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

        if (!email || !/^\d{6}$/.test(code)) {

            return res.status(400).json({
                success: false,
                message: "Email and code are required."
            });

        }

        const now = new Date();
        const hashedCode = hashCode(code);
        const user = await User.findOne({
                email,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: { $gt: now },
                resetPasswordAttempts: { $lt: MAX_CODE_ATTEMPTS }
            }).select(
                "+resetPasswordToken +resetPasswordExpires +resetPasswordAttempts"
            );

        if (!user) {
            await User.updateOne(
                {
                    email,
                    resetPasswordExpires: { $gt: now },
                    resetPasswordAttempts: { $lt: MAX_CODE_ATTEMPTS }
                },
                { $inc: { resetPasswordAttempts: 1 } }
            );
            return res.status(400).json({
                success: false,
                message: "That code is incorrect, expired, or has reached its attempt limit."
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetSession = await User.findOneAndUpdate(
            {
                _id: user._id,
                resetPasswordToken: hashedCode,
                resetPasswordExpires: { $gt: now },
                resetPasswordAttempts: { $lt: MAX_CODE_ATTEMPTS }
            },
            {
                $set: {
                    resetSessionTokenHash: hashCode(resetToken),
                    resetSessionExpires: new Date(now.getTime() + 15 * 60 * 1000)
                },
                $unset: {
                    resetPasswordToken: "",
                    resetPasswordExpires: "",
                    resetPasswordAttempts: ""
                }
            },
            { new: true }
        ).select("_id");
        if (!resetSession) {
            return res.status(400).json({
                success: false,
                message: "That code is incorrect, expired, or has already been used."
            });
        }

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
Consumes a random, hashed, one-time reset token.
=========================================================
*/

exports.resetPassword = async (req, res) => {
    try {
        const resetToken = String(req.body?.resetToken || "");
        const password = String(req.body?.password || "");

        if (!/^[a-f\d]{64}$/i.test(resetToken) || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing verification. Please verify your code again."
            });
        }

        if (
            password.length < 8 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Password must be 8 to 72 bytes long."
            });
        }

        const now = new Date();
        const tokenHash = hashCode(resetToken);
        const user = await User.findOne({
            resetSessionTokenHash: tokenHash,
            resetSessionExpires: { $gt: now }
        }).select("_id");
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "This reset session is invalid or expired. Please request a new code."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await DeviceSession.deleteMany({ user: user._id });
        const updated = await User.findOneAndUpdate(
            {
                _id: user._id,
                resetSessionTokenHash: tokenHash,
                resetSessionExpires: { $gt: now }
            },
            {
                $set: {
                    password: hashedPassword,
                    emailVerified: true,
                    emailVerifiedAt: now
                },
                $unset: {
                    resetSessionTokenHash: "",
                    resetSessionExpires: "",
                    resetPasswordToken: "",
                    resetPasswordExpires: "",
                    resetPasswordAttempts: "",
                    resetPasswordLastSentAt: "",
                    emailVerificationCodeHash: "",
                    emailVerificationExpires: "",
                    emailVerificationAttempts: "",
                    emailVerificationLastSentAt: ""
                }
            },
            { new: true }
        ).select("_id");

        if (!updated) {
            return res.status(400).json({
                success: false,
                message: "This reset session is invalid or has already been used."
            });
        }

        auth.invalidate(updated._id);

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
