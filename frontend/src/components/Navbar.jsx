import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaShoppingCart,
  FaHeart,
  FaComments,
  FaUserCircle,
  FaBars,
  FaTimes,
  FaSearch,
} from "react-icons/fa";

import "../styles/Navbar.css";

const Navbar = () => {

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">

      <div className="logo">
        <Link to="/">Marketplace</Link>
      </div>

      <div className="search-box">
        <FaSearch className="search-icon" />

        <input
          type="text"
          placeholder="Search products..."
        />
      </div>

      <ul className={menuOpen ? "nav-links active" : "nav-links"}>

        <li>
          <Link to="/">Home</Link>
        </li>

        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>

        <li>
          <Link to="/seller">Seller</Link>
        </li>

        <li>
          <Link to="/wishlist">
            <FaHeart />
          </Link>
        </li>

        <li>
          <Link to="/cart">
            <FaShoppingCart />
          </Link>
        </li>

        <li>
          <Link to="/messenger">
            <FaComments />
          </Link>
        </li>

        <li>
          <Link to="/profile">
            <FaUserCircle />
          </Link>
        </li>

      </ul>

      <button
        className="menu-btn"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <FaTimes /> : <FaBars />}
      </button>

    </nav>
  );
};

export default Navbar;
