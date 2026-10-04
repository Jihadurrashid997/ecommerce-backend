import React, {
    useState
} from "react";

import {
    Link
} from "react-router-dom";

import {
    FaEnvelope,
    FaArrowRight,
    FaArrowLeft,
    FaCheckCircle
} from "react-icons/fa";

import {
    motion
} from "framer-motion";

import api from "../services/api";

import "../styles/Login.css";


const ForgotPassword = () => {

    const [email, setEmail] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [submitted, setSubmitted] =
        useState(false);


    const handleSubmit =
        async event => {

            event.preventDefault();

            setError("");

            if (!email.trim()) {

                setError(
                    "Please enter your email address."
                );

                return;

            }

            try {

                setLoading(true);

                await api.post(
                    "/auth/forgot-password",
                    { email: email.trim() }
                );

                // Always show the same success state,
                // whether or not the email exists - this
                // matches the backend's intentionally
                // generic response (prevents account
                // enumeration).
                setSubmitted(true);

            } catch (err) {

                setError(
                    err.response?.data?.message ||
                    "Something went wrong. Please try again."
                );

            } finally {

                setLoading(false);

            }

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

                <div className="login-heading">

                    <h1>Forgot your password?</h1>

                    <p>
                        {submitted
                            ? "Check your inbox for a reset link."
                            : "Enter the email on your account and we'll send you a link to reset your password."}
                    </p>

                </div>


                {error && (

                    <div className="login-error">
                        {error}
                    </div>

                )}


                {submitted ? (

                    <div className="login-heading" style={{ marginTop: 24 }}>

                        <FaCheckCircle
                            style={{
                                fontSize: 40,
                                color: "#4ade80",
                                marginBottom: 12
                            }}
                        />

                        <p>
                            If an account exists for <strong>{email}</strong>,
                            a password reset link has been sent. The link
                            expires in 1 hour.
                        </p>

                    </div>

                ) : (

                    <form onSubmit={handleSubmit}>

                        <div className="login-input-group">

                            <label htmlFor="email">
                                Email
                            </label>

                            <div className="login-input-wrapper">

                                <FaEnvelope
                                    className="login-input-icon"
                                />

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

                            {loading ? (
                                "Sending..."
                            ) : (
                                <>
                                    Send reset link
                                    <FaArrowRight />
                                </>
                            )}

                        </motion.button>

                    </form>

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
