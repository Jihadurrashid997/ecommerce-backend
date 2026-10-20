import React from "react";
import { Link } from "react-router-dom";
import { FaTrash, FaMinus, FaPlus } from "react-icons/fa";
import { useCart } from "../context/CartContext";
import "../styles/Cart.css";

const Cart = () => {

    const {
        cart,
        addToCart,
        removeFromCart
    } = useCart();

    const decreaseQuantity = (product) => {

        if (product.quantity <= 1) {

            removeFromCart(product._id);

            return;

        }

        const updated = {
            ...product,
            quantity: product.quantity - 1
        };

        removeFromCart(product._id);

        for (let i = 0; i < updated.quantity; i++) {

            addToCart(updated);

        }

    };

    const total = cart.reduce(

        (sum, item) =>

            sum + item.price * item.quantity,

        0
    );
    const hasStockIssues = cart.some(
        item => Number(item.quantity) > Number(item.stock ?? 1)
    );

    return (

        <div className="cart-page">

            <h1>

                Shopping Cart

            </h1>

            {

                cart.length === 0 ?

                (

                    <div className="empty-cart">

                        <h2>

                            Your cart is empty.

                        </h2>

                        <Link

                            className="continue-btn"

                            to="/shop"

                        >

                            Continue Shopping

                        </Link>

                    </div>

                )

                :

                (

                    <>

                        <div className="cart-list">

                            {

                                cart.map(product=>(

                                    <div

                                        className="cart-item"

                                        key={product._id}

                                    >

                                        <img

                                            src={product.image}

                                            alt={product.name}

                                        />

                                        <div className="cart-info">

                                            <h3>

                                                {product.name}

                                            </h3>

                                            <p>

                                                ৳ {product.price}

                                            </p>

                                        </div>

                                        <div className="quantity-box">

                                            <button

                                                onClick={()=>

                                                decreaseQuantity(product)}

                                            >

                                                <FaMinus/>

                                            </button>

                                            <span>

                                                {product.quantity}

                                            </span>

                                            <button
                                                type="button"
                                                disabled={
                                                    Number(product.quantity) >=
                                                    Number(product.stock ?? 1)
                                                }
                                                onClick={()=>
                                                addToCart(product)}
                                            >
                                                <FaPlus/>
                                            </button>

                                        </div>
                                        {Number(product.quantity) >
                                            Number(product.stock ?? 1) && (
                                                <p className="cart-stock-warning" role="alert">
                                                    Available stock changed. Reduce the quantity before checkout.
                                                </p>
                                            )}

                                        <button

                                            className="delete-btn"

                                            onClick={()=>

                                            removeFromCart(product._id)}

                                        >

                                            <FaTrash/>

                                        </button>

                                    </div>

                                ))

                            }

                        </div>

                        <div className="cart-summary">

                            <h2>

                                Total

                            </h2>

                            <h1>

                                ৳ {total}

                            </h1>

                            {hasStockIssues && (
                                <p className="cart-stock-warning" role="alert">
                                    Update quantities to match available stock before checkout.
                                </p>
                            )}

                            <Link
                                className="checkout-btn"
                                to="/shop/checkout"
                                aria-disabled={hasStockIssues}
                                onClick={event => {
                                    if (hasStockIssues) event.preventDefault();
                                }}
                            >

                                Proceed To Checkout

                            </Link>

                        </div>

                    </>

                )

            }

        </div>

    );

};

export default Cart;
