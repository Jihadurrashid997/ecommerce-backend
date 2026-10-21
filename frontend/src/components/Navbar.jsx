import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import {
    FaComments,
    FaUserCircle,
    FaBars,
    FaTimes,
    FaSearch,
    FaSignOutAlt,
    FaHome,
    FaUserShield,
    FaBell,
    FaCog,
    FaEllipsisH,
    FaCheck,
    FaTrash,
    FaBookmark
} from "react-icons/fa";

import { motion, AnimatePresence } from "framer-motion";

import { useApp } from "../context/AppContext";
import api from "../services/api";
import EtopLogo from "./EtopLogo";
import "../styles/EtopLogo.css";

import "../styles/Navbar.css";


const Navbar = () => {

    const [menuOpen, setMenuOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [notificationError, setNotificationError] = useState("");
    const notificationRef = useRef(null);
    const settingsRef = useRef(null);

    const { user, logout } = useApp();
    const navigate = useNavigate();
    const location = useLocation();

    const loadNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([]);
            setUnreadNotificationCount(0);
            return;
        }
        try {
            const response = await api.get("/notifications", { params: { limit: 20 } });
            setNotifications(response.data.notifications || []);
            setUnreadNotificationCount(response.data.unreadCount || 0);
            setNotificationError("");
        } catch (error) {
            console.error("LOAD PLATFORM NOTIFICATIONS ERROR:", error);
            setNotificationError(error.response?.data?.message || "Could not load notifications.");
        }
    }, [user]);

    useEffect(() => {
        loadNotifications();
        if (!user) return undefined;
        const refresh = () => loadNotifications();
        const interval = window.setInterval(refresh, 30000);
        window.addEventListener("focus", refresh);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", refresh);
        };
    }, [loadNotifications, user]);

    useEffect(() => {
        const closeNotifications = event => {
            if (!notificationRef.current?.contains(event.target)) {
                setNotificationsOpen(false);
            }
            if (!settingsRef.current?.contains(event.target)) {
                setSettingsOpen(false);
            }
        };

        const closeOnEscape = event => {
            if (event.key === "Escape") {
                setNotificationsOpen(false);
                setSettingsOpen(false);
            }
        };

        document.addEventListener("mousedown", closeNotifications);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("mousedown", closeNotifications);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, []);


    // ==========================
    // CLOSE MENU
    // ==========================

    const closeMenu = () => {
        setMenuOpen(false);
    };


    // ==========================
    // SEARCH
    // ==========================

    const handleSearch = (e) => {

        e.preventDefault();

        const query = searchText.trim();

        if (!query) {
            return;
        }

        navigate(
            `/search?q=${encodeURIComponent(query)}`
        );

        closeMenu();
    };


    // ==========================
    // CLEAR SEARCH
    // ==========================

    const handleClearSearch = () => {

        setSearchText("");

        if (user) {
            navigate("/");
        }

        closeMenu();
    };


    // ==========================
    // LOGOUT
    // ==========================

    const handleLogout = () => {

        logout();

        setSearchText("");
        closeMenu();

        navigate("/login");
    };

    const markAllNotificationsRead = async () => {
        try {
            await api.patch("/notifications/read-all");
            const readAt = new Date().toISOString();
            setNotifications(previous => previous.map(item => ({ ...item, readAt })));
            setUnreadNotificationCount(0);
        } catch (error) {
            console.error("MARK ALL PLATFORM NOTIFICATIONS READ ERROR:", error);
            setNotificationError(error.response?.data?.message || "Could not update notifications.");
        }
    };

    const clearAllNotifications = async () => {
        try {
            await api.delete("/notifications");
            setNotifications([]);
            setUnreadNotificationCount(0);
            setNotificationError("");
        } catch (error) {
            console.error("CLEAR PLATFORM NOTIFICATIONS ERROR:", error);
            setNotificationError(error.response?.data?.message || "Could not clear notifications.");
        }
    };

    const openNotification = async notification => {
        if (!notification.readAt) {
            try {
                await api.patch(`/notifications/${notification._id}/read`);
                setNotifications(previous => previous.map(item =>
                    item._id === notification._id
                        ? { ...item, readAt: new Date().toISOString() }
                        : item
                ));
                setUnreadNotificationCount(count => Math.max(0, count - 1));
            } catch (error) {
                console.error("MARK PLATFORM NOTIFICATION READ ERROR:", error);
                setNotificationError(error.response?.data?.message || "Could not update this notification.");
                return;
            }
        }
        setNotificationsOpen(false);
        if (notification.link) navigate(notification.link);
    };


    // ==========================
    // ACTIVE ROUTE
    // ==========================

    const isActive = (path) => {

        if (path === "/") {
            return location.pathname === "/";
        }

        return location.pathname.startsWith(path);
    };


    // ==========================
    // PREMIUM ANIMATION
    // ==========================

    const navContainer = {

        hidden: {
            opacity: 0,
            y: -30
        },

        visible: {

            opacity: 1,
            y: 0,

            transition: {
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                staggerChildren: 0.06
            }
        }
    };


    const navItem = {

        hidden: {
            opacity: 0,
            y: -15,
            scale: 0.96
        },

        visible: {

            opacity: 1,
            y: 0,
            scale: 1,

            transition: {
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1]
            }
        }
    };


    return (

        <motion.nav
            className="navbar jr-navbar"
            initial="hidden"
            animate="visible"
            variants={navContainer}
        >

            {/* ==========================
                PREMIUM GLOW
            ========================== */}

            <motion.div
                className="navbar-glow navbar-glow-one"
                animate={{
                    x: [0, 40, 0],
                    y: [0, 20, 0],
                    opacity: [0.35, 0.6, 0.35]
                }}
                transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />

            <motion.div
                className="navbar-glow navbar-glow-two"
                animate={{
                    x: [0, -35, 0],
                    y: [0, -15, 0],
                    opacity: [0.25, 0.5, 0.25]
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />


            {/* ==========================
                LOGO
            ========================== */}

            <motion.div
                className="logo jr-logo"
                variants={navItem}
            >

                <Link
                    to="/"
                    onClick={closeMenu}
                    className="jr-logo-link"
                >

                    <EtopLogo size="sm" light />

                </Link>

            </motion.div>


            {/* ==========================
                SEARCH
            ========================== */}

            {user && (

                <motion.form
                    className="search-box jr-search"
                    onSubmit={handleSearch}
                    variants={navItem}
                    whileFocus={{
                        scale: 1.015
                    }}
                >

                    <motion.div
                        className="search-icon-wrapper"
                        animate={{
                            rotate: searchText ? 8 : 0,
                            scale: searchText ? 1.08 : 1
                        }}
                    >
                        <FaSearch className="search-icon" />
                    </motion.div>


                    <input
                        type="search"
                        value={searchText}
                        onChange={(e) =>
                            setSearchText(e.target.value)
                        }
                        placeholder="Search people..."
                        aria-label="Search people"
                    />


                    <AnimatePresence>

                        {searchText && (

                            <motion.button
                                type="button"
                                className="clear-search"
                                onClick={handleClearSearch}

                                initial={{
                                    opacity: 0,
                                    scale: 0.5
                                }}

                                animate={{
                                    opacity: 1,
                                    scale: 1
                                }}

                                exit={{
                                    opacity: 0,
                                    scale: 0.5
                                }}

                                whileHover={{
                                    rotate: 90,
                                    scale: 1.15
                                }}
                            >
                                <FaTimes />
                            </motion.button>

                        )}

                    </AnimatePresence>


                    <motion.button
                        type="submit"
                        className="search-btn"

                        whileHover={{
                            scale: 1.04,
                            y: -1
                        }}

                        whileTap={{
                            scale: 0.94
                        }}
                    >

                        <FaSearch />

                        <span>
                            Search
                        </span>

                    </motion.button>

                </motion.form>

            )}


            {/* ==========================
                NAVIGATION
            ========================== */}

            <motion.ul
                className={
                    menuOpen
                        ? "nav-links active jr-nav-links"
                        : "nav-links jr-nav-links"
                }
                variants={navContainer}
            >

                {/* HOME */}

                {user && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/"
                            icon={<FaHome />}
                            label="Home"
                            active={isActive("/")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                )}


                {/* ADMIN */}

                {user?.role === "admin" && (
                    <>

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/admin"
                            icon={<FaUserShield />}
                            label="Admin"
                            active={isActive("/admin")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/admin/control"
                            icon={<FaUserShield />}
                            label="Control"
                            active={isActive("/admin/control")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                    </>

                )}


                {/* MESSENGER */}

                {user && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/messenger"
                            icon={<FaComments />}
                            label="Messages"
                            active={isActive("/messenger")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                )}


                {/* PROFILE */}

                {user && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/profile"
                            icon={<FaUserCircle />}
                            label={user.name || "Profile"}
                            active={isActive("/profile")}
                            onClick={closeMenu}
                            profile
                        />

                    </motion.li>

                )}



                {/* LOGIN */}

                {!user && (

                    <motion.li variants={navItem}>

                        <motion.div
                            whileHover={{
                                y: -2,
                                scale: 1.02
                            }}
                            whileTap={{
                                scale: 0.96
                            }}
                        >

                            <Link
                                to="/login"
                                onClick={closeMenu}
                                className="login-link jr-login"
                            >
                                Login
                            </Link>

                        </motion.div>

                    </motion.li>

                )}


                {/* REGISTER */}

                {!user && (

                    <motion.li variants={navItem}>

                        <motion.div
                            whileHover={{
                                y: -2,
                                scale: 1.02
                            }}
                            whileTap={{
                                scale: 0.96
                            }}
                        >

                            <Link
                                to="/register"
                                onClick={closeMenu}
                                className="register-link jr-register"
                            >
                                Register
                            </Link>

                        </motion.div>

                    </motion.li>

                )}


                {/* LOGOUT */}

                {user && (

                    <motion.li variants={navItem}>

                        <motion.button
                            type="button"
                            className="logout-btn jr-logout"
                            onClick={handleLogout}

                            whileHover={{
                                y: -2,
                                scale: 1.03
                            }}

                            whileTap={{
                                scale: 0.95
                            }}
                        >

                            <FaSignOutAlt />

                            <span>
                                Logout
                            </span>

                        </motion.button>

                    </motion.li>

                )}

            </motion.ul>


            {/* ==========================
                MOBILE MENU
            ========================== */}

            <motion.button
                type="button"
                className="menu-btn jr-menu-btn"

                onClick={() =>
                    setMenuOpen(!menuOpen)
                }

                aria-label="Toggle menu"

                whileTap={{
                    scale: 0.85,
                    rotate: 5
                }}
            >

                <AnimatePresence mode="wait">

                    {menuOpen ? (

                        <motion.span
                            key="close"
                            initial={{
                                rotate: -90,
                                opacity: 0
                            }}
                            animate={{
                                rotate: 0,
                                opacity: 1
                            }}
                            exit={{
                                rotate: 90,
                                opacity: 0
                            }}
                        >
                            <FaTimes />
                        </motion.span>

                    ) : (

                        <motion.span
                            key="menu"
                            initial={{
                                rotate: 90,
                                opacity: 0
                            }}
                            animate={{
                                rotate: 0,
                                opacity: 1
                            }}
                            exit={{
                                rotate: -90,
                                opacity: 0
                            }}
                        >
                            <FaBars />
                        </motion.span>

                    )}

                </AnimatePresence>

            </motion.button>

            {user && (
                <div className="jr-header-actions">
                    <Link
                        to="/profile"
                        className={`jr-header-action jr-profile-action${isActive("/profile") ? " is-active" : ""}`}
                        aria-label="Your profile"
                        title="Profile"
                        onClick={closeMenu}
                    >
                        <FaUserCircle />
                    </Link>

                    <div className="jr-notification-wrap" ref={notificationRef}>
                        <button
                            type="button"
                            className={`jr-header-action${notificationsOpen ? " is-active" : ""}`}
                            aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ""}`}
                            aria-expanded={notificationsOpen}
                            aria-controls="jr-notifications-panel"
                            title="Notifications"
                            onClick={() => setNotificationsOpen(open => !open)}
                        >
                            <FaBell />
                            {unreadNotificationCount > 0 && (
                                <span className="jr-notification-count">
                                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                                </span>
                            )}
                        </button>

                        {notificationsOpen && (
                            <section
                                className="jr-notifications-panel"
                                id="jr-notifications-panel"
                                aria-label="Notifications"
                            >
                                <div className="jr-notifications-heading">
                                    <div>
                                        <h2>Notifications</h2>
                                        <span>
                                            {unreadNotificationCount
                                                ? `${unreadNotificationCount} unread`
                                                : "You're all caught up"}
                                        </span>
                                    </div>
                                    <div className="jr-notification-tools">
                                        {unreadNotificationCount > 0 && (
                                            <button
                                                type="button"
                                                title="Mark all as read"
                                                aria-label="Mark all notifications as read"
                                                onClick={() =>
                                                    markAllNotificationsRead()
                                                }
                                            >
                                                <FaCheck />
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button
                                                type="button"
                                                title="Clear notifications"
                                                aria-label="Clear all notifications"
                                                onClick={clearAllNotifications}
                                            >
                                                <FaTrash />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {notificationError && (
                                    <p className="jr-notifications-error" role="alert">{notificationError}</p>
                                )}
                                {notifications.length ? (
                                    <div className="jr-notification-list">
                                        {notifications.slice(0, 8).map(notification => (
                                            <button
                                                type="button"
                                                key={notification._id}
                                                className={`jr-notification-item${notification.readAt ? "" : " is-unread"}`}
                                                onClick={() => openNotification(notification)}
                                            >
                                                <span className={`jr-notification-dot type-${notification.type || "info"}`} />
                                                <span className="jr-notification-content">
                                                    <strong>{notification.title}</strong>
                                                    <span>{notification.actor?.name
                                                        ? `${notification.actor.name}: ${notification.message}`
                                                        : notification.message}</span>
                                                    <time dateTime={notification.createdAt}>
                                                        {notification.createdAt
                                                            ? new Date(notification.createdAt).toLocaleString()
                                                            : ""}
                                                    </time>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="jr-notifications-empty">
                                        <FaBell />
                                        <p>No notifications yet</p>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <div className="jr-settings-wrap" ref={settingsRef}>
                        <button
                            type="button"
                            className={`jr-header-action jr-settings-action${settingsOpen ? " is-active" : ""}`}
                            aria-label="Open settings menu"
                            aria-expanded={settingsOpen}
                            aria-controls="jr-settings-menu"
                            title="More options"
                            onClick={() => {
                                setSettingsOpen(open => !open);
                                setNotificationsOpen(false);
                            }}
                        >
                            <FaEllipsisH />
                        </button>

                        {settingsOpen && (
                            <div className="jr-settings-menu" id="jr-settings-menu">
                                <Link
                                    to="/settings"
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        closeMenu();
                                    }}
                                >
                                    <FaCog />
                                    <span>Settings</span>
                                </Link>
                                <Link
                                    to="/saved"
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        closeMenu();
                                    }}
                                >
                                    <FaBookmark />
                                    <span>Saved posts</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </motion.nav>

    );
};


/* =========================================================
   NAV ITEM
========================================================= */

const NavItem = ({
    to,
    icon,
    label,
    active,
    onClick,
    profile
}) => {

    return (

        <Link
            to={to}
            onClick={onClick}
            className={
                active
                    ? "jr-nav-item active"
                    : "jr-nav-item"
            }
        >

            <motion.span
                className={
                    profile
                        ? "nav-icon profile-icon"
                        : "nav-icon"
                }

                whileHover={{
                    y: -2,
                    scale: 1.12
                }}

                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 15
                }}
            >

                {icon}

            </motion.span>


            <span className="nav-label">
                {label}
            </span>


            {active && (

                <motion.span
                    className="active-indicator"
                    layoutId="navbar-active"

                    transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35
                    }}
                />

            )}

        </Link>
    );
};


export default Navbar;
