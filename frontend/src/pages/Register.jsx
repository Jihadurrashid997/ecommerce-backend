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

import "../styles/Register.css";


const Register = () => {

    const navigate = useNavigate();


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


        if (
            !form.name.trim() ||
            !form.email.trim() ||
            !form.password ||
            !form.confirmPassword
        ) {

            alert("Please fill all fields.");

            return;

        }


        if (form.password.length < 8) {

            alert(
                "Password must be at least 8 characters."
            );

            return;

        }


        if (
            form.password !==
            form.confirmPassword
        ) {

            alert(
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


            alert(
                response.data?.message ||
                "Registration successful!"
            );


            // Reset form

            setForm({
                name: "",
                email: "",
                password: "",
                confirmPassword: ""
            });


            // Go to login

            navigate("/login");


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            alert(
                error.response?.data?.message ||
                "Registration failed. Please try again."
            );


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

                        className="register-logo"

                        whileHover={{
                            scale: 1.08,
                            rotate: -5
                        }}

                        whileTap={{
                            scale: 0.94
                        }}

                    >
                        JR
                    </motion.div>


                    <div>

                        <h1>
                            JR Store
                        </h1>

                        <span>
                            Premium Marketplace
                        </span>

                    </div>

                </motion.div>


                {/* ==========================
                    TITLE
                =========================== */}

                <div className="register-heading">

                    <h2>
                        Create Your Account
                    </h2>

                    <p>
                        Join JR Store and start your
                        shopping journey.
                    </p>

                </div>


                {/* ==========================
                    FORM
                =========================== */}

                <form
                    className="register-form"
                    onSubmit={handleSubmit}
                >


                    {/* NAME */}

                    <div className="register-field">

                        <label>
                            Full Name
                        </label>

                        <div className="register-input">

                            <FaUser />

                            <input
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

                        <label>
                            Email Address
                        </label>

                        <div className="register-input">

                            <FaEnvelope />

                            <input
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

                        <label>
                            Password
                        </label>

                        <div className="register-input">

                            <FaLock />

                            <input
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
                                name="password"
                                placeholder="Minimum 8 characters"
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

                        <label>
                            Confirm Password
                        </label>

                        <div className="register-input">

                            <FaLock />

                            <input
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


                {/* ==========================
                    LOGIN
                =========================== */}

                <div className="register-login">

                    <span>
                        Already have an account?
                    </span>

                    <Link to="/login">

                        Login

                    </Link>

                </div>


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
                        JR Store © 2026
                    </span>

                </div>


            </motion.div>

        </div>

    );

};


export default Register;
