import React, { useEffect, useState } from "react";
import api from "../services/api";
import ProductCard from "../components/ProductCard";

const Home = () => {

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    fetchProducts();

  }, []);

  const fetchProducts = async () => {

    try {

      const res = await api.get("/products");

      setProducts(res.data);

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  };

  if (loading) {

    return <div className="loader"></div>;

  }

  return (

    <div className="container">

      <h1 className="title">

        Latest Products

      </h1>

      <div className="product-grid">

        {

          products.map((product) => (

            <ProductCard

              key={product._id}

              product={product}

            />

          ))

        }

      </div>

    </div>

  );

};

export default Home;
