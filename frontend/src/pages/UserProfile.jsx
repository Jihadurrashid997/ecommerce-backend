import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
    FaUserCircle,
    FaEnvelope,
    FaUserTag,
    FaMapMarkerAlt,
    FaComments,
    FaBoxOpen,
    FaHeart,
    FaArrowLeft
} from "react-icons/fa";

import api from "../services/api";

import "../styles/UserProfile.css";


const UserProfile = () => {

    const { id } = useParams();

    const navigate = useNavigate();

    const [user, setUser] = useState(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");


    // ==========================
    // FETCH USER PROFILE
    // ==========================

    useEffect(() => {

        fetchUserProfile();

    }, [id]);


    const fetchUserProfile = async () => {

        try {

            setLoading(true);

            setError("");

            const response = await api.get(
                `/users/public/${id}`
            );

            setUser(
                response.data?.user ||
                response.data
            );

        } catch (err) {

            console.error(
                "Profile loading error:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Unable to load this profile."
            );

        } finally {

            setLoading(false);

        }

    };


    // ==========================
    // LOADING
    // ==========================

    if (loading) {

        return (

            <div className="public-profile-loading">

                <div className="profile-spinner"></div>

                <p>
                    Loading profile...
                </p>

            </div>

        );

    }


    // ==========================
    // ERROR
    // ==========================

    if (error || !user) {

        return (

            <div className="public-profile-error">

                <FaUserCircle />

                <h2>
                    Profile Not Found
                </h2>

                <p>
                    {error ||
                        "This user profile could not be found."}
                </p>

                <button
                    onClick={() => navigate(-1)}
                >
                    Go Back
                </button>

            </div>

        );

    }


    const userName =
        user.name || "Marketplace User";

    const userRole =
        user.role || "customer";

    const avatar =
        user.profileImage ||
        user.avatar ||
        user.image ||
        null;

    const bio =
        user.bio ||
        "Welcome to my Marketplace profile.";

    const location =
        user.location ||
        "Location not added";


    return (

        <div className="public-profile-page">


            {/* ==========================
                BACK BUTTON
            =========================== */}

            <div className="public-profile-topbar">

                <button
                    className="back-profile-btn"
                    onClick={() => navigate(-1)}
                >

                    <FaArrowLeft />

                    Back

                </button>

            </div>


            {/* ==========================
                COVER
            =========================== */}

            <section className="public-profile-cover">

                <div className="cover-glow"></div>

            </section>


            {/* ==========================
                PROFILE HEADER
            =========================== */}

            <section className="public-profile-header">


                {/* AVATAR */}

                <div className="public-profile-avatar">

                    {avatar ? (

                        <img
                            src={avatar}
                            alt={userName}
                        />

                    ) : (

                        <FaUserCircle />

                    )}

                </div>


                {/* USER INFO */}

                <div className="public-profile-main">

                    <h1>
                        {userName}
                    </h1>

                    <div className="public-profile-role">

                        <FaUserTag />

                        <span>
                            {userRole}
                        </span>

                    </div>

                    <p className="public-profile-bio">

                        {bio}

                    </p>

                    <div className="public-profile-location">

                        <FaMapMarkerAlt />

                        <span>
                            {location}
                        </span>

                    </div>

                </div>


                {/* ACTIONS */}

                <div className="public-profile-actions">

                    <Link
                        to={`/messenger?user=${user._id}`}
                        className="profile-message-btn"
                    >

                        <FaComments />

                        Message

                    </Link>

                </div>

            </section>


            {/* ==========================
                CONTENT
            =========================== */}

            <div className="public-profile-content">


                {/* ABOUT */}

                <section className="public-profile-card">

                    <h2>
                        About
                    </h2>

                    <div className="public-profile-details">


                        <div className="public-profile-detail">

                            <FaEnvelope />

                            <div>

                                <span>
                                    Email
                                </span>

                                <strong>
                                    {user.email ||
                                        "Not available"}
                                </strong>

                            </div>

                        </div>


                        <div className="public-profile-detail">

                            <FaUserTag />

                            <div>

                                <span>
                                    Account Type
                                </span>

                                <strong>
                                    {userRole}
                                </strong>

                            </div>

                        </div>


                        <div className="public-profile-detail">

                            <FaMapMarkerAlt />

                            <div>

                                <span>
                                    Location
                                </span>

                                <strong>
                                    {location}
                                </strong>

                            </div>

                        </div>

                    </div>

                </section>


                {/* QUICK ACTIONS */}

                <section className="public-profile-card">

                    <h2>
                        Marketplace
                    </h2>

                    <div className="public-profile-actions-grid">


                        <Link
                            to={`/messenger?user=${user._id}`}
                            className="public-action-card"
                        >

                            <FaComments />

                            <div>

                                <strong>
                                    Message
                                </strong>

                                <span>
                                    Start a conversation
                                </span>

                            </div>

                        </Link>


                        <Link
                            to="/"
                            className="public-action-card"
                        >

                            <FaBoxOpen />

                            <div>

                                <strong>
                                    Products
                                </strong>

                                <span>
                                    Explore marketplace
                                </span>

                            </div>

                        </Link>


                        <Link
                            to="/wishlist"
                            className="public-action-card"
                        >

                            <FaHeart />

                            <div>

                                <strong>
                                    Wishlist
                                </strong>

                                <span>
                                    Explore saved products
                                </span>

                            </div>

                        </Link>

                    </div>

                </section>


            </div>

        </div>

    );

};


export default UserProfile;
