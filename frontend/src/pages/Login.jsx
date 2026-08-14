import React, {
    useEffect,
    useState
} from "react";

import {
    Link,
    useNavigate,
    useLocation
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

    const navigate =
        useNavigate();

    const location =
        useLocation();


    const {
        user,
        setUser
    } =
        useApp();


    /*
    =====================================================
    FORM
    =====================================================
    */

    const [
        form,
        setForm
    ] = useState({

        email: "",
        password: ""

    });


    const [
        loading,
        setLoading
    ] = useState(false);


    const [
        showPassword,
        setShowPassword
    ] = useState(false);


    const [
        error,
        setError
    ] = useState("");


    /*
    =====================================================
    REDIRECT IF ALREADY LOGGED IN
    =====================================================
    */

    useEffect(() => {

        if (user) {

            navigate(
                "/",
                {
                    replace: true
                }
            );

        }

    }, [
        user,
        navigate
    ]);


    /*
    =====================================================
    INPUT
    =====================================================
    */

    const handleChange = (
        e
    ) => {

        const {
            name,
            value
        } =
            e.target;


        setForm(
            previous => ({

                ...previous,

                [name]:
                    value

            })
        );


        if (error) {

            setError("");

        }

    };


    /*
    =====================================================
    LOGIN
    =====================================================
    */

    const handleLogin =
        async (e) => {

            e.preventDefault();


            if (loading) {
                return;
            }


            const email =
                form.email
                    .trim()
                    .toLowerCase();

            const password =
                form.password;


            /*
            VALIDATION
            */

            if (
                !email ||
                !password
            ) {

                setError(
                    "Please enter your email and password."
                );

                return;

            }


            setLoading(true);
            setError("");


            try {

                /*
                =========================================
                LOGIN REQUEST
                =========================================
                */

                const response =
                    await api.post(
                        "/auth/login",
                        {
                            email,
                            password
                        }
                    );


                const data =
                    response.data || {};


                const token =
                    data.token;


                const loggedInUser =
                    data.user;


                /*
                =========================================
                VERIFY RESPONSE
                =========================================
                */

                if (
                    !token ||
                    !loggedInUser
                ) {

                    throw new Error(
                        "The server returned an invalid login response."
                    );

                }


                /*
                =========================================
                SAVE TOKEN
                =========================================
                */

                localStorage.setItem(
                    "token",
                    token
                );


                /*
                =========================================
                SAVE USER
                =========================================
                */

                localStorage.setItem(

                    "user",

                    JSON.stringify(
                        loggedInUser
                    )

                );


                /*
                =========================================
                UPDATE REACT CONTEXT
                =========================================
                */

                setUser(
                    loggedInUser
                );


                /*
                =========================================
                REDIRECT
                =========================================
                */

                const requestedPage =
                    location.state?.from;


                const destination =
                    typeof requestedPage === "string"
                        ? requestedPage
                        : "/";


                navigate(

                    destination,

                    {
                        replace: true
                    }

                );


            } catch (err) {

                console.error(
                    "LOGIN ERROR:",
                    err
                );


                /*
                =========================================
                NETWORK ERROR
                =========================================
                */

                if (
                    !err.response
                ) {

                    setError(
                        "Cannot connect to JR Store server. Please try again."
                    );

                    return;

                }


                /*
                =========================================
                SERVER ERROR
                =========================================
                */

                const serverMessage =
                    err.response?.data?.message;


                if (
                    serverMessage
                ) {

                    setError(
                        serverMessage
                    );

                } else if (
                    err.response?.status === 401
                ) {

                    setError(
                        "Invalid email or password."
                    );

                } else if (
                    err.response?.status === 404
                ) {

                    setError(
                        "Login API was not found. Please refresh and try again."
                    );

                } else if (
                    err.response?.status >= 500
                ) {

                    setError(
                        "Server error. Please try again in a moment."
                    );

                } else {

                    setError(
                        "Login failed. Please try again."
                    );

                }

            } finally {

                setLoading(false);

            }

        };


    /*
    =====================================================
    ANIMATIONS
    =====================================================
    */

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

            variants={
                pageVariants
            }

            initial="hidden"
            animate="visible"
        >

            <div
                className="login-bg-glow glow-one"
            />

            <div
                className="login-bg-glow glow-two"
            />

            <div
                className="login-bg-grid"
            />


            <motion.div
                className="login-box jr-login-box"

                variants={
                    cardVariants
                }

                initial="hidden"
                animate="visible"
            >


                {/* BRAND */}

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


                {/* TITLE */}

                <div className="login-heading">

                    <h1>
                        Welcome Back 👋
                    </h1>

                    <p>
                        Sign in to continue to
                        <strong>
                            {" "}JR Store
                        </strong>
                    </p>

                </div>


                {/* ERROR */}

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


                {/* FORM */}

                <form
                    onSubmit={
                        handleLogin
                    }

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

                                disabled={
                                    loading
                                }

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

                                disabled={
                                    loading
                                }

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

                                {
                                    showPassword
                                        ? <FaEyeSlash />
                                        : <FaEye />
                                }

                            </button>

                        </div>

                    </div>


                    {/* LOGIN BUTTON */}

                    <motion.button
                        type="submit"

                        className="login-submit-btn"

                        disabled={
                            loading
                        }

                        whileHover={
                            !loading
                                ? {
                                    scale: 1.02,
                                    y: -2
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

                        {
                            loading
                                ? "Signing in..."
                                : "Login to JR Store"
                        }


                        {!loading && (

                            <FaArrowRight />

                        )}

                    </motion.button>


                </form>


                {/* REGISTER */}

                <div className="login-register">

                    <span>
                        Don't have an account?
                    </span>


                    <Link
                        to="/register"
                    >
                        Create Account
                    </Link>

                </div>


            </motion.div>

        </motion.div>

    );

};


export default Login;
