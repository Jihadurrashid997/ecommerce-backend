import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { FaUserCircle, FaSave, FaArrowLeft } from "react-icons/fa";

import { useApp } from "../context/AppContext";
import api from "../services/api";

import "../styles/EditProfile.css";

const EditProfile = () => {

    const { user } = useApp();

    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: user?.name || "",
        bio: user?.bio || "",
        location: user?.location || "",
        profileImage:
            user?.profileImage ||
            user?.avatar ||
            user?.image ||
            ""
    });

    const [loading, setLoading] = useState(false);


    // ==========================
    // AUTH CHECK
    // ==========================

    if (!user) {

        navigate("/login");

        return null;

    }


    // ==========================
    // HANDLE INPUT
    // ==========================

    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;

        setFormData({
            ...formData,
            [name]: value
        });

    };


    // ==========================
    // UPDATE PROFILE
    // ==========================

    const handleSubmit = async (e) => {

        e.preventDefault();

        if (!formData.name.trim()) {

            alert("Name is required.");

            return;

        }

        try {

            setLoading(true);

            const response = await api.put(
                "/users/profile",
                formData
            );

            const updatedUser =
                response.data?.user ||
                response.data;

            // Update localStorage user
            localStorage.setItem(
                "user",
                JSON.stringify(updatedUser)
            );

            alert(
                "Profile updated successfully!"
            );

            navigate("/profile");

            window.location.reload();

        } catch (err) {

            console.error(
                "Profile update error:",
                err
            );

            alert(
                err.response?.data?.message ||
                "Failed to update profile."
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="edit-profile-page">

            <div className="edit-profile-container">


                {/* ==========================
                    HEADER
                =========================== */}

                <div className="edit-profile-header">

                    <button
                        className="back-profile-btn"
                        onClick={() =>
                            navigate("/profile")
                        }
                    >

                        <FaArrowLeft />

                        Back to Profile

                    </button>


                    <h1>
                        Edit Profile
                    </h1>

                    <p>
                        Update your Marketplace profile information.
                    </p>

                </div>


                {/* ==========================
                    PROFILE PREVIEW
                =========================== */}

                <div className="profile-preview">

                    {formData.profileImage ? (

                        <img
                            src={formData.profileImage}
                            alt="Profile"
                            onError={(e) => {
                                e.currentTarget.style.display =
                                    "none";
                            }}
                        />

                    ) : (

                        <FaUserCircle />

                    )}

                    <h2>
                        {formData.name ||
                            "Marketplace User"}
                    </h2>

                </div>


                {/* ==========================
                    FORM
                =========================== */}

                <form
                    className="edit-profile-form"
                    onSubmit={handleSubmit}
                >


                    {/* NAME */}

                    <div className="form-group">

                        <label>
                            Full Name
                        </label>

                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter your name"
                            required
                        />

                    </div>


                    {/* EMAIL */}

                    <div className="form-group">

                        <label>
                            Email
                        </label>

                        <input
                            type="email"
                            value={user.email || ""}
                            disabled
                        />

                        <small>
                            Email cannot be changed.
                        </small>

                    </div>


                    {/* BIO */}

                    <div className="form-group">

                        <label>
                            Bio
                        </label>

                        <textarea
                            name="bio"
                            value={formData.bio}
                            onChange={handleChange}
                            placeholder="Tell something about yourself..."
                            rows="4"
                            maxLength="250"
                        />

                        <small>
                            {formData.bio.length}/250
                        </small>

                    </div>


                    {/* LOCATION */}

                    <div className="form-group">

                        <label>
                            Location
                        </label>

                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="e.g. Dhaka, Bangladesh"
                        />

                    </div>


                    {/* PROFILE IMAGE */}

                    <div className="form-group">

                        <label>
                            Profile Image URL
                        </label>

                        <input
                            type="url"
                            name="profileImage"
                            value={
                                formData.profileImage
                            }
                            onChange={handleChange}
                            placeholder="https://example.com/image.jpg"
                        />

                        <small>
                            Paste a public image URL.
                        </small>

                    </div>


                    {/* BUTTONS */}

                    <div className="edit-profile-actions">

                        <button
                            type="button"
                            className="cancel-profile-btn"
                            onClick={() =>
                                navigate("/profile")
                            }
                            disabled={loading}
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            className="save-profile-btn"
                            disabled={loading}
                        >

                            <FaSave />

                            {loading
                                ? "Saving..."
                                : "Save Changes"}

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

};

export default EditProfile;
