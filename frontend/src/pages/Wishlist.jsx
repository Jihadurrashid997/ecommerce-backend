import React from "react";
import { Link } from "react-router-dom";
import { FaTrash, FaShoppingCart } from "react-icons/fa";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";
import "../styles/Wishlist.css";

const Wishlist = () => {

    const {
        wishlist,
        removeFromWishlist
    } = useWishlist();

    const {
        addToCart
    } = useCart();

    return (

        <div className="wishlist-page">

            <h1>

                My Wishlist

            </h1>

            {

                wishlist.length===0 ?

                (

                    <div className="empty-wishlist">

                        <h2>

                            Wishlist is Empty

                        </h2>

                        <Link
                        className="continue-btn"
                        to="/">

                            Continue Shopping

                        </Link>

                    </div>

                )

                :

                (

                    <div className="wishlist-grid">

                        {

                            wishlist.map(product=>(

                                <div
                                className="wishlist-card"
                                key={product._id}>

                                    <img
                                    src={product.image}
                                    alt={product.name}
                                    />

                                    <h3>

                                        {product.name}

                                    </h3>

                                    <h2>

                                        ৳ {product.price}

                                    </h2>

                                    <div className="wishlist-buttons">

                                        <button

                                        className="cart-btn"

                                        onClick={()=>addToCart(product)}

                                        >

                                            <FaShoppingCart/>

                                            Add Cart

                                        </button>

                                        <button

                                        className="delete-btn"

                                        onClick={()=>removeFromWishlist(product._id)}

                                        >

                                            <FaTrash/>

                                        </button>

                                    </div>

                                </div>

                            ))

                        }

                    </div>

                )

            }

        </div>

    );

};

export default Wishlist;
