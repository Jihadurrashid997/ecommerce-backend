import React, { useState } from "react";
import api from "../services/api";
import "../styles/Dashboard.css";

const SellerDashboard = () => {

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    image: "",
    stock: ""
  });

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

      await api.post(
        "/products",
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      alert("Product Added Successfully");

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
