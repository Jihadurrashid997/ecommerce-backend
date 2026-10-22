import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "../styles/SellerProducts.css";

const SellerProducts = () => {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {

    try {

      const res = await api.get("/products/mine");

      setProducts(res.data);

    } catch (err) {
      console.error("Could not load seller products:", err);
      setError(err.response?.data?.message || "Could not load your products.");
    } finally {
      setLoading(false);
    }

  };

  const deleteProduct = async (id) => {

    if (!window.confirm("Delete this product?")) return;

    try {

      await api.delete(`/products/${id}`);

      setProducts(products.filter((item) => item._id !== id));

      alert("Product Deleted");

    } catch (err) {

      alert("Delete Failed");

    }

  };

  return (

    <div className="seller-products">

      <h1>My Products</h1>

      {loading && <p>Loading your products...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && products.length === 0 && <p>You have not listed any products yet.</p>}

      {!loading && !error && products.length > 0 && (
      <table>

        <thead>

          <tr>

            <th>Image</th>
            <th>Name</th>
            <th>Price</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Listing review</th>
            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          {products.map((product) => (

            <tr key={product._id}>

              <td>

                <img
                  src={product.image}
                  alt={product.name}
                  width="70"
                />

              </td>

              <td>{product.name}</td>

              <td>৳ {product.price}</td>

              <td>{product.category}</td>

              <td>{product.stock}</td>
              <td>
                {product.approvalStatus || (product.isApproved === false ? "pending" : "approved")}
                {product.approvalReviewNote && <p role="note">{product.approvalReviewNote}</p>}
              </td>

              <td>

                <Link to={`/shop/edit-product/${product._id}`}>
                  <button className="edit-btn">Edit</button>
                </Link>

                <button
                  className="delete-btn"
                  onClick={() => deleteProduct(product._id)}
                >
                  Delete
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>
      )}

    </div>

  );

};

export default SellerProducts;
