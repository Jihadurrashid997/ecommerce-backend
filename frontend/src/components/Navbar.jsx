import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
            navigate("/");
            return;
        }

        // SearchResults.jsx uses ?q=
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

        navigate("/");

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


    return (

        <nav className="navbar">


            {/* ==========================
                LOGO
            =========================== */}

            <div className="logo">

                <Link
                    to="/"
                    onClick={closeMenu}
                >

                    <span className="logo-icon">
                        M
                    </span>

                    <span>
                        Marketplace
                    </span>

                </Link>

            </div>


            {/* ==========================
                SEARCH
            =========================== */}

            <form
                className="search-box"
                onSubmit={handleSearch}
            >

                <FaSearch className="search-icon" />

                <input
                    type="search"
                    value={searchText}
                    onChange={(e) =>
                        setSearchText(e.target.value)
                    }
                    placeholder="Search products or people..."
                    aria-label="Search products or people"
                />

                {searchText && (

                    <button
                        type="button"
                        className="clear-search"
                        onClick={handleClearSearch}
                        aria-label="Clear search"
                    >
                        <FaTimes />
                    </button>

                )}

                <button
                    type="submit"
                    className="search-btn"
                >
                    Search
                </button>

            </form>


            {/* ==========================
                NAVIGATION
            =========================== */}

            <ul
                className={
                    menuOpen
                        ? "nav-links active"
                        : "nav-links"
                }
            >


                {/* HOME */}

                <li>

                    <Link
                        to="/"
                        onClick={closeMenu}
                    >

                        <FaHome />

                        <span>
                            Home
                        </span>

                    </Link>

                </li>


                {/* DASHBOARD */}

                {user && (

                    <li>

                        <Link
                            to="/dashboard"
                            onClick={closeMenu}
                        >

                            <FaTachometerAlt />

                            <span>
                                Dashboard
                            </span>

                        </Link>

                    </li>

                )}


                {/* SELLER */}

                {user?.role === "seller" && (

                    <li>

                        <Link
                            to="/seller"
                            onClick={closeMenu}
                        >

                            <FaStore />

                            <span>
                                Seller
                            </span>

                        </Link>

                    </li>

                )}


                {/* ADMIN */}

                {user?.role === "admin" && (

                    <li>

                        <Link
                            to="/admin"
                            onClick={closeMenu}
                        >

                            <FaUserShield />

                            <span>
                                Admin
                            </span>

                        </Link>

                    </li>

                )}


                {/* MESSENGER */}

                {user && (

                    <li>

                        <Link
                            to="/messenger"
                            onClick={closeMenu}
                            title="Messenger"
                        >

                            <FaComments />

                            <span>
                                Messages
                            </span>

                        </Link>

                    </li>

                )}


                {/* PROFILE */}

                {user && (

                    <li>

                        <Link
                            to="/profile"
                            onClick={closeMenu}
                            className="profile-link"
                        >

                            <FaUserCircle />

                            <span className="user-name">

                                {user.name || "Profile"}

                            </span>

                        </Link>

                    </li>

                )}


                {/* WISHLIST */}

                {user && (

                    <li>

                        <Link
                            to="/wishlist"
                            onClick={closeMenu}
                            title="Wishlist"
                        >

                            <FaHeart />

                            <span>
                                Wishlist
                            </span>

                        </Link>

                    </li>

                )}


                {/* ORDERS */}

                {user && (

                    <li>

                        <Link
                            to="/orders"
                            onClick={closeMenu}
                        >

                            <FaBoxOpen />

                            <span>
                                Orders
                            </span>

                        </Link>

                    </li>

                )}


                {/* CART */}

                {user && (

                    <li>

                        <Link
                            to="/cart"
                            onClick={closeMenu}
                            className="cart-link"
                            title="Cart"
                        >

                            <FaShoppingCart />

                            <span>
                                Cart
                            </span>

                            {cartCount > 0 && (

                                <span className="cart-count">
                                    {cartCount}
                                </span>

                            )}

                        </Link>

                    </li>

                )}


                {/* LOGIN */}

                {!user && (

                    <li>

                        <Link
                            to="/login"
                            onClick={closeMenu}
                            className="login-link"
                        >
                            Login
                        </Link>

                    </li>

                )}


                {/* REGISTER */}

                {!user && (

                    <li>

                        <Link
                            to="/register"
                            onClick={closeMenu}
                            className="register-link"
                        >
                            Register
                        </Link>

                    </li>

                )}


                {/* LOGOUT */}

                {user && (

                    <li>

                        <button
                            type="button"
                            className="logout-btn"
                            onClick={handleLogout}
                        >

                            <FaSignOutAlt />

                            <span>
                                Logout
                            </span>

                        </button>

                    </li>

                )}

            </ul>


            {/* ==========================
                MOBILE MENU
            =========================== */}

            <button
                type="button"
                className="menu-btn"
                onClick={() =>
                    setMenuOpen(!menuOpen)
                }
                aria-label="Toggle menu"
            >

                {menuOpen
                    ? <FaTimes />
                    : <FaBars />
                }

            </button>

        </nav>

    );

};


export default Navbar;
