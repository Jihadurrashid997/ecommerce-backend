import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import {
    FaUser,
    FaEnvelope,
    FaLock,
    FaEye,
    FaEyeSlash,
    FaUserPlus,
    FaArrowRight,
    FaKey,
    FaCheckCircle
} from "react-icons/fa";

import api from "../services/api";

import EtopLogo from "../components/EtopLogo";

import "../styles/EtopLogo.css";

import "../styles/Register.css";


const Register = () => {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });


    const [showPassword, setShowPassword] =
        useState(false);

    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [phase, setPhase] = useState("form");
    const [verificationCode, setVerificationCode] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    // ==========================
    // HANDLE CHANGE
    // ==========================

    const handleChange = (e) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    };

    const handleVerifyEmail = async event => {
        event.preventDefault();
        setError("");

        if (!/^\d{6}$/.test(verificationCode)) {
            setError("Enter the 6-digit code sent to your email.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/verify-email", {
                email: form.email.trim(),
                code: verificationCode
            });
            setPhase("success");
            setNotice("Registration successful. Your email is verified.");
            setForm(previous => ({
                ...previous,
                password: "",
                confirmPassword: ""
            }));
        } catch (verifyError) {
            setError(
                verifyError.response?.data?.message ||
                "The code could not be verified. Check it and try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setError("");
        setNotice("");
        setLoading(true);
        try {
            const response = await api.post("/auth/resend-verification", {
                email: form.email.trim()
            });
            setNotice(
                response.data?.message ||
                "If the account needs verification, a new code will be sent."
            );
        } catch (resendError) {
            setError(
                resendError.response?.data?.message ||
                "A new code could not be sent. Please try again later."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==========================
    // REGISTER
    // ==========================

    const handleSubmit = async (e) => {

        e.preventDefault();
        setError("");
        setNotice("");


        if (
            !form.name.trim() ||
            !form.email.trim() ||
            !form.password ||
            !form.confirmPassword
        ) {

            setError("Please fill all fields.");

            return;

        }


        if (
            form.password.length < 8 ||
            new TextEncoder().encode(form.password).length > 72
        ) {

            setError(
                "Password must be 8 to 72 bytes long."
            );

            return;

        }


        if (
            form.password !==
            form.confirmPassword
        ) {

            setError(
                "Passwords do not match."
            );

            return;

        }


        try {

            setLoading(true);


            const response =
                await api.post(
                    "/auth/register",
                    {
                        name:
                            form.name.trim(),

                        email:
                            form.email.trim(),

                        password:
                            form.password
                    }
                );


            setForm(previous => ({
                ...previous,
                email: response.data?.email || previous.email.trim().toLowerCase()
            }));
            setPhase("verification");
            setNotice("We sent a 6-digit code to your email. Enter it below to finish registration.");

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            if (error.response?.data?.accountCreated) {
                setForm(previous => ({
                    ...previous,
                    email: error.response.data.email || previous.email.trim().toLowerCase()
                }));
                setPhase("verification");
                setError(error.response.data.message);
            } else {
                setError(
                    error.response?.data?.message ||
                    "Registration failed. Please try again."
                );
            }

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="register-page">


            {/* ==========================
                BACKGROUND EFFECTS
            =========================== */}

            <div className="register-bg-glow glow-one" />

            <div className="register-bg-glow glow-two" />

            <div className="register-bg-grid" />


            {/* ==========================
                REGISTER CARD
            =========================== */}

            <motion.div

                className="register-container"

                initial={{
                    opacity: 0,
                    y: 50,
                    scale: 0.96
                }}

                animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1
                }}

                transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1]
                }}

            >


                {/* ==========================
                    BRAND
                =========================== */}

                <motion.div

                    className="register-brand"

                    initial={{
                        opacity: 0,
                        y: -20
                    }}

                    animate={{
                        opacity: 1,
                        y: 0
                    }}

                    transition={{
                        delay: 0.15,
                        duration: 0.5
                    }}

                >

                    <motion.div

                        whileHover={{
                            scale: 1.04
                        }}

                        whileTap={{
                            scale: 0.97
                        }}

                    >

                        <EtopLogo size="md" withTagline light />

                    </motion.div>

                </motion.div>


                {/* ==========================
                    TITLE
                =========================== */}

                <div className="register-heading">

                    <h2>
                        {phase === "success"
                            ? "Registration complete"
                            : phase === "verification"
                                ? "Verify your email"
                                : "Create Your Account"}
                    </h2>

                    <p>
                        {phase === "success"
                            ? "Your E Top account is ready. You can now sign in."
                            : phase === "verification"
                                ? `Enter the 6-digit code sent to ${form.email}.`
                                : "One account for E Top social and Shop."}
                    </p>

                </div>


                {/* ==========================
                    FORM
                =========================== */}

                {error && <div className="register-message register-message-error" role="alert">{error}</div>}
                {notice && <div className="register-message register-message-success" role="status">{notice}</div>}

                {phase === "form" && (
                    <form
                        className="register-form"
                        onSubmit={handleSubmit}
                    >

                    {/* NAME */}

                    <div className="register-field">

                        <label htmlFor="register-name">
                            Full Name
                        </label>

                        <div className="register-input">

                            <FaUser />

                            <input
                                id="register-name"
                                type="text"
                                name="name"
                                placeholder="Enter your full name"
                                value={form.name}
                                onChange={handleChange}
                                autoComplete="name"
                                disabled={loading}
                            />

                        </div>

                    </div>


                    {/* EMAIL */}

                    <div className="register-field">

                        <label htmlFor="register-email">
                            Email Address
                        </label>

                        <div className="register-input">

                            <FaEnvelope />

                            <input
                                id="register-email"
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={form.email}
                                onChange={handleChange}
                                autoComplete="email"
                                disabled={loading}
                            />

                        </div>

                    </div>


                    {/* PASSWORD */}

                    <div className="register-field">

                        <label htmlFor="register-password">
                            Password
                        </label>

                        <div className="register-input">

                            <FaLock />

                            <input
                                id="register-password"
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
                                name="password"
                                placeholder="8 to 72 bytes"
                                value={form.password}
                                onChange={handleChange}
                                autoComplete="new-password"
                                disabled={loading}
                            />

                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() =>
                                    setShowPassword(
                                        !showPassword
                                    )
                                }
                                tabIndex="-1"
                            >

                                {showPassword
                                    ? <FaEyeSlash />
                                    : <FaEye />
                                }

                            </button>

                        </div>

                    </div>


                    {/* CONFIRM PASSWORD */}

                    <div className="register-field">

                        <label htmlFor="register-confirm-password">
                            Confirm Password
                        </label>

                        <div className="register-input">

                            <FaLock />

                            <input
                                id="register-confirm-password"
                                type={
                                    showConfirmPassword
                                        ? "text"
                                        : "password"
                                }
                                name="confirmPassword"
                                placeholder="Confirm your password"
                                value={
                                    form.confirmPassword
                                }
                                onChange={
                                    handleChange
                                }
                                autoComplete="new-password"
                                disabled={loading}
                            />

                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() =>
                                    setShowConfirmPassword(
                                        !showConfirmPassword
                                    )
                                }
                                tabIndex="-1"
                            >

                                {showConfirmPassword
                                    ? <FaEyeSlash />
                                    : <FaEye />
                                }

                            </button>

                        </div>

                    </div>


                    {/* PASSWORD STATUS */}

                    {form.confirmPassword && (

                        <motion.div

                            className={
                                form.password ===
                                form.confirmPassword
                                    ? "password-match"
                                    : "password-no-match"
                            }

                            initial={{
                                opacity: 0,
                                y: -5
                            }}

                            animate={{
                                opacity: 1,
                                y: 0
                            }}

                        >

                            {form.password ===
                            form.confirmPassword

                                ? "✓ Passwords match"

                                : "✕ Passwords do not match"

                            }

                        </motion.div>

                    )}


                    {/* REGISTER BUTTON */}

                    <motion.button

                        type="submit"

                        className="register-submit"

                        disabled={loading}

                        whileHover={
                            !loading
                                ? {
                                    y: -3,
                                    scale: 1.01
                                }
                                : {}
                        }

                        whileTap={
                            !loading
                                ? {
                                    scale: 0.97
                                }
                                : {}
                        }

                    >

                        {loading ? (

                            <>

                                <span className="register-spinner" />

                                Creating Account...

                            </>

                        ) : (

                            <>

                                <FaUserPlus />

                                Create Account

                                <FaArrowRight />

                            </>

                        )}

                    </motion.button>


                    </form>
                )}

                {phase === "verification" && (
                    <form className="register-form" onSubmit={handleVerifyEmail}>
                        <div className="register-field">
                            <label htmlFor="register-verification-code">6-digit verification code</label>
                            <div className="register-input">
                                <FaKey />
                                <input
                                    id="register-verification-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={verificationCode}
                                    onChange={event =>
                                        setVerificationCode(
                                            event.target.value.replace(/\D/g, "").slice(0, 6)
                                        )
                                    }
                                    disabled={loading}
                                    required
                                />
                            </div>
                        </div>
                        <motion.button
                            type="submit"
                            className="register-submit"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                        >
                            {loading ? "Verifying..." : <>Verify and finish registration <FaArrowRight /></>}
                        </motion.button>
                        <button
                            type="button"
                            className="register-resend"
                            onClick={handleResendCode}
                            disabled={loading}
                        >
                            Resend code
                        </button>
                    </form>
                )}

                {phase === "success" && (
                    <div className="register-complete" role="status">
                        <FaCheckCircle aria-hidden="true" />
                        <Link to="/login">Continue to login <FaArrowRight /></Link>
                    </div>
                )}


                {/* ==========================
                    LOGIN
                =========================== */}

                {phase !== "success" && <div className="register-login">

                    <span>
                        Already have an account?
                    </span>

                    <Link to="/login">

                        Login

                    </Link>

                </div>}


                {/* ==========================
                    FOOTER
                =========================== */}

                <div className="register-footer">

                    <span>
                        🔒 Secure Registration
                    </span>

                    <span>
                        •
                    </span>

                    <span>
                        E Top © 2026 · JR Group of Company
                    </span>

                </div>


            </motion.div>

        </div>

    );

};


export default Register;
