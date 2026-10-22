import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
    FaUser,
    FaEnvelope,
    FaLock,
    FaEye,
    FaEyeSlash,
    FaUserPlus,
    FaArrowRight
} from "react-icons/fa";

import api from "../services/api";
import { googleAuthUser } from "../services/auth";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useApp } from "../context/AppContext";

import EtopLogo from "../components/EtopLogo";

import "../styles/EtopLogo.css";

import "../styles/Register.css";
import "../styles/GoogleAuthButton.css";


const Register = () => {
    const navigate = useNavigate();
    const { setUser } = useApp();
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
    const [googleLoading, setGoogleLoading] =
        useState(false);

    const [registrationComplete, setRegistrationComplete] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const authBusy = loading || googleLoading;

    // ==========================
    // HANDLE CHANGE
    // ==========================

    const handleChange = (e) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    };

    // ==========================
    // REGISTER
    // ==========================

    const handleSubmit = async (e) => {

        e.preventDefault();
        setError("");
        setNotice("");

        if (authBusy) {
            return;
        }

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


            setRegistrationComplete(true);
            setNotice(
                response.data?.message ||
                "Registration successful. You can now sign in."
            );
            setForm(previous => ({
                ...previous,
                password: "",
                confirmPassword: ""
            }));

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            setError(
                error.response?.data?.message ||
                "Registration failed. Please try again."
            );

        } finally {

            setLoading(false);

        }

    };

    const handleGoogleCredential = async credential => {
        if (authBusy) {
            return;
        }

        setError("");
        setNotice("");
        setGoogleLoading(true);
        try {
            const response = await googleAuthUser(credential);
            setUser(response.data.user);
            navigate("/", { replace: true });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.message ||
                "Google registration failed. Please try again."
            );
        } finally {
            setGoogleLoading(false);
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
                        {registrationComplete
                            ? "Registration complete"
                            : "Create Your Account"}
                    </h2>

                    <p>
                        {registrationComplete
                            ? "Your E Top account is ready. You can now sign in."
                            : "One account for E Top social and Shop."}
                    </p>

                </div>


                {/* ==========================
                    FORM
                =========================== */}

                {error && <div className="register-message register-message-error" role="alert">{error}</div>}
                {notice && <div className="register-message register-message-success" role="status">{notice}</div>}

                {!registrationComplete && (
                    <>
                        <GoogleAuthButton
                            onCredential={handleGoogleCredential}
                            disabled={authBusy}
                            text="signup_with"
                        />
                        {googleLoading && (
                            <div className="register-message" role="status">
                                Creating your account with Google...
                            </div>
                        )}
                        <div className="auth-divider"><span>OR SIGN UP WITH EMAIL</span></div>
                    </>
                )}

                {!registrationComplete && (
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
                                disabled={authBusy}
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
                                disabled={authBusy}
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
                                disabled={authBusy}
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
                                disabled={authBusy}
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

                        disabled={authBusy}

                        whileHover={
                            !authBusy
                                ? {
                                    y: -3,
                                    scale: 1.01
                                }
                                : {}
                        }

                        whileTap={
                            !authBusy
                                ? {
                                    scale: 0.97
                                }
                                : {}
                        }

                    >

                        {authBusy ? (

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

                {registrationComplete && (
                    <div className="register-complete" role="status">
                        <Link to="/login">Continue to login <FaArrowRight /></Link>
                    </div>
                )}


                {/* ==========================
                    LOGIN
                =========================== */}

                {!registrationComplete && <div className="register-login">

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
