import React, { useEffect, useState } from "react";
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
    FaStore
} from "react-icons/fa";

import {
    motion
} from "framer-motion";

import api from "../services/api";

import {
    useApp
} from "../context/AppContext";

import "../styles/Login.css";


const Login = () => {

    const navigate = useNavigate();

    const {
        user,
        setUser
    } = useApp();


    // ==========================
    // FORM
    // ==========================

    const [form, setForm] = useState({
        email: "",
        password: ""
    });


    // ==========================
    // STATES
    // ==========================

    const [loading, setLoading] =
        useState(false);

    const [showPassword, setShowPassword] =
        useState(false);

    const [error, setError] =
        useState("");


    // ==========================
    // ALREADY LOGGED IN
    // ==========================

    useEffect(() => {

        if (user) {

            navigate("/", {
                replace: true
            });

        }

    }, [
        user,
        navigate
    ]);


    // ==========================
    // INPUT CHANGE
    // ==========================

    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;


        setForm(previous => ({
            ...previous,
            [name]: value
        }));


        if (error) {
            setError("");
        }

    };


    // ==========================
    // LOGIN
    // ==========================

    const handleLogin = async (e) => {

        e.preventDefault();


        const email =
            form.email.trim();

        const password =
            form.password;


        if (!email || !password) {

            setError(
                "Please enter your email and password."
            );

            return;

        }


        try {

            setLoading(true);

            setError("");


            const response =
                await api.post(
                    "/auth/login",
                    {
                        email,
                        password
                    }
                );


            const token =
                response.data?.token;

            const loggedInUser =
                response.data?.user;


            if (
                !token ||
                !loggedInUser
            ) {

                throw new Error(
                    "Invalid login response."
                );

            }


            // ==========================
            // SAVE TOKEN
            // ==========================

            localStorage.setItem(
                "token",
                token
            );


            // ==========================
            // SAVE USER
            // ==========================

            localStorage.setItem(
                "user",
                JSON.stringify(
                    loggedInUser
                )
            );


            // ==========================
            // UPDATE APP CONTEXT
            // ==========================

            setUser(
                loggedInUser
            );


            // ==========================
            // GO TO JR STORE
            // ==========================

            navigate("/", {
                replace: true
            });


        } catch (err) {

            console.error(
                "Login error:",
                err
            );


            setError(
                err.response?.data?.message ||
                "Login failed. Please check your email and password."
            );


        } finally {

            setLoading(false);

        }

    };


    // ==========================
    // ANIMATION
    // ==========================

    const pageVariants = {

        hidden: {
            opacity: 0
        },

        visible: {

            opacity: 1,

            transition: {
                duration: 0.7
            }

        }

    };


    const cardVariants = {

        hidden: {
            opacity: 0,
            y: 50,
            scale: 0.96
        },

        visible: {

            opacity: 1,
            y: 0,
            scale: 1,

            transition: {
                duration: 0.8,
                ease: [
                    0.22,
                    1,
                    0.36,
                    1
                ]
            }

        }

    };


    return (

        <motion.div
            className="login-page jr-login-page"

            variants={pageVariants}

            initial="hidden"

            animate="visible"
        >


            {/* ==========================
                BACKGROUND EFFECTS
            =========================== */}

            <div className="login-bg-glow glow-one" />

            <div className="login-bg-glow glow-two" />

            <div className="login-bg-grid" />


            {/* ==========================
                LOGIN CARD
            =========================== */}

            <motion.div
                className="login-box jr-login-box"

                variants={cardVariants}

                initial="hidden"

                animate="visible"
            >


                {/* ==========================
                    BRAND
                =========================== */}

                <motion.div
                    className="login-brand"

                    initial={{
                        opacity: 0,
                        y: -20
                    }}

                    animate={{
                        opacity: 1,
                        y: 0
                    }}

                    transition={{
                        delay: 0.2,
                        duration: 0.6
                    }}
                >

                    <motion.div
                        className="login-brand-icon"

                        whileHover={{
                            scale: 1.08,
                            rotate: -5
                        }}

                        whileTap={{
                            scale: 0.94
                        }}
                    >

                        <FaStore />

                    </motion.div>


                    <div>

                        <h2>

                            <strong>
                                JR
                            </strong>

                            <span>
                                Store
                            </span>

                        </h2>

                        <small>
                            Your trusted marketplace
                        </small>

                    </div>

                </motion.div>


                {/* ==========================
                    TITLE
                =========================== */}

                <div className="login-heading">

                    <h1>
                        Welcome Back 👋
                    </h1>

                    <p>
                        Sign in to continue to
                        <strong> JR Store</strong>
                    </p>

                </div>


                {/* ==========================
                    ERROR
                =========================== */}

                {error && (

                    <motion.div
                        className="login-error"

                        initial={{
                            opacity: 0,
                            y: -10
                        }}

                        animate={{
                            opacity: 1,
                            y: 0
                        }}
                    >

                        {error}

                    </motion.div>

                )}


                {/* ==========================
                    FORM
                =========================== */}

                <form
                    onSubmit={handleLogin}
                    className="jr-login-form"
                >


                    {/* EMAIL */}

                    <div className="login-input-group">

                        <label htmlFor="email">
                            Email Address
                        </label>


                        <div className="login-input-wrapper">

                            <FaEnvelope
                                className="login-input-icon"
                            />


                            <input
                                id="email"
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={
                                    form.email
                                }
                                onChange={
                                    handleChange
                                }
                                autoComplete="email"
                                disabled={loading}
                                required
                            />

                        </div>

                    </div>


                    {/* PASSWORD */}

                    <div className="login-input-group">

                        <label htmlFor="password">
                            Password
                        </label>


                        <div className="login-input-wrapper">

                            <FaLock
                                className="login-input-icon"
                            />


                            <input
                                id="password"
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
                                name="password"
                                placeholder="Enter your password"
                                value={
                                    form.password
                                }
                                onChange={
                                    handleChange
                                }
                                autoComplete="current-password"
                                disabled={loading}
                                required
                            />


                            <button
                                type="button"
                                className="password-toggle"

                                onClick={() =>
                                    setShowPassword(
                                        previous =>
                                            !previous
                                    )
                                }

                                disabled={
                                    loading
                                }

                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >

                                {showPassword
                                    ? <FaEyeSlash />
                                    : <FaEye />
                                }

                            </button>

                        </div>

                    </div>


                    {/* ==========================
                        LOGIN BUTTON
                    =========================== */}

                    <motion.button
                        type="submit"
                        className="jr-login-button"

                        disabled={
                            loading
                        }

                        whileHover={
                            !loading
                                ? {
                                    y: -2,
                                    scale: 1.01
                                }
                                : {}
                        }

                        whileTap={
                            !loading
                                ? {
                                    scale: 0.98
                                }
                                : {}
                        }
                    >

                        {loading ? (

                            <>

                                <span className="login-spinner" />

                                Signing In...

                            </>

                        ) : (

                            <>

                                Login to JR Store

                                <FaArrowRight />

                            </>

                        )}

                    </motion.button>

                </form>


                {/* ==========================
                    REGISTER
                =========================== */}

                <div className="auth-link jr-auth-link">

                    <span>
                        Don't have an account?
                    </span>


                    <Link
                        to="/register"
                    >

                        Create Account

                    </Link>

                </div>


                {/* ==========================
                    FOOTER
                =========================== */}

                <div className="login-footer">

                    <span>
                        © 2026 JR Store
                    </span>

                    <span>
                        •
                    </span>

                    <span>
                        Secure Marketplace
                    </span>

                </div>

            </motion.div>

        </motion.div>

    );

};


export default Login;
