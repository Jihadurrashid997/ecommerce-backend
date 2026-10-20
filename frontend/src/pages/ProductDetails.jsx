import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { getUploadUrl } from "../services/api";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import "../styles/ProductDetails.css";

const ProductDetails = () => {

    const { id } = useParams();
    const navigate = useNavigate();
    const { cart, addToCart } = useCart();
    const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();

    const [product, setProduct] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");

        api.get(`/products/${id}`)
            .then(response => {
                if (!cancelled) setProduct(response.data);
            })
            .catch(requestError => {
                if (cancelled) return;
                console.error("Could not load product details:", requestError);
                setProduct(null);
                setError(
                    requestError.response?.data?.message ||
                    "Could not load this product."
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    if(loading){

        return(

            <div className="loader"></div>

        );

    }

    if(!product){

        return(

            <div>
                <h2 style={{textAlign:"center"}}>

                    Product Not Found

                </h2>
                {error && <p role="alert">{error}</p>}
            </div>

        );

    }

    const productId = String(product._id || product.id || "");
    const stock = Number(product.stock ?? 1);
    const cartQuantity = cart.find(
        item => String(item._id || item.id) === productId
    )?.quantity || 0;
    const cartLimitReached = cartQuantity >= stock;
    const isWishlisted = wishlist.some(
        item => String(item._id || item.id) === productId
    );
    const addProductToCart = () => {
        if (stock > 0 && !cartLimitReached) {
            addToCart(product);
        }
    };

    return(

        <div className="product-details">

            <div className="product-left">

                <img

                src={getUploadUrl(product.image)}

                alt={product.name}

                />

            </div>

            <div className="product-right">

                <h1>

                    {product.name}

                </h1>

                <h2>

                    ৳ {product.price}

                </h2>

                <p>

                    {product.description}

                </p>

                <p>{stock > 0 ? `${stock} in stock` : "Sold out"}</p>

                <button
                    className="buy-btn"
                    disabled={stock <= 0}
                    onClick={() => {
                        if (cartQuantity === 0) addToCart(product);
                        navigate("/shop/checkout");
                    }}
                >

                    {stock <= 0 ? "Sold out" : "Buy Now"}

                </button>

                <button
                    className="cart-btn"
                    disabled={stock <= 0 || cartLimitReached}
                    onClick={addProductToCart}
                >

                    {stock <= 0
                        ? "Sold out"
                        : cartLimitReached
                            ? "Stock limit reached"
                            : "Add To Cart"}

                </button>

                <button
                    className="wish-btn"
                    onClick={() => isWishlisted
                        ? removeFromWishlist(productId)
                        : addToWishlist(product)}
                >

                    {isWishlisted ? "Remove From Wishlist" : "Add To Wishlist"}

                </button>

            </div>

        </div>

    );

};

export default ProductDetails;
