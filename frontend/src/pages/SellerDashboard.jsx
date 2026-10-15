import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/Dashboard.css";

const SellerDashboard = () => {
  const [payoutDetails, setPayoutDetails] = useState({
    payoutMethod: "",
    payoutAccount: ""
  });
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");
  const [payoutError, setPayoutError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    image: "",
    stock: ""
  });

  useEffect(() => {
    let cancelled = false;

    api.get("/seller/payout-details")
      .then(response => {
        if (!cancelled) {
          setPayoutDetails({
            payoutMethod: response.data?.payoutMethod || "",
            payoutAccount: response.data?.payoutAccount || ""
          });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setPayoutError(
            error.response?.data?.message ||
            "Could not load payout details."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPayoutLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const savePayoutDetails = async event => {
    event.preventDefault();
    setPayoutSaving(true);
    setPayoutError("");
    setPayoutMessage("");

    try {
      const response = await api.put("/seller/payout-details", payoutDetails);
      setPayoutDetails({
        payoutMethod: response.data.payoutMethod,
        payoutAccount: response.data.payoutAccount
      });
      setPayoutMessage("Payout details saved privately.");
    } catch (error) {
      setPayoutError(
        error.response?.data?.message ||
        "Could not save payout details."
      );
    } finally {
      setPayoutSaving(false);
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      const token = localStorage.getItem("token");

      const response = await api.post(
        "/products",
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      alert(response.data?.isApproved === false
        ? "Product submitted for admin approval."
        : "Product added successfully.");

      setForm({
        name: "",
        description: "",
        price: "",
        category: "",
        image: "",
        stock: ""
      });

    } catch (err) {

      alert(
        err.response?.data?.message ||
        "Failed to add product"
      );

    }

  };

  return (

    <div className="dashboard">

      <h1>Seller Dashboard</h1>

      <section className="dashboard-payout">
        <h2>Private payout details</h2>
        <p>Only you and Shop administrators can view these details. Payouts are sent after the customer confirms delivery.</p>
        {payoutError && <p className="dashboard-feedback error" role="alert">{payoutError}</p>}
        {payoutMessage && <p className="dashboard-feedback" role="status">{payoutMessage}</p>}
        <form className="dashboard-form" onSubmit={savePayoutDetails}>
          <input
            name="payoutMethod"
            placeholder="Payout method (e.g. bKash, bank transfer)"
            value={payoutDetails.payoutMethod}
            onChange={event => setPayoutDetails(previous => ({
              ...previous,
              payoutMethod: event.target.value
            }))}
            maxLength={40}
            required
            disabled={payoutLoading || payoutSaving}
          />
          <input
            name="payoutAccount"
            placeholder="Payout account or wallet number"
            value={payoutDetails.payoutAccount}
            onChange={event => setPayoutDetails(previous => ({
              ...previous,
              payoutAccount: event.target.value
            }))}
            maxLength={120}
            required
            disabled={payoutLoading || payoutSaving}
          />
          <button type="submit" disabled={payoutLoading || payoutSaving}>
            {payoutSaving ? "Saving..." : "Save payout details"}
          </button>
        </form>
      </section>

      <form
        className="dashboard-form"
        onSubmit={handleSubmit}
      >

        <input
          name="name"
          placeholder="Product Name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="price"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
          required
        />

        <input
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
          required
        />

        <input
          name="image"
          placeholder="Image URL"
          value={form.image}
          onChange={handleChange}
        />

        <input
          type="number"
          name="stock"
          placeholder="Stock"
          value={form.stock}
          onChange={handleChange}
          required
        />

        <button type="submit">
          Add Product
        </button>

      </form>

    </div>

  );

};

export default SellerDashboard;
