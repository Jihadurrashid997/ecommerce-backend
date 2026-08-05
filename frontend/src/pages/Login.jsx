import React, { useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";
import "./Login.css";

const Login = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {

        e.preventDefault();

        try {

            setLoading(true);

            const res = await api.post("/auth/login", {

                email,
                password

            });

            localStorage.setItem("token", res.data.token);

            localStorage.setItem("user", JSON.stringify(res.data.user));

            alert("Login Successful");

            window.location.href="/";

        } catch(err){

            alert(
                err.response?.data?.message ||
                "Login Failed"
            );

        } finally{

            setLoading(false);

        }

    }

    return(

        <div className="login-page">

            <motion.form

            initial={{opacity:0,y:50}}

            animate={{opacity:1,y:0}}

            transition={{duration:.6}}

            className="login-box"

            onSubmit={handleLogin}

            >

                <h1>

                    Welcome Back 👋

                </h1>

                <input

                type="email"

                placeholder="Email"

                value={email}

                onChange={(e)=>setEmail(e.target.value)}

                />

                <input

                type="password"

                placeholder="Password"

                value={password}

                onChange={(e)=>setPassword(e.target.value)}

                />

                <button>

                    {

                        loading ?

                        "Signing In..."

                        :

                        "Login"

                    }

                </button>

            </motion.form>

        </div>

    )

}

export default Login;
