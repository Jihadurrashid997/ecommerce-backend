import React, { useCallback, useEffect, useState } from "react";
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
import { getUploadUrl } from "../services/api";
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
    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState("");

    useEffect(() => {
        if (!profileFile) {
            setProfilePreview("");
            return undefined;
        }

        const previewUrl = URL.createObjectURL(profileFile);
        setProfilePreview(previewUrl);

        return () => URL.revokeObjectURL(previewUrl);
    }, [profileFile]);


    // ==========================
    // LOAD PROFILE
    // ==========================

    const loadProfile = useCallback(async () => {

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

    }, []);


    // ==========================
    // AUTH CHECK
    // ==========================

    useEffect(() => {

        if (!user) {
            navigate("/login");
            return;
        }

        loadProfile();

    }, [user, navigate, loadProfile]);


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

    const handleProfileFile = event => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Choose an image file.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("Profile photos must be 10MB or smaller.");
            return;
        }

        setProfileFile(file);
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


            let profilePayload = {
                        name:
                            formData.name.trim(),

                        bio:
                            formData.bio.trim(),

                        location:
                            formData.location.trim(),

                        profileImage:
                            formData.profileImage.trim()
                    };

            if (profileFile) {
                profilePayload = new FormData();
                profilePayload.append("name", formData.name.trim());
                profilePayload.append("bio", formData.bio.trim());
                profilePayload.append("location", formData.location.trim());
                profilePayload.append("profileImage", profileFile);
            }

            const response = await api.put(
                "/users/profile",
                profilePayload,
                profileFile
                    ? {
                        timeout: 120000,
                        headers: { "Content-Type": "multipart/form-data" }
                    }
                    : undefined
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

                        {profilePreview || formData.profileImage ? (

                            <img
                                src={getUploadUrl(profilePreview || formData.profileImage)}
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
                            Profile photo
                        </label>

                        <div className="input-wrapper">
                            <FaUserCircle />
                            <input
                                id="profileImage"
                                name="profileImage"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                                onChange={handleProfileFile}
                                disabled={saving}
                            />
                        </div>

                        <small>
                            Choose an image up to 10MB. Your new photo previews above.
                        </small>

                        {profileFile && (
                            <button
                                type="button"
                                className="cancel-profile-btn"
                                onClick={() => setProfileFile(null)}
                                disabled={saving}
                            >
                                Keep current photo
                            </button>
                        )}

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
