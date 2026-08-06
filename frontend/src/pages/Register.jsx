import React, { useState } from "react";
import api from "../services/api";
import { motion } from "framer-motion";
import "../styles/Register.css";

const Register = () => {

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      await api.post("/auth/register", formData);

      alert("Registration Successful");

      window.location.href = "/login";

    } catch (err) {
      alert(
        err.response?.data?.message ||
        "Registration Failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">

      <motion.form
        className="register-box"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .7 }}
        onSubmit={handleRegister}
      >

        <h1>Create Account</h1>

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          required
        />

        <select
          name="role"
          onChange={handleChange}
          value={formData.role}
        >
          <option value="customer">Customer</option>
          <option value="seller">Seller</option>
        </select>

        <button type="submit">

          {
            loading
              ? "Creating..."
              : "Create Account"
          }

        </button>

      </motion.form>

    </div>
  );
};

export default Register;
