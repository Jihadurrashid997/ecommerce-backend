import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import api from "../services/api";
import "../styles/Checkout.css";

const Checkout = () => {

  const navigate = useNavigate();

  const { cart, clearCart } = useCart();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  });

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleOrder = async (e) => {

    e.preventDefault();

    try {

      await api.post("/orders", {

        products: cart.map((item) => ({
          product: item._id,
          quantity: item.quantity || 1
        })),

        totalPrice,

        paymentMethod: "Cash On Delivery",

        shippingAddress: form.address

      });

      alert("Order Placed Successfully");

      clearCart();

      navigate("/orders");

    } catch (err) {

      alert(
        err.response?.data?.message ||
        "Order Failed"
      );

    }

  };

  return (

    <div className="checkout-page">

      <h1>Checkout</h1>

      <form
        className="checkout-form"
        onSubmit={handleOrder}
      >

        <input
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          name="phone"
          placeholder="Phone Number"
          value={form.phone}
          onChange={handleChange}
          required
        />

        <textarea
          name="address"
          placeholder="Shipping Address"
          value={form.address}
          onChange={handleChange}
          required
        />

        <h2>Total: ৳ {totalPrice}</h2>

        <button type="submit">

          Place Order

        </button>

      </form>

    </div>

  );

};

export default Checkout;
