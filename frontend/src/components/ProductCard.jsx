import React from "react";
import "./ProductCard.css";
import { FaHeart, FaShoppingCart, FaStar } from "react-icons/fa";

const ProductCard = ({ product }) => {
  return (
    <div className="product-card">

      <div className="product-image">
        <img
          src={product?.image || "https://via.placeholder.com/300x250"}
          alt={product?.name}
        />

        <button className="wishlist-btn">
          <FaHeart />
        </button>
      </div>

      <div className="product-content">

        <h3>{product?.name}</h3>

        <p className="category">
          {product?.category}
        </p>

        <div className="rating">

          <FaStar />
          <FaStar />
          <FaStar />
          <FaStar />
          <FaStar />

        </div>

        <h2 className="price">
          ৳ {product?.price}
        </h2>

        <button className="cart-btn">

          <FaShoppingCart />

          Add To Cart

        </button>

      </div>

    </div>
  );
};

export default ProductCard;
