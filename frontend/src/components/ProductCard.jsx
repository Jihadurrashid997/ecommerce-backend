import React from "react";
import { FaHeart, FaShoppingCart, FaStar } from "react-icons/fa";
import "./ProductCard.css";

const ProductCard = ({ product }) => {

    const addToCart = () => {

        alert(product.name + " added to cart.");

    };

    const addToWishlist = () => {

        alert(product.name + " added to wishlist.");

    };

    return (

        <div className="product-card">

            <div className="product-image">

                <img
                    src={product.image}
                    alt={product.name}
                />

                <button
                    className="wishlist-btn"
                    onClick={addToWishlist}
                >

                    <FaHeart />

                </button>

            </div>

            <div className="product-content">

                <h3>

                    {product.name}

                </h3>

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

                <h2>

                    ৳ {product.price}

                </h2>

                <button
                    className="cart-btn"
                    onClick={addToCart}
                >

                    <FaShoppingCart />

                    Add To Cart

                </button>

            </div>

        </div>

    );

};

export default ProductCard;
