import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import {
    FaShoppingCart,
    FaHeart,
    FaComments,
    FaUserCircle,
    FaBars,
    FaTimes,
    FaSearch,
    FaSignOutAlt,
    FaBoxOpen,
    FaHome,
    FaTachometerAlt,
    FaStore,
    FaUserShield
} from "react-icons/fa";

import { motion, AnimatePresence } from "framer-motion";

import { useApp } from "../context/AppContext";

import "../styles/Navbar.css";


const Navbar = () => {

    const [menuOpen, setMenuOpen] = useState(false);
    const [searchText, setSearchText] = useState("");

    const {
        user,
        logout,
        cart
    } = useApp();

    const navigate = useNavigate();
    const location = useLocation();


    // ==========================
    // CART COUNT
    // ==========================

    const cartCount =
        (cart || []).reduce(
            (total, item) =>
                total + Number(item.quantity || 1),
            0
        );


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

                    <motion.span
                        className="logo-icon jr-logo-icon"
                        whileHover={{
                            rotate: -8,
                            scale: 1.12
                        }}
                        whileTap={{
                            scale: 0.9
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 450,
                            damping: 16
                        }}
                    >
                        JR
                    </motion.span>


                    <motion.span
                        className="jr-brand-name"
                        whileHover={{
                            letterSpacing: "1px"
                        }}
                    >
                        <strong>JR</strong>
                        <span>Store</span>
                    </motion.span>

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
                        placeholder="Search products or people..."
                        aria-label="Search products or people"
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


                {/* DASHBOARD */}

                {user && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/dashboard"
                            icon={<FaTachometerAlt />}
                            label="Dashboard"
                            active={isActive("/dashboard")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                )}


                {/* SELLER */}

                {user?.role === "seller" && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/seller"
                            icon={<FaStore />}
                            label="Seller"
                            active={isActive("/seller")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                )}


                {/* ADMIN */}

                {user?.role === "admin" && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/admin"
                            icon={<FaUserShield />}
                            label="Admin"
                            active={isActive("/admin")}
                            onClick={closeMenu}
                        />

                    </motion.li>

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


                {/* WISHLIST */}

                {user && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/wishlist"
                            icon={<FaHeart />}
                            label="Wishlist"
                            active={isActive("/wishlist")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                )}


                {/* ORDERS */}

                {user && (

                    <motion.li variants={navItem}>

                        <NavItem
                            to="/orders"
                            icon={<FaBoxOpen />}
                            label="Orders"
                            active={isActive("/orders")}
                            onClick={closeMenu}
                        />

                    </motion.li>

                )}


                {/* CART */}

                {user && (

                    <motion.li variants={navItem}>

                        <Link
                            to="/cart"
                            onClick={closeMenu}
                            className={
                                isActive("/cart")
                                    ? "jr-nav-item active"
                                    : "jr-nav-item"
                            }
                        >

                            <motion.span
                                className="nav-icon"

                                whileHover={{
                                    y: -2,
                                    scale: 1.12
                                }}
                            >

                                <FaShoppingCart />

                                <AnimatePresence>

                                    {cartCount > 0 && (

                                        <motion.span
                                            className="cart-count"

                                            initial={{
                                                scale: 0,
                                                opacity: 0
                                            }}

                                            animate={{
                                                scale: 1,
                                                opacity: 1
                                            }}

                                            exit={{
                                                scale: 0,
                                                opacity: 0
                                            }}

                                            transition={{
                                                type: "spring",
                                                stiffness: 500,
                                                damping: 18
                                            }}
                                        >
                                            {cartCount}
                                        </motion.span>

                                    )}

                                </AnimatePresence>

                            </motion.span>

                            <span>
                                Cart
                            </span>

                        </Link>

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
