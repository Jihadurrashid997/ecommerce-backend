import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/Social.css";

const TABS = [
    { to: "/", label: "HOME", end: true },
    { to: "/reels", label: "REELS" },
    { to: "/messenger", label: "MESSENGER" },
    { to: "/shop", label: "SHOP" },
    { to: "/profile", label: "PROFILE" }
];

const TopTabs = () => (
    <nav className="top-tabs">
        {TABS.map(tab => (
            <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `top-tab ${isActive ? "active" : ""}`}
            >
                {tab.label}
            </NavLink>
        ))}
    </nav>
);

export default TopTabs;
