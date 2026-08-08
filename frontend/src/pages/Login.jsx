import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import { useApp } from "../context/AppContext";
import "../styles/Login.css";

const Login = () => {

    const navigate = useNavigate();
    const { setUser } = useApp();

    const [form, setForm] = useState({
        email: "",
        password: ""
    });

    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    };

    const handleLogin = async (e) => {

        e.preventDefault();

        if (!form.email || !form.password) {

            alert("Please enter email and password.");

            return;

        }

        try {

            setLoading(true);

            const res = await api.post(
                "/auth/login",
                form
            );

            localStorage.setItem(
                "token",
                res.data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(res.data.user)
            );

            setUser(res.data.user);

            alert("Login Successful!");

            navigate("/");

        } catch (err) {

            alert(
                err.response?.data?.message ||
                "Login Failed"
            );

        } finally {

            setLoading(false);

        }

    };

    return (

        <div className="login-page">

            <motion.form

                className="login-box"

                onSubmit={handleLogin}

                initial={{
                    opacity: 0,
                    y: 40
                }}

                animate={{
                    opacity: 1,
                    y: 0
                }}

                transition={{
                    duration: 0.5
                }}

            >

                <h1>
                    Welcome Back 👋
                </h1>

                <p>
                    Login to your Marketplace account
                </p>

                <input

                    type="email"

                    name="email"

                    placeholder="Email Address"

                    value={form.email}

                    onChange={handleChange}

                    required

                />

                <input

                    type="password"

                    name="password"

                    placeholder="Password"

                    value={form.password}

                    onChange={handleChange}

                    required

                />

                <button
                    type="submit"
                    disabled={loading}
                >

                    {loading
                        ? "Signing In..."
                        : "Login"
                    }

                </button>

                <p className="auth-link">

                    Don't have an account?

                    {" "}

                    <Link to="/register">
                        Register
                    </Link>

                </p>

            </motion.form>

        </div>

    );

};

export default Login;
