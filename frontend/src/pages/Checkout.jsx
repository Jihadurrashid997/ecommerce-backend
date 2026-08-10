import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import { useCart } from "../context/CartContext";

import "../styles/Checkout.css";

const Checkout = () => {

    const navigate = useNavigate();

    const { cartItems } = useCart();

    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: ""
    });


    const totalAmount = (cartItems || []).reduce(
        (total, item) =>
            total +
            Number(item.price || 0) *
            Number(item.quantity || 1),
        0
    );


    useEffect(() => {

        if (!cartItems || cartItems.length === 0) {
            navigate("/cart");
        }

    }, [cartItems, navigate]);


    const handleChange = (e) => {

        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });

    };


    const handlePayment = async (e) => {

        e.preventDefault();


        if (
            !formData.name ||
            !formData.email ||
            !formData.phone ||
            !formData.address
        ) {

            alert("Please fill in all information.");

            return;

        }


        if (!cartItems || cartItems.length === 0) {

            alert("Your cart is empty.");

            navigate("/cart");

            return;

        }


        if (totalAmount <= 0) {

            alert("Invalid order amount.");

            return;

        }


        try {

            setLoading(true);


            const response = await api.post(
                "/payment/sslcommerz",
                {
                    totalAmount,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address
                }
            );


            const gatewayUrl =
                response.data?.gateway;


            if (!gatewayUrl) {

                throw new Error(
                    "Payment gateway URL was not returned."
                );

            }


            // Redirect to SSLCommerz

            window.location.href = gatewayUrl;


        } catch (err) {

            console.error(
                "Payment initialization error:",
                err
            );


            alert(
                err.response?.data?.message ||
                err.message ||
                "Payment initialization failed."
            );


        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="checkout-page">

            <div className="checkout-container">


                {/* CHECKOUT FORM */}

                <div className="checkout-form">

                    <h1>
                        Checkout
                    </h1>


                    <h2>
                        Customer Information
                    </h2>


                    <form onSubmit={handlePayment}>

                        <input
                            type="text"
                            name="name"
                            placeholder="Full Name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />


                        <input
                            type="email"
                            name="email"
                            placeholder="Email Address"
                            value={formData.email}
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


                        <h2>
                            Payment Method
                        </h2>


                        <div className="payment-selected">

                            <strong>
                                SSLCommerz
                            </strong>

                            <small>
                                Secure Online Payment
                            </small>

                        </div>


                        <button
                            type="submit"
                            className="checkout-btn"
                            disabled={loading}
                        >

                            {loading
                                ? "Redirecting to Payment..."
                                : "Pay Now"
                            }

                        </button>

                    </form>

                </div>


                {/* ORDER SUMMARY */}

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
                                        Number(item.price || 0) *
                                        Number(item.quantity || 1)
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
                            ৳{totalAmount.toFixed(2)}
                        </strong>

                    </div>

                </div>

            </div>

        </div>

    );

};


export default Checkout;
