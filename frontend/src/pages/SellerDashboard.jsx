import React, { useEffect, useState } from "react";
import api from "../services/api";
import "./SellerDashboard.css";

const SellerDashboard = () => {

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "",
    image: "",
    description: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const addProduct = async (e) => {
    e.preventDefault();

    try {
      await api.post("/products/add", form);

      alert("Product Added Successfully");

      setForm({
        name: "",
        price: "",
        category: "",
        image: "",
        description: "",
      });

      loadProducts();

    } catch (err) {
      alert(err.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="seller-dashboard">

      <h1>Seller Dashboard</h1>

      <form className="product-form" onSubmit={addProduct}>

        <input
          name="name"
          placeholder="Product Name"
          value={form.name}
          onChange={handleChange}
        />

        <input
          name="price"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
        />

        <input
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
        />

        <input
          name="image"
          placeholder="Image URL"
          value={form.image}
          onChange={handleChange}
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />

        <button type="submit">
          Add Product
        </button>

      </form>

      <div className="seller-products">

        {products.map((item) => (

          <div className="seller-card" key={item._id}>

            <img
              src={item.image}
              alt={item.name}
            />

            <h3>{item.name}</h3>

            <p>{item.category}</p>

            <h2>৳ {item.price}</h2>

          </div>

        ))}

      </div>

    </div>
  );
};

export default SellerDashboard;
