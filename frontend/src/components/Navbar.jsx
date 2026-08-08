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
    FaBoxOpen
} from "react-icons/fa";

import { useApp } from "../context/AppContext";
import "../styles/Navbar.css";

const Navbar = () => {

    const [menuOpen, setMenuOpen] = useState(false);

    const {
        user,
        logout,
        cart
    } = useApp();

    const navigate = useNavigate();

    const cartCount = cart.reduce(
        (total, item) =>
            total + (item.quantity || 1),
        0
    );

    const handleLogout = () => {

        logout();

        setMenuOpen(false);

        navigate("/login");

    };

    const closeMenu = () => {
        setMenuOpen(false);
    };

    return (

        <nav className="navbar">

            {/* Logo */}

            <div className="logo">

                <Link
                    to="/"
                    onClick={closeMenu}
                >
                    Marketplace
                </Link>

            </div>


            {/* Search */}

            <div className="search-box">

                <FaSearch className="search-icon" />

                <input
                    type="text"
                    placeholder="Search products..."
                />

            </div>


            {/* Navigation */}

            <ul
                className={
                    menuOpen
                        ? "nav-links active"
                        : "nav-links"
                }
            >

                {/* Home */}

                <li>

                    <Link
                        to="/"
                        onClick={closeMenu}
                    >
                        Home
                    </Link>

                </li>


                {/* Dashboard */}

                {user && (

                    <li>

                        <Link
                            to="/dashboard"
                            onClick={closeMenu}
                        >
                            Dashboard
                        </Link>

                    </li>

                )}


                {/* Seller */}

                {user?.role === "seller" && (

                    <li>

                        <Link
                            to="/seller"
                            onClick={closeMenu}
                        >
                            Seller
                        </Link>

                    </li>

                )}


                {/* Admin */}

                {user?.role === "admin" && (

                    <li>

                        <Link
                            to="/admin"
                            onClick={closeMenu}
                        >
                            Admin
                        </Link>

                    </li>

                )}


                {/* Messenger */}

                {user && (

                    <li>

                        <Link
                            to="/messenger"
                            onClick={closeMenu}
                        >
                            <FaComments />
                        </Link>

                    </li>

                )}


                {/* Profile */}

                {user && (

                    <li>

                        <Link
                            to="/profile"
                            onClick={closeMenu}
                        >

                            <FaUserCircle />

                            <span className="user-name">
                                {user.name}
                            </span>

                        </Link>

                    </li>

                )}


                {/* Wishlist */}

                {user && (

                    <li>

                        <Link
                            to="/wishlist"
                            onClick={closeMenu}
                        >

                            <FaHeart />

                        </Link>

                    </li>

                )}


                {/* Orders */}

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


                {/* Cart */}

                {user && (

                    <li>

                        <Link
                            to="/cart"
                            onClick={closeMenu}
                            className="cart-link"
                        >

                            <FaShoppingCart />

                            {cartCount > 0 && (

                                <span className="cart-count">

                                    {cartCount}

                                </span>

                            )}

                        </Link>

                    </li>

                )}


                {/* Login / Register */}

                {!user && (

                    <>

                        <li>

                            <Link
                                to="/login"
                                onClick={closeMenu}
                            >
                                Login
                            </Link>

                        </li>

                        <li>

                            <Link
                                to="/register"
                                onClick={closeMenu}
                            >
                                Register
                            </Link>

                        </li>

                    </>

                )}


                {/* Logout */}

                {user && (

                    <li>

                        <button
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


            {/* Mobile Menu */}

            <button
                className="menu-btn"
                onClick={() =>
                    setMenuOpen(!menuOpen)
                }
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
