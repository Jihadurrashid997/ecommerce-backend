import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    FaUser,
    FaMapMarkerAlt,
    FaInfoCircle,
    FaCamera,
    FaSave,
    FaArrowLeft
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

    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        bio: "",
        location: "",
        profileImage: ""
    });


    useEffect(() => {

        if (!user) {
            navigate("/login");
            return;
        }

        setFormData({
            name: user.name || "",
            bio: user.bio || "",
            location: user.location || "",
            profileImage: user.profileImage || ""
        });

    }, [user, navigate]);


    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));

    };


    const handleImageChange = (e) => {

        const file = e.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {

            alert("Please select a valid image.");

            return;
        }

        if (file.size > 5 * 1024 * 1024) {

            alert(
                "Image size must be less than 5MB."
            );

            return;
        }

        const reader = new FileReader();

        reader.onloadend = () => {

            setFormData((prev) => ({
                ...prev,
                profileImage: reader.result
            }));

        };

        reader.readAsDataURL(file);

    };


    const handleSubmit = async (e) => {

        e.preventDefault();

        if (!formData.name.trim()) {

            alert("Name cannot be empty.");

            return;
        }

        try {

            setLoading(true);

            const response = await api.put(
                "/users/profile",
                {
                    name: formData.name,
                    bio: formData.bio,
                    location: formData.location,
                    profileImage: formData.profileImage
                }
            );


            const updatedUser =
                response.data?.user;


            if (updatedUser) {

                setUser(updatedUser);

                /*
                 * Keep localStorage in sync if
                 * AppContext stores user there.
                 */

                localStorage.setItem(
                    "user",
                    JSON.stringify(updatedUser)
                );

            }


            alert(
                "Profile updated successfully!"
            );

            navigate("/profile");

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


    if (!user) {
        return null;
    }


    return (

        <div className="edit-profile-page">

            <div className="edit-profile-container">


                {/* =========================
                    HEADER
                ========================== */}

                <div className="edit-profile-header">

                    <button
                        type="button"
                        className="back-profile-btn"
                        onClick={() =>
                            navigate("/profile")
                        }
                    >
                        <FaArrowLeft />

                        Back to Profile
                    </button>


                    <div>

                        <h1>
                            Edit Profile
                        </h1>

                        <p>
                            Update your personal
                            information
                        </p>

                    </div>

                </div>


                {/* =========================
                    PROFILE PREVIEW
                ========================== */}

                <div className="profile-preview">

                    <div className="edit-avatar">

                        {formData.profileImage ? (

                            <img
                                src={
                                    formData.profileImage
                                }
                                alt="Profile"
                            />

                        ) : (

                            <FaUser />

                        )}

                    </div>


                    <label
                        htmlFor="profileImage"
                        className="change-photo-btn"
                    >

                        <FaCamera />

                        Change Photo

                    </label>


                    <input
                        id="profileImage"
                        type="file"
                        accept="image/*"
                        onChange={
                            handleImageChange
                        }
                        hidden
                    />

                    <small>
                        JPG, PNG or WEBP • Max 5MB
                    </small>

                </div>


                {/* =========================
                    FORM
                ========================== */}

                <form
                    className="edit-profile-form"
                    onSubmit={handleSubmit}
                >


                    {/* Name */}

                    <div className="form-group">

                        <label htmlFor="name">

                            <FaUser />

                            Full Name

                        </label>

                        <input
                            id="name"
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter your name"
                            maxLength={100}
                            required
                        />

                    </div>


                    {/* Bio */}

                    <div className="form-group">

                        <label htmlFor="bio">

                            <FaInfoCircle />

                            Bio

                        </label>

                        <textarea
                            id="bio"
                            name="bio"
                            value={formData.bio}
                            onChange={handleChange}
                            placeholder="Tell people something about yourself..."
                            maxLength={500}
                            rows={5}
                        />

                        <span className="character-count">

                            {formData.bio.length}/500

                        </span>

                    </div>


                    {/* Location */}

                    <div className="form-group">

                        <label htmlFor="location">

                            <FaMapMarkerAlt />

                            Location

                        </label>

                        <input
                            id="location"
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="e.g. Dhaka, Bangladesh"
                            maxLength={100}
                        />

                    </div>


                    {/* Email - Read Only */}

                    <div className="form-group">

                        <label>

                            Email Address

                        </label>

                        <input
                            type="email"
                            value={
                                user.email || ""
                            }
                            disabled
                        />

                        <small>
                            Email address cannot be
                            changed here.
                        </small>

                    </div>


                    {/* Actions */}

                    <div className="edit-profile-actions">

                        <button
                            type="button"
                            className="cancel-btn"
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
                                : "Save Changes"
                            }

                        </button>

                    </div>

                </form>

            </div>

        </div>

    );

};

export default EditProfile;
