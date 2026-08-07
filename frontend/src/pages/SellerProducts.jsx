import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/SellerProducts.css";

const SellerProducts = () => {

  const [products, setProducts] = useState([]);

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

      <table>

        <thead>

          <tr>

            <th>Image</th>
            <th>Name</th>
            <th>Price</th>
            <th>Category</th>
            <th>Stock</th>
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

                import { Link } from "react-router-dom";
                
                <Link to={`/edit-product/${product._id}`}>

    <button className="edit-btn">

        Edit

    </button>

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

    </div>

  );

};

export default SellerProducts;
