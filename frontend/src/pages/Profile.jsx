import React from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import { useApp } from "../context/AppContext";
import "../styles/Profile.css";

const Profile = () => {

    const { user, logout } = useApp();
    const navigate = useNavigate();

    if (!user) {
        navigate("/login");
        return null;
    }

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="profile-page">

            <div className="profile-card">

                <FaUserCircle className="profile-icon" />

                <h1>{user.name}</h1>

                <div className="profile-info">

                    <p>
                        <strong>Email:</strong>{" "}
                        {user.email}
                    </p>

                    <p>
                        <strong>Role:</strong>{" "}
                        {user.role || "customer"}
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
    );
};

export default Profile;
