import React, { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowRight, FaCheckCircle, FaEnvelope, FaKey } from "react-icons/fa";
import { motion } from "framer-motion";
import api from "../services/api";
import EtopLogo from "../components/EtopLogo";
import "../styles/EtopLogo.css";
import "../styles/Login.css";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState(searchParams.get("email") || "");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(location.state?.notice || "");
    const [noticeIsError, setNoticeIsError] = useState(
        Boolean(location.state?.noticeIsError)
    );
    const [verified, setVerified] = useState(false);

    const handleVerify = async event => {
        event.preventDefault();
        setError("");
        if (!email.trim() || !/^\d{6}$/.test(code)) {
            setError("Enter the email address and the 6-digit code.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/verify-email", {
                email: email.trim(),
                code
            });
            setVerified(true);
            window.setTimeout(() => navigate("/login", { replace: true }), 1800);
        } catch (verifyError) {
            setError(
                verifyError.response?.data?.message ||
                "The code could not be verified. Request a new one and try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setNotice("");
        setNoticeIsError(false);
        if (!email.trim()) {
            setError("Enter the email address you used to create your account.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/auth/resend-verification", {
                email: email.trim()
            });
            setNotice(
                response.data?.message ||
                "If the account needs verification, a new code will be sent."
            );
            setNoticeIsError(false);
        } catch (resendError) {
            setError(
                resendError.response?.data?.message ||
                "A new code could not be sent. Please try again later."
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
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <EtopLogo size="md" light />
                </div>
                <div className="login-heading">
                    <h1>{verified ? "Email verified" : "Verify your email"}</h1>
                    <p>
                        {verified
                            ? "Your E Top account is ready. Taking you to sign in..."
                            : "Enter the 6-digit code sent to your inbox. The code expires in 10 minutes."}
                    </p>
                </div>

                {notice && (
                    <div
                        className={noticeIsError ? "login-error" : "login-success"}
                        role={noticeIsError ? "alert" : "status"}
                    >
                        {notice}
                    </div>
                )}
                {error && <div className="login-error" role="alert">{error}</div>}

                {verified ? (
                    <div className="login-heading" style={{ marginTop: 24 }}>
                        <FaCheckCircle
                            aria-label="Email verified"
                            style={{ fontSize: 40, color: "#4ade80", marginBottom: 12 }}
                        />
                        <p><Link to="/login">Sign in now</Link></p>
                    </div>
                ) : (
                    <form onSubmit={handleVerify}>
                        <div className="login-input-group">
                            <label htmlFor="verification-email">Email address</label>
                            <div className="login-input-wrapper">
                                <FaEnvelope className="login-input-icon" />
                                <input
                                    id="verification-email"
                                    type="email"
                                    value={email}
                                    onChange={event => setEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        <div className="login-input-group">
                            <label htmlFor="verification-code">6-digit code</label>
                            <div className="login-input-wrapper">
                                <FaKey className="login-input-icon" />
                                <input
                                    id="verification-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
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
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        <motion.button
                            type="submit"
                            className="login-submit-btn"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                        >
                            {loading ? "Verifying..." : <>Verify email <FaArrowRight /></>}
                        </motion.button>
                        <div className="login-register" style={{ marginTop: 14 }}>
                            <button
                                type="button"
                                className="link-button"
                                onClick={handleResend}
                                disabled={loading}
                            >
                                Resend verification code
                            </button>
                        </div>
                    </form>
                )}

                <div className="login-register">
                    <Link to="/register">Create a different account</Link>
                    <Link to="/login">Back to login</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;
