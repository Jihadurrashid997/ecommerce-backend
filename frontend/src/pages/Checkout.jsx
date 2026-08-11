import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import { useCart } from "../context/CartContext";

import "../styles/Checkout.css";


const Checkout = () => {

    const navigate = useNavigate();

    const {
        cartItems,
        clearCart
    } = useCart();


    const [loading, setLoading] = useState(false);


    const [formData, setFormData] = useState({

        name: "",
        email: "",
        phone: "",
        address: "",
        city: "Dhaka",
        postalCode: ""

    });


    /*
    ========================================
    CALCULATE TOTAL
    ========================================
    */

    const totalAmount = (cartItems || []).reduce(

        (total, item) => {

            const price =
                Number(item.price || 0);

            const quantity =
                Number(item.quantity || 1);

            return total + (price * quantity);

        },

        0

    );


    /*
    ========================================
    EMPTY CART CHECK
    ========================================
    */

    useEffect(() => {

        if (
            !cartItems ||
            cartItems.length === 0
        ) {

            navigate("/cart");

        }

    }, [cartItems, navigate]);


    /*
    ========================================
    HANDLE INPUT
    ========================================
    */

    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;


        setFormData({

            ...formData,

            [name]: value

        });

    };


    /*
    ========================================
    START PAYMENT
    ========================================
    */

    const handlePayment = async (e) => {

        e.preventDefault();


        /*
        Validate customer information
        */

        if (
            !formData.name.trim() ||
            !formData.email.trim() ||
            !formData.phone.trim() ||
            !formData.address.trim()
        ) {

            alert(
                "Please fill in all required information."
            );

            return;

        }


        /*
        Check cart
        */

        if (
            !cartItems ||
            cartItems.length === 0
        ) {

            alert(
                "Your cart is empty."
            );

            navigate("/cart");

            return;

        }


        /*
        Check total
        */

        if (totalAmount <= 0) {

            alert(
                "Invalid order amount."
            );

            return;

        }


        try {

            setLoading(true);


            /*
            ========================================
            PREPARE ORDER ITEMS
            ========================================
            */

            const items = cartItems.map(
                (item) => ({

                    product:
                        item.product ||
                        item._id ||
                        item.id,

                    quantity:
                        Number(item.quantity || 1)

                })
            );


            /*
            Check product IDs
            */

            const invalidItem =
                items.some(
                    (item) => !item.product
                );


            if (invalidItem) {

                alert(
                    "One or more products are invalid."
                );

                setLoading(false);

                return;

            }


            /*
            ========================================
            SHIPPING ADDRESS
            ========================================
            */

            const shippingAddress = {

                name:
                    formData.name,

                phone:
                    formData.phone,

                address:
                    formData.address,

                city:
                    formData.city || "Dhaka",

                postalCode:
                    formData.postalCode || ""

            };


            /*
            ========================================
            CREATE ORDER
            ========================================
            */

            const orderResponse =
                await api.post(
                    "/orders",
                    {

                        items,

                        shippingAddress,

                        paymentMethod:
                            "sslcommerz"

                    }
                );


            const order =
                orderResponse.data?.order;


            if (!order) {

                throw new Error(
                    "Order could not be created."
                );

            }


            /*
            ========================================
            INITIALIZE SSL COMMERZ
            ========================================
            */

            const paymentResponse =
                await api.post(
                    "/payment/sslcommerz",
                    {

                        orderId:
                            order._id,

                        totalAmount:
                            order.totalPrice,

                        name:
                            formData.name,

                        email:
                            formData.email,

                        phone:
                            formData.phone,

                        address:
                            formData.address,

                        city:
                            formData.city || "Dhaka",

                        postalCode:
                            formData.postalCode || ""

                    }
                );


            const gatewayUrl =
                paymentResponse.data?.gateway;


            if (!gatewayUrl) {

                throw new Error(
                    "Payment gateway URL was not returned."
                );

            }


            /*
            ========================================
            REDIRECT TO SSL COMMERZ
            ========================================
            */

            window.location.href =
                gatewayUrl;


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


    /*
    ========================================
    PAGE
    ========================================
    */

    return (

        <div className="checkout-page">

            <div className="checkout-container">


                {/* ========================================
                    CHECKOUT FORM
                ======================================== */}

                <div className="checkout-form">

                    <h1>
                        Checkout
                    </h1>


                    <h2>
                        Customer Information
                    </h2>


                    <form
                        onSubmit={handlePayment}
                    >


                        {/* Name */}

                        <input
                            type="text"
                            name="name"
                            placeholder="Full Name"
                            value={
                                formData.name
                            }
                            onChange={
                                handleChange
                            }
                            required
                        />


                        {/* Email */}

                        <input
                            type="email"
                            name="email"
                            placeholder="Email Address"
                            value={
                                formData.email
                            }
                            onChange={
                                handleChange
                            }
                            required
                        />


                        {/* Phone */}

                        <input
                            type="tel"
                            name="phone"
                            placeholder="Phone Number"
                            value={
                                formData.phone
                            }
                            onChange={
                                handleChange
                            }
                            required
                        />


                        {/* Address */}

                        <textarea
                            name="address"
                            placeholder="Full Address"
                            value={
                                formData.address
                            }
                            onChange={
                                handleChange
                            }
                            required
                        />


                        {/* City */}

                        <input
                            type="text"
                            name="city"
                            placeholder="City"
                            value={
                                formData.city
                            }
                            onChange={
                                handleChange
                            }
                        />


                        {/* Postal Code */}

                        <input
                            type="text"
                            name="postalCode"
                            placeholder="Postal Code"
                            value={
                                formData.postalCode
                            }
                            onChange={
                                handleChange
                            }
                        />


                        <h2>
                            Payment Method
                        </h2>


                        <div className="payment-selected">

                            <span>
                                SSLCommerz
                            </span>

                            <small>
                                Secure Online Payment
                            </small>

                        </div>


                        {/* Pay Button */}

                        <button
                            type="submit"
                            className="checkout-btn"
                            disabled={loading}
                        >

                            {loading

                                ? "Redirecting to Payment..."

                                : `Pay ৳${totalAmount.toFixed(2)}`

                            }

                        </button>


                    </form>

                </div>


                {/* ========================================
                    ORDER SUMMARY
                ======================================== */}

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
                            ৳
                            {totalAmount.toFixed(2)}
                        </strong>

                    </div>

                </div>


            </div>

        </div>

    );

};


export default Checkout;
