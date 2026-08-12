import React from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    FaUserCircle,
    FaSignOutAlt,
    FaEnvelope,
    FaUserTag,
    FaShoppingBag,
    FaHeart,
    FaBoxOpen,
    FaComments,
    FaEdit,
    FaCog
} from "react-icons/fa";

import { useApp } from "../context/AppContext";

import "../styles/Profile.css";


const Profile = () => {

    const {
        user,
        logout
    } = useApp();

    const navigate =
        useNavigate();


    // ==========================
    // AUTH CHECK
    // ==========================

    if (!user) {

        navigate("/login");

        return null;

    }


    // ==========================
    // USER DATA
    // ==========================

    const userName =
        user.name || "Marketplace User";

    const userEmail =
        user.email || "No email available";

    const userRole =
        user.role || "customer";


    const avatar =
        user.avatar ||
        user.profileImage ||
        user.image ||
        null;


    const bio =
        user.bio ||
        "Welcome to my Marketplace profile.";


    const location =
        user.location ||
        "Location not added";


    // ==========================
    // LOGOUT
    // ==========================

    const handleLogout = () => {

        logout();

        navigate("/login");

    };


    return (

        <div className="profile-page">


            {/* ==========================
                COVER SECTION
            =========================== */}

            <div className="profile-cover">

                <div className="cover-overlay">

                    <div className="cover-content">

                        <span>
                            Marketplace Profile
                        </span>

                    </div>

                </div>

            </div>


            {/* ==========================
                PROFILE CONTAINER
            =========================== */}

            <div className="profile-container">


                {/* ==========================
                    PROFILE HEADER
                =========================== */}

                <section className="profile-header">


                    {/* PROFILE IMAGE */}

                    <div className="profile-avatar">

                        {avatar ? (

                            <img
                                src={avatar}
                                alt={userName}
                            />

                        ) : (

                            <FaUserCircle />

                        )}

                    </div>


                    {/* USER INFORMATION */}

                    <div className="profile-main-info">

                        <h1>
                            {userName}
                        </h1>


                        <span className="profile-role">

                            <FaUserTag />

                            {userRole}

                        </span>


                        <p className="profile-bio">

                            {bio}

                        </p>


                        <p className="profile-location">

                            📍 {location}

                        </p>

                    </div>


                    {/* PROFILE ACTIONS */}

                    <div className="profile-actions">

                        <button
                            className="edit-profile-btn"
                            onClick={() =>
                                alert(
                                    "Edit Profile will be available soon."
                                )
                            }
                        >

                            <FaEdit />

                            Edit Profile

                        </button>


                        <button
                            className="settings-btn"
                            onClick={() =>
                                alert(
                                    "Settings will be available soon."
                                )
                            }
                        >

                            <FaCog />

                        </button>

                    </div>


                </section>


                {/* ==========================
                    PROFILE BODY
                =========================== */}

                <div className="profile-content">


                    {/* ==========================
                        ABOUT
                    =========================== */}

                    <div className="profile-card about-card">

                        <h2>
                            About
                        </h2>


                        <div className="profile-detail">

                            <FaEnvelope />

                            <div>

                                <span>
                                    Email
                                </span>

                                <strong>
                                    {userEmail}
                                </strong>

                            </div>

                        </div>


                        <div className="profile-detail">

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


                        <div className="profile-detail">

                            <FaShoppingBag />

                            <div>

                                <span>
                                    Marketplace
                                </span>

                                <strong>
                                    Buyer & Seller Community
                                </strong>

                            </div>

                        </div>

                    </div>


                    {/* ==========================
                        QUICK ACTIONS
                    =========================== */}

                    <div className="profile-card">

                        <h2>
                            Quick Access
                        </h2>


                        <div className="profile-actions-grid">


                            <Link
                                to="/orders"
                                className="profile-action-card"
                            >

                                <FaBoxOpen />

                                <div>

                                    <strong>
                                        My Orders
                                    </strong>

                                    <span>
                                        Track your orders
                                    </span>

                                </div>

                            </Link>


                            <Link
                                to="/wishlist"
                                className="profile-action-card"
                            >

                                <FaHeart />

                                <div>

                                    <strong>
                                        Wishlist
                                    </strong>

                                    <span>
                                        Saved products
                                    </span>

                                </div>

                            </Link>


                            <Link
                                to="/messenger"
                                className="profile-action-card"
                            >

                                <FaComments />

                                <div>

                                    <strong>
                                        Messages
                                    </strong>

                                    <span>
                                        Chat with users
                                    </span>

                                </div>

                            </Link>


                            <Link
                                to="/dashboard"
                                className="profile-action-card"
                            >

                                <FaShoppingBag />

                                <div>

                                    <strong>
                                        Dashboard
                                    </strong>

                                    <span>
                                        Manage your account
                                    </span>

                                </div>

                            </Link>


                        </div>

                    </div>


                    {/* ==========================
                        ACCOUNT SETTINGS
                    =========================== */}

                    <div className="profile-card account-card">

                        <div>

                            <h2>
                                Account
                            </h2>

                            <p>
                                Manage your Marketplace
                                account.
                            </p>

                        </div>


                        <button
                            className="logout-button"
                            onClick={handleLogout}
                        >

                            <FaSignOutAlt />

                            Logout

                        </button>

                    </div>


                </div>

            </div>

        </div>

    );

};


export default Profile;
