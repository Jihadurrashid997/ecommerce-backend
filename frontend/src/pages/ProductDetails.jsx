import React from "react";
import { useParams } from "react-router-dom";
import "../styles/ProductDetails.css";

const ProductDetails = () => {

  const { id } = useParams();

  return (
    <div className="product-details">

      <div className="product-left">
        <img
          src="https://via.placeholder.com/500"
          alt="product"
        />
      </div>

      <div className="product-right">

        <h1>Sample Product #{id}</h1>

        <h2>$199</h2>

        <p>
          This is a professional marketplace product page.
          Product description will come from backend API.
        </p>

        <button className="buy-btn">
          Buy Now
        </button>

        <button className="cart-btn">
          Add To Cart
        </button>

        <button className="wish-btn">
          Add To Wishlist
        </button>

      </div>

    </div>
  );

};

export default ProductDetails;
