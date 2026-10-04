import React, {
    useState
} from "react";

import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import {
    FaLock,
    FaEye,
    FaEyeSlash,
    FaArrowRight,
    FaCheckCircle
} from "react-icons/fa";

import {
    motion
} from "framer-motion";

import api from "../services/api";

import "../styles/Login.css";


const ResetPassword = () => {

    const navigate =
        useNavigate();

    const { token } =
        useParams();

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

    const [success, setSuccess] =
        useState(false);


    const handleSubmit =
        async event => {

            event.preventDefault();

            setError("");

            if (password.length < 6) {

                setError(
                    "Password must be at least 6 characters."
                );

                return;

            }

            if (password !== confirmPassword) {

                setError(
                    "Passwords do not match."
                );

                return;

            }

            try {

                setLoading(true);

                await api.post(
                    `/auth/reset-password/${token}`,
                    { password }
                );

                setSuccess(true);

                setTimeout(() => {

                    navigate("/login");

                }, 2500);

            } catch (err) {

                setError(
                    err.response?.data?.message ||
                    "This reset link is invalid or has expired."
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

                    <h1>Reset your password</h1>

                    <p>
                        {success
                            ? "Your password has been changed."
                            : "Choose a new password for your account."}
                    </p>

                </div>


                {error && (

                    <div className="login-error">
                        {error}
                    </div>

                )}


                {success ? (

                    <div className="login-heading" style={{ marginTop: 24 }}>

                        <FaCheckCircle
                            style={{
                                fontSize: 40,
                                color: "#4ade80",
                                marginBottom: 12
                            }}
                        />

                        <p>
                            Taking you to the login page...
                        </p>

                    </div>

                ) : (

                    <form onSubmit={handleSubmit}>

                        <div className="login-input-group">

                            <label htmlFor="password">
                                New password
                            </label>

                            <div className="login-input-wrapper">

                                <FaLock
                                    className="login-input-icon"
                                />

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

                                <FaLock
                                    className="login-input-icon"
                                />

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

                            {loading ? (
                                "Resetting..."
                            ) : (
                                <>
                                    Reset password
                                    <FaArrowRight />
                                </>
                            )}

                        </motion.button>

                    </form>

                )}


                <div className="login-register">

                    <Link to="/login">
                        Back to login
                    </Link>

                </div>

            </motion.div>

        </div>

    );

};


export default ResetPassword;
