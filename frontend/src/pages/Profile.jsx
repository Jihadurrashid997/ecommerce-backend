import React from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
    FaArrowRight,
    FaCalendarAlt,
    FaComments,
    FaCog,
    FaEdit,
    FaEnvelope,
    FaHeart,
    FaMapMarkerAlt,
    FaShieldAlt,
    FaShoppingBag,
    FaSignOutAlt,
    FaUserCircle,
    FaUserTag
} from "react-icons/fa";

import { useApp } from "../context/AppContext";
import { getUploadUrl } from "../services/api";
import ProfileSocial from "../components/ProfileSocial";
import VerifiedBadge from "../components/VerifiedBadge";

import "../styles/Profile.css";
import "../styles/VerifiedBadge.css";

const Profile = () => {
    const { user, logout } = useApp();
    const navigate = useNavigate();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const userName = user.name || "E Top user";
    const userEmail = user.email || "No email available";
    const userRole = user.role || "customer";
    const avatar = user.avatar || user.profileImage || user.image || null;
    const bio = user.bio || "Add a few words about yourself and make this space yours.";
    const location = user.location || "Add your location";
    const memberSince = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric"
        })
        : null;

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="profile-page">
            <header className="profile-hero">
                <div className="profile-hero-glow" aria-hidden="true" />
                <div className="profile-hero-inner">
                    <div className="profile-eyebrow">
                        <span className="profile-eyebrow-mark" />
                        E TOP MEMBER SPACE
                    </div>
                    <h1>
                        Your profile,
                        <span> your corner.</span>
                    </h1>
                    <p>A little space for your story, your community, and everything you love.</p>
                </div>
                <div className="profile-hero-stamp" aria-hidden="true">
                    <FaShieldAlt />
                    <span>YOUR<br />SPACE</span>
                </div>
            </header>

            <main className="profile-container">
                <section className="profile-overview" aria-label="Your profile overview">
                    <div className="profile-avatar-frame">
                        <div className="profile-avatar">
                            {avatar ? (
                                <img src={getUploadUrl(avatar)} alt={`${userName}'s profile`} />
                            ) : (
                                <FaUserCircle aria-hidden="true" />
                            )}
                        </div>
                        {user.isVerified && (
                            <span className="profile-avatar-verified" aria-label="Verified account">
                                <FaShieldAlt />
                            </span>
                        )}
                    </div>

                    <div className="profile-main-info">
                        <span className="profile-section-kicker">YOUR E TOP PROFILE</span>
                        <h2>
                            {userName}
                            {user.isVerified && <VerifiedBadge />}
                        </h2>
                        <div className="profile-meta">
                            <span className="profile-role">
                                <FaUserTag aria-hidden="true" />
                                {userRole}
                            </span>
                            {memberSince && (
                                <span className="profile-member-since">
                                    <FaCalendarAlt aria-hidden="true" />
                                    Member since {memberSince}
                                </span>
                            )}
                        </div>
                        <p className="profile-bio">{bio}</p>
                        <p className={`profile-location${user.location ? "" : " is-empty"}`}>
                            <FaMapMarkerAlt aria-hidden="true" />
                            {location}
                        </p>
                    </div>

                    <div className="profile-actions">
                        <button
                            className="edit-profile-btn"
                            type="button"
                            onClick={() => navigate("/edit-profile")}
                        >
                            <FaEdit aria-hidden="true" />
                            Edit profile
                            <FaArrowRight className="profile-button-arrow" aria-hidden="true" />
                        </button>
                        <button
                            className="settings-btn"
                            type="button"
                            onClick={() => navigate("/edit-profile")}
                            aria-label="Profile settings"
                            title="Profile settings"
                        >
                            <FaCog aria-hidden="true" />
                        </button>
                    </div>
                </section>

                <div className="profile-content">
                    <section className="profile-card about-card">
                        <div className="profile-card-heading">
                            <span className="profile-card-icon"><FaUserTag /></span>
                            <div>
                                <span className="profile-section-kicker">THE BASICS</span>
                                <h2>About you</h2>
                            </div>
                        </div>
                        <p className="profile-card-intro">The details that help your community know you better.</p>

                        <div className="profile-detail">
                            <span className="profile-detail-icon"><FaEnvelope /></span>
                            <div>
                                <span>Email address</span>
                                <strong>{userEmail}</strong>
                            </div>
                        </div>
                        <div className="profile-detail">
                            <span className="profile-detail-icon"><FaUserTag /></span>
                            <div>
                                <span>Account type</span>
                                <strong className="profile-role-label">{userRole}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="profile-card profile-shortcuts">
                        <div className="profile-card-heading">
                            <span className="profile-card-icon"><FaHeart /></span>
                            <div>
                                <span className="profile-section-kicker">MAKE YOURSELF AT HOME</span>
                                <h2>Your shortcuts</h2>
                            </div>
                        </div>
                        <div className="profile-actions-grid">
                            <Link to="/messenger" className="profile-action-card">
                                <span className="profile-shortcut-icon"><FaComments /></span>
                                <span className="profile-shortcut-copy">
                                    <strong>Messages</strong>
                                    <span>Pick up the conversation</span>
                                </span>
                                <FaArrowRight className="profile-shortcut-arrow" aria-hidden="true" />
                            </Link>
                            <Link to="/shop/orders" className="profile-action-card">
                                <span className="profile-shortcut-icon"><FaShoppingBag /></span>
                                <span className="profile-shortcut-copy">
                                    <strong>Your orders</strong>
                                    <span>Keep track of your purchases</span>
                                </span>
                                <FaArrowRight className="profile-shortcut-arrow" aria-hidden="true" />
                            </Link>
                            <Link to="/shop/wishlist" className="profile-action-card">
                                <span className="profile-shortcut-icon"><FaHeart /></span>
                                <span className="profile-shortcut-copy">
                                    <strong>Wishlist</strong>
                                    <span>All your saved favourites</span>
                                </span>
                                <FaArrowRight className="profile-shortcut-arrow" aria-hidden="true" />
                            </Link>
                        </div>
                    </section>

                    <section className="profile-card account-card">
                        <div>
                            <span className="profile-section-kicker">ACCOUNT</span>
                            <h2>Ready to step away?</h2>
                            <p>You can sign back in whenever you like.</p>
                        </div>
                        <button className="logout-button" type="button" onClick={handleLogout}>
                            <FaSignOutAlt aria-hidden="true" />
                            Sign out
                        </button>
                    </section>
                </div>

                <section className="profile-community-section" aria-labelledby="profile-community-title">
                    <div className="profile-community-heading">
                        <div>
                            <span className="profile-section-kicker">SHARE A LITTLE MORE</span>
                            <h2 id="profile-community-title">Your community</h2>
                        </div>
                        <p>Your photos, reels, and connections in one place.</p>
                    </div>
                    <ProfileSocial userId={user._id || user.id} isSelf />
                </section>
            </main>
        </div>
    );
};

export default Profile;
