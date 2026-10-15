import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaHeart, FaRegHeart, FaShoppingCart, FaImage, FaArrowRight, FaCheck } from "react-icons/fa";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { getUploadUrl } from "../services/api";
import "../styles/ProductCard.css";

const ProductCard = ({ product }) => {

  const { addToCart } = useCart();
  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const productId = String(product._id || product.id || "");
  const isWishlisted = wishlist.some(item => String(item._id || item.id) === productId);
  const inStock = Number(product.stock ?? 1) > 0;
  const [added, setAdded] = useState(false);
  const addedTimer = useRef(null);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const handleAddToCart = () => {
    addToCart(product);
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1600);
  };

  const imageUrl = getUploadUrl(product.image);

  return (

    <article className="product-card shop-product-card">

      <Link
        to={`/shop/product/${product._id || product.id}`}
        className="product-link"
      >

        <div className="product-image shop-product-image">

          {imageUrl && (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              onError={event => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <span className="shop-product-fallback"><FaImage /></span>
          {product.category && <span className="shop-product-category">{product.category}</span>}
          <span className={`shop-stock-badge ${inStock ? "" : "out-of-stock"}`}>
            {inStock ? "Available" : "Sold out"}
          </span>

        </div>

        <div className="product-content">

          <span className="shop-product-maker">
            Private seller
          </span>
          <h3>{product.name}</h3>
          {product.description && <p className="shop-product-description">{product.description}</p>}
          <div className="shop-product-price-row">
            <h2>৳ {Number(product.price || 0).toLocaleString("en-BD")}</h2>
            {inStock && Number(product.stock) <= 5 && Number(product.stock) > 0 && (
              <span className="shop-stock-count">Only {product.stock} left</span>
            )}
          </div>

        </div>

      </Link>

      <div className="product-actions">

        <button
          className={`wishlist-btn shop-wishlist-btn ${isWishlisted ? "is-saved" : ""}`}
          type="button"
          onClick={() => isWishlisted ? removeFromWishlist(product._id || product.id) : addToWishlist(product)}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={isWishlisted}
        >
          {isWishlisted ? <FaHeart /> : <FaRegHeart />}
        </button>

        <button
          className="cart-btn"
          type="button"
          disabled={!inStock}
          onClick={handleAddToCart}
        >
          {added ? <FaCheck /> : <FaShoppingCart />}
          <span>
            {!inStock ? "Sold out" : added ? "Added to bag" : "Add to bag"}
          </span>
          {inStock && !added && <FaArrowRight className="shop-cart-arrow" />}
        </button>

      </div>

    </article>

  );

};

export default ProductCard;
