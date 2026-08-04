import React from "react";
import "./Navbar.css";
import {
  FaSearch,
  FaBell,
  FaShoppingCart,
  FaComments,
  FaUserCircle
} from "react-icons/fa";

function Navbar() {
  return (
    <nav className="navbar">

      <div className="logo">
        Market<span>Place</span>
      </div>

      <div className="search-box">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search products..."
        />
      </div>

      <div className="nav-links">

        <a href="/">Home</a>

        <a href="/products">Products</a>

        <a href="/seller">Seller</a>

        <a href="/orders">Orders</a>

      </div>

      <div className="nav-right">

        <div className="nav-icon">
          <FaComments />
        </div>

        <div className="nav-icon">
          <FaBell />
        </div>

        <div className="nav-icon">
          <FaShoppingCart />
        </div>

        <div className="profile">

          <FaUserCircle className="profile-image" />

          <span className="profile-name">
            My Account
          </span>

        </div>

      </div>

    </nav>
  );
}

export default Navbar;
