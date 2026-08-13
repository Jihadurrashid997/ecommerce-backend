import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaUserCircle,
    FaSave,
    FaArrowLeft,
    FaMapMarkerAlt,
    FaInfoCircle,
    FaEnvelope
} from "react-icons/fa";

import api from "../services/api";
import { useApp } from "../context/AppContext";

import "../styles/EditProfile.css";


const EditProfile = () => {

    const navigate = useNavigate();

    const {
        user,
        setUser
    } = useApp();


    const [formData, setFormData] = useState({
        name: "",
        bio: "",
        location: "",
        profileImage: ""
    });


    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");


    // ==========================
    // AUTH CHECK
    // ==========================

    useEffect(() => {

        if (!user) {
            navigate("/login");
            return;
        }

        loadProfile();

    }, [user]);


    // ==========================
    // LOAD PROFILE
    // ==========================

    const loadProfile = async () => {

        try {

            setLoading(true);

            const response =
                await api.get("/users/profile");

            const profile =
                response.data?.user ||
                response.data;

            setFormData({
                name: profile.name || "",
                bio: profile.bio || "",
                location: profile.location || "",
                profileImage:
                    profile.profileImage || ""
            });

        } catch (err) {

            console.error(err);

            setError(
                err.response?.data?.message ||
                "Unable to load profile."
            );

        } finally {

            setLoading(false);

        }

    };


    // ==========================
    // INPUT CHANGE
    // ==========================

    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        setMessage("");
        setError("");

    };


    // ==========================
    // SAVE PROFILE
    // ==========================

    const handleSubmit = async (e) => {

        e.preventDefault();

        setMessage("");
        setError("");


        if (!formData.name.trim()) {

            setError(
                "Name is required."
            );

            return;

        }


        try {

            setSaving(true);


            const response =
                await api.put(
                    "/users/profile",
                    {
                        name:
                            formData.name.trim(),

                        bio:
                            formData.bio.trim(),

                        location:
                            formData.location.trim(),

                        profileImage:
                            formData.profileImage.trim()
                    }
                );


            const updatedUser =
                response.data?.user;


            if (updatedUser) {

                /*
                 * Update AppContext immediately.
                 * This makes Navbar/Profile
                 * show the new information
                 * without refreshing the page.
                 */

                if (typeof setUser === "function") {

                    setUser(updatedUser);

                }

                // Also keep localStorage in sync
                localStorage.setItem(
                    "user",
                    JSON.stringify(updatedUser)
                );

            }


            setMessage(
                "Profile updated successfully!"
            );


            setTimeout(() => {

                navigate("/profile");

            }, 900);


        } catch (err) {

            console.error(err);

            setError(
                err.response?.data?.message ||
                "Failed to update profile."
            );

        } finally {

            setSaving(false);

        }

    };


    // ==========================
    // LOADING
    // ==========================

    if (loading) {

        return (

            <div className="edit-profile-loading">

                <div className="edit-profile-spinner"></div>

                <p>
                    Loading profile...
                </p>

            </div>

        );

    }


    // ==========================
    // PAGE
    // ==========================

    return (

        <div className="edit-profile-page">


            {/* ==========================
                TOP
            =========================== */}

            <div className="edit-profile-top">

                <button
                    type="button"
                    className="back-btn"
                    onClick={() =>
                        navigate("/profile")
                    }
                >

                    <FaArrowLeft />

                    Back to Profile

                </button>

            </div>


            {/* ==========================
                CARD
            =========================== */}

            <div className="edit-profile-card">


                <div className="edit-profile-heading">

                    <div className="edit-profile-icon">

                        {formData.profileImage ? (

                            <img
                                src={
                                    formData.profileImage
                                }
                                alt="Profile"
                            />

                        ) : (

                            <FaUserCircle />

                        )}

                    </div>


                    <div>

                        <h1>
                            Edit Profile
                        </h1>

                        <p>
                            Update your Marketplace
                            profile information.
                        </p>

                    </div>

                </div>


                {/* ==========================
                    SUCCESS
                =========================== */}

                {message && (

                    <div className="profile-success">

                        ✓ {message}

                    </div>

                )}


                {/* ==========================
                    ERROR
                =========================== */}

                {error && (

                    <div className="profile-error">

                        ✕ {error}

                    </div>

                )}


                {/* ==========================
                    FORM
                =========================== */}

                <form
                    className="edit-profile-form"
                    onSubmit={handleSubmit}
                >


                    {/* NAME */}

                    <div className="form-group">

                        <label htmlFor="name">

                            Name

                        </label>

                        <div className="input-wrapper">

                            <FaUserCircle />

                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={
                                    formData.name
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Your name"
                                maxLength={60}
                            />

                        </div>

                    </div>


                    {/* EMAIL - READ ONLY */}

                    <div className="form-group">

                        <label htmlFor="email">

                            Email

                        </label>

                        <div className="input-wrapper">

                            <FaEnvelope />

                            <input
                                id="email"
                                type="email"
                                value={
                                    user?.email || ""
                                }
                                disabled
                            />

                        </div>

                        <small>
                            Email cannot be changed
                            from this page.
                        </small>

                    </div>


                    {/* BIO */}

                    <div className="form-group">

                        <label htmlFor="bio">

                            Bio

                        </label>

                        <div className="textarea-wrapper">

                            <FaInfoCircle />

                            <textarea
                                id="bio"
                                name="bio"
                                value={
                                    formData.bio
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Tell people a little about yourself..."
                                maxLength={300}
                                rows={5}
                            />

                        </div>

                        <small className="character-count">

                            {formData.bio.length}
                            /300

                        </small>

                    </div>


                    {/* LOCATION */}

                    <div className="form-group">

                        <label htmlFor="location">

                            Location

                        </label>

                        <div className="input-wrapper">

                            <FaMapMarkerAlt />

                            <input
                                id="location"
                                name="location"
                                type="text"
                                value={
                                    formData.location
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="e.g. Dhaka, Bangladesh"
                                maxLength={100}
                            />

                        </div>

                    </div>


                    {/* PROFILE IMAGE */}

                    <div className="form-group">

                        <label htmlFor="profileImage">

                            Profile Image URL

                        </label>

                        <div className="input-wrapper">

                            <FaUserCircle />

                            <input
                                id="profileImage"
                                name="profileImage"
                                type="url"
                                value={
                                    formData.profileImage
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="https://example.com/image.jpg"
                            />

                        </div>

                        <small>
                            Paste a direct image URL.
                        </small>

                    </div>


                    {/* BUTTONS */}

                    <div className="edit-profile-buttons">

                        <button
                            type="button"
                            className="cancel-profile-btn"
                            onClick={() =>
                                navigate("/profile")
                            }
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            className="save-profile-btn"
                            disabled={saving}
                        >

                            {saving ? (

                                <>
                                    <span className="button-spinner"></span>
                                    Saving...
                                </>

                            ) : (

                                <>
                                    <FaSave />
                                    Save Changes
                                </>

                            )}

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

};


export default EditProfile;
