import React from "react";
import { Link } from "react-router-dom";
import { FaHeart, FaShoppingCart, FaStar } from "react-icons/fa";
import { useCart } from "../context/CartContext";
import "../styles/ProductCard.css";

const ProductCard = ({ product }) => {

  const { addToCart } = useCart();

  const addToWishlist = () => {
    alert(product.name + " added to wishlist.");
  };

  return (

    <div className="product-card">

      <Link
        to={`/product/${product._id || product.id}`}
        className="product-link"
      >

        <div className="product-image">

          <img
            src={product.image}
            alt={product.name}
          />

        </div>

        <div className="product-content">

          <h3>{product.name}</h3>

          <p className="category">
            {product.category}
          </p>

          <div className="rating">
            <FaStar />
            <FaStar />
            <FaStar />
            <FaStar />
            <FaStar />
          </div>

          <h2>৳ {product.price}</h2>

        </div>

      </Link>

      <div className="product-actions">

        <button
          className="wishlist-btn"
          onClick={addToWishlist}
        >
          <FaHeart />
        </button>

        <button
          className="cart-btn"
          onClick={() => addToCart(product)}
        >
          <FaShoppingCart />
          <span style={{ marginLeft: "8px" }}>
            Add To Cart
          </span>
        </button>

      </div>

    </div>

  );

};

export default ProductCard;
