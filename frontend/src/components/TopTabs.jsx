import React from "react";
import { NavLink } from "react-router-dom";
import {
    FaComments,
    FaHome,
    FaPlayCircle,
    FaStore,
    FaUsers
} from "react-icons/fa";
import "../styles/Social.css";

const TABS = [
    { to: "/", label: "HOME", icon: <FaHome />, end: true },
    { to: "/reels", label: "REELS", icon: <FaPlayCircle /> },
    { to: "/communities", label: "COMMUNITIES", icon: <FaUsers /> },
    { to: "/messenger", label: "MESSENGER", icon: <FaComments /> },
    { to: "/shop", label: "SHOP", icon: <FaStore /> }
];

const TopTabs = () => (
    <nav className="top-tabs">
        {TABS.map(tab => (
            <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `top-tab ${isActive ? "active" : ""}`}
                aria-label={tab.label}
            >
                <span className="top-tab-icon" aria-hidden="true">{tab.icon}</span>
                <span className="top-tab-label">{tab.label}</span>
            </NavLink>
        ))}
    </nav>
);

export default TopTabs;
