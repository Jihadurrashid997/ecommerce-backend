import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import { useCart } from "../context/CartContext";

import "../styles/Checkout.css";

const Checkout = () => {

    const navigate = useNavigate();

    const { cartItems, clearCart } = useCart();

    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        address: "",
        city: "",
        postalCode: ""
    });

    const [paymentMethod, setPaymentMethod] =
        useState("sslcommerz");


    useEffect(() => {

        if (!cartItems || cartItems.length === 0) {
            navigate("/cart");
        }

    }, [cartItems, navigate]);


    const totalPrice = (cartItems || []).reduce(
        (total, item) =>
            total +
            Number(item.price || 0) *
            Number(item.quantity || 1),
        0
    );


    const handleChange = (e) => {

        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });

    };


    const handleSubmit = async (e) => {

        e.preventDefault();

        if (!cartItems || cartItems.length === 0) {
            alert("Your cart is empty.");
            return;
        }


        if (
            !formData.name ||
            !formData.phone ||
            !formData.address ||
            !formData.city
        ) {
            alert("Please complete your shipping information.");
            return;
        }


        try {

            setLoading(true);


            const orderItems = cartItems.map((item) => ({
                product: item._id || item.id,
                quantity: Number(item.quantity || 1)
            }));


            /*
             * First create the order.
             */

            const orderResponse = await api.post(
                "/orders",
                {
                    items: orderItems,

                    shippingAddress: {
                        name: formData.name,
                        phone: formData.phone,
                        address: formData.address,
                        city: formData.city,
                        postalCode: formData.postalCode
                    },

                    paymentMethod
                }
            );


            const order = orderResponse.data.order;


            /*
             * SSLCommerz payment
             */

            if (paymentMethod === "sslcommerz") {

                const paymentResponse =
                    await api.post(
                        "/payment/initiate",
                        {
                            orderId: order._id
                        }
                    );


                const paymentUrl =
                    paymentResponse.data?.url ||
                    paymentResponse.data?.paymentUrl ||
                    paymentResponse.data?.GatewayPageURL;


                if (!paymentUrl) {

                    throw new Error(
                        "Payment gateway URL was not returned."
                    );

                }


                /*
                 * Clear cart before redirecting
                 */

                clearCart();


                window.location.href = paymentUrl;

                return;
            }


            /*
             * Cash on Delivery
             */

            clearCart();

            alert(
                "Order placed successfully!"
            );

            navigate("/orders");


        } catch (err) {

            console.error(
                "Checkout error:",
                err
            );

            alert(
                err.response?.data?.message ||
                err.message ||
                "Checkout failed. Please try again."
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="checkout-page">

            <div className="checkout-container">


                {/* ======================
                    SHIPPING INFORMATION
                ======================= */}

                <div className="checkout-form">

                    <h1>
                        Checkout
                    </h1>

                    <h2>
                        Shipping Information
                    </h2>


                    <form onSubmit={handleSubmit}>

                        <input
                            type="text"
                            name="name"
                            placeholder="Full Name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />


                        <input
                            type="tel"
                            name="phone"
                            placeholder="Phone Number"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                        />


                        <textarea
                            name="address"
                            placeholder="Full Address"
                            value={formData.address}
                            onChange={handleChange}
                            required
                        />


                        <input
                            type="text"
                            name="city"
                            placeholder="City"
                            value={formData.city}
                            onChange={handleChange}
                            required
                        />


                        <input
                            type="text"
                            name="postalCode"
                            placeholder="Postal Code"
                            value={formData.postalCode}
                            onChange={handleChange}
                        />


                        {/* ======================
                            PAYMENT METHOD
                        ======================= */}

                        <h2>
                            Payment Method
                        </h2>


                        <div className="payment-methods">

                            <label>

                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="sslcommerz"
                                    checked={
                                        paymentMethod ===
                                        "sslcommerz"
                                    }
                                    onChange={(e) =>
                                        setPaymentMethod(
                                            e.target.value
                                        )
                                    }
                                />

                                Pay Online
                                (SSLCommerz)

                            </label>


                            <label>

                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="cod"
                                    checked={
                                        paymentMethod === "cod"
                                    }
                                    onChange={(e) =>
                                        setPaymentMethod(
                                            e.target.value
                                        )
                                    }
                                />

                                Cash on Delivery

                            </label>

                        </div>


                        <button
                            type="submit"
                            className="checkout-btn"
                            disabled={loading}
                        >

                            {loading
                                ? "Processing..."
                                : paymentMethod ===
                                  "sslcommerz"
                                    ? "Pay Now"
                                    : "Place Order"
                            }

                        </button>

                    </form>

                </div>


                {/* ======================
                    ORDER SUMMARY
                ======================= */}

                <div className="order-summary">

                    <h2>
                        Order Summary
                    </h2>


                    {(cartItems || []).map(
                        (item, index) => (

                            <div
                                className="summary-item"
                                key={
                                    item._id ||
                                    item.id ||
                                    index
                                }
                            >

                                <div>

                                    <strong>
                                        {item.name}
                                    </strong>

                                    <p>
                                        Quantity:{" "}
                                        {item.quantity || 1}
                                    </p>

                                </div>


                                <span>

                                    ৳
                                    {(
                                        Number(
                                            item.price || 0
                                        ) *
                                        Number(
                                            item.quantity || 1
                                        )
                                    ).toFixed(2)}

                                </span>

                            </div>

                        )
                    )}


                    <div className="summary-total">

                        <strong>
                            Total
                        </strong>

                        <strong>
                            ৳{totalPrice.toFixed(2)}
                        </strong>

                    </div>

                </div>

            </div>

        </div>

    );

};

export default Checkout;
