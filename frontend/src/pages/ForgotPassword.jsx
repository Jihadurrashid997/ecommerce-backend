import React, {
    useState
} from "react";

import {
    Link,
    useNavigate
} from "react-router-dom";

import {
    FaEnvelope,
    FaLock,
    FaEye,
    FaEyeSlash,
    FaArrowRight,
    FaArrowLeft,
    FaCheckCircle,
    FaKey
} from "react-icons/fa";

import {
    motion
} from "framer-motion";

import api from "../services/api";

import EtopLogo from "../components/EtopLogo";

import "../styles/EtopLogo.css";

import "../styles/Login.css";


const ForgotPassword = () => {

    const navigate =
        useNavigate();

    // step: "email" -> "code" -> "password" -> "done"
    const [step, setStep] =
        useState("email");

    const [email, setEmail] =
        useState("");

    const [code, setCode] =
        useState("");

    const [resetToken, setResetToken] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [confirmPassword, setConfirmPassword] =
        useState("");

    const [showPassword, setShowPassword] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    /* ---------------- STEP 1: request code ---------------- */

    const handleSendCode =
        async event => {

            event.preventDefault();

            setError("");

            if (!email.trim()) {

                setError("Please enter your email address.");
                return;

            }

            try {

                setLoading(true);

                await api.post(
                    "/auth/forgot-password",
                    { email: email.trim() }
                );

                setStep("code");

            } catch (err) {

                setError(
                    err.response?.data?.message ||
                    "Something went wrong. Please try again."
                );

            } finally {

                setLoading(false);

            }

        };


    /* ---------------- STEP 2: verify code ---------------- */

    const handleVerifyCode =
        async event => {

            event.preventDefault();

            setError("");

            if (code.trim().length !== 6) {

                setError("Enter the 6-digit code from your email.");
                return;

            }

            try {

                setLoading(true);

                const response =
                    await api.post(
                        "/auth/verify-reset-code",
                        {
                            email: email.trim(),
                            code: code.trim()
                        }
                    );

                setResetToken(
                    response.data?.resetToken || ""
                );

                setStep("password");

            } catch (err) {

                setError(
                    err.response?.data?.message ||
                    "That code is incorrect or has expired."
                );

            } finally {

                setLoading(false);

            }

        };


    /* ---------------- STEP 3: set new password ---------------- */

    const handleResetPassword =
        async event => {

            event.preventDefault();

            setError("");

            if (password.length < 6) {

                setError("Password must be at least 6 characters.");
                return;

            }

            if (password !== confirmPassword) {

                setError("Passwords do not match.");
                return;

            }

            try {

                setLoading(true);

                await api.post(
                    "/auth/reset-password",
                    {
                        resetToken,
                        password
                    }
                );

                setStep("done");

                setTimeout(() => {

                    navigate("/login");

                }, 2500);

            } catch (err) {

                setError(
                    err.response?.data?.message ||
                    "Something went wrong. Please try again."
                );

            } finally {

                setLoading(false);

            }

        };


    const stepTitles = {
        email: "Forgot your password?",
        code: "Check your email",
        password: "Set a new password",
        done: "All done!"
    };

    const stepSubtitles = {
        email: "Enter the email on your account and we'll send you a 6-digit code.",
        code: `We sent a 6-digit code to ${email}. Enter it below (check spam too).`,
        password: "Choose a new password for your account.",
        done: "Your password has been changed. Taking you to login..."
    };


    return (

        <div className="login-page jr-login-page">

            <div className="login-bg-glow glow-one" />
            <div className="login-bg-glow glow-two" />
            <div className="login-bg-grid" />

            <motion.div
                className="login-box jr-login-box"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >

                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: 20
                    }}
                >

                    <EtopLogo size="md" light />

                </div>


                <div className="login-heading">

                    <h1>{stepTitles[step]}</h1>

                    <p>{stepSubtitles[step]}</p>

                </div>


                {error && (

                    <div className="login-error">
                        {error}
                    </div>

                )}


                {/* ---------------- STEP 1 ---------------- */}

                {step === "email" && (

                    <form onSubmit={handleSendCode}>

                        <div className="login-input-group">

                            <label htmlFor="email">Email</label>

                            <div className="login-input-wrapper">

                                <FaEnvelope className="login-input-icon" />

                                <input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={event =>
                                        setEmail(event.target.value)
                                    }
                                    disabled={loading}
                                    autoComplete="email"
                                    autoFocus
                                    required
                                />

                            </div>

                        </div>

                        <motion.button
                            type="submit"
                            className="login-submit-btn"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                        >

                            {loading ? "Sending..." : (
                                <>
                                    Send code
                                    <FaArrowRight />
                                </>
                            )}

                        </motion.button>

                    </form>

                )}


                {/* ---------------- STEP 2 ---------------- */}

                {step === "code" && (

                    <form onSubmit={handleVerifyCode}>

                        <div className="login-input-group">

                            <label htmlFor="code">
                                6-digit code
                            </label>

                            <div className="login-input-wrapper">

                                <FaKey className="login-input-icon" />

                                <input
                                    id="code"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={code}
                                    onChange={event =>
                                        setCode(
                                            event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 6)
                                        )
                                    }
                                    disabled={loading}
                                    autoFocus
                                    required
                                    style={{
                                        letterSpacing: 6,
                                        fontWeight: 700
                                    }}
                                />

                            </div>

                        </div>

                        <motion.button
                            type="submit"
                            className="login-submit-btn"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                        >

                            {loading ? "Verifying..." : (
                                <>
                                    Verify code
                                    <FaArrowRight />
                                </>
                            )}

                        </motion.button>

                        <div
                            className="login-register"
                            style={{ marginTop: 14 }}
                        >

                            <button
                                type="button"
                                className="link-button"
                                onClick={() => setStep("email")}
                                disabled={loading}
                            >
                                Entered the wrong email? Go back
                            </button>

                        </div>

                    </form>

                )}


                {/* ---------------- STEP 3 ---------------- */}

                {step === "password" && (

                    <form onSubmit={handleResetPassword}>

                        <div className="login-input-group">

                            <label htmlFor="password">
                                New password
                            </label>

                            <div className="login-input-wrapper">

                                <FaLock className="login-input-icon" />

                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="At least 6 characters"
                                    value={password}
                                    onChange={event =>
                                        setPassword(event.target.value)
                                    }
                                    disabled={loading}
                                    autoComplete="new-password"
                                    autoFocus
                                    required
                                />

                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() =>
                                        setShowPassword(previous => !previous)
                                    }
                                    disabled={loading}
                                    aria-label={
                                        showPassword ? "Hide password" : "Show password"
                                    }
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>

                            </div>

                        </div>

                        <div className="login-input-group">

                            <label htmlFor="confirmPassword">
                                Confirm new password
                            </label>

                            <div className="login-input-wrapper">

                                <FaLock className="login-input-icon" />

                                <input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Re-enter your new password"
                                    value={confirmPassword}
                                    onChange={event =>
                                        setConfirmPassword(event.target.value)
                                    }
                                    disabled={loading}
                                    autoComplete="new-password"
                                    required
                                />

                            </div>

                        </div>

                        <motion.button
                            type="submit"
                            className="login-submit-btn"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                        >

                            {loading ? "Resetting..." : (
                                <>
                                    Reset password
                                    <FaArrowRight />
                                </>
                            )}

                        </motion.button>

                    </form>

                )}


                {/* ---------------- STEP 4: done ---------------- */}

                {step === "done" && (

                    <div className="login-heading" style={{ marginTop: 24 }}>

                        <FaCheckCircle
                            style={{
                                fontSize: 40,
                                color: "#4ade80",
                                marginBottom: 12
                            }}
                        />

                    </div>

                )}


                <div className="login-register">

                    <Link to="/login">
                        <FaArrowLeft style={{ marginRight: 6 }} />
                        Back to login
                    </Link>

                </div>

            </motion.div>

        </div>

    );

};


export default ForgotPassword;
