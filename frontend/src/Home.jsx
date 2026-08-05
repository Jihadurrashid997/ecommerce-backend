import React, { useEffect, useState } from "react";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import { motion } from "framer-motion";
import "./Home.css";

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

  return (

    <div className="home">

      {/* HERO */}

      <section className="hero">

        <motion.div

          initial={{ opacity:0, y:40 }}

          animate={{ opacity:1, y:0 }}

          transition={{ duration:.8 }}

          className="hero-content"

        >

          <h1>

            Buy & Sell Anything

          </h1>

          <p>

            Bangladesh Premium Marketplace

          </p>

          <button>

            Explore Products

          </button>

        </motion.div>

      </section>

      {/* CATEGORY */}

      <section className="category-section">

        <h2>

          Popular Categories

        </h2>

        <div className="categories">

          <div className="category-card">📱 Electronics</div>

          <div className="category-card">💻 Laptop</div>

          <div className="category-card">🚗 Vehicles</div>

          <div className="category-card">🏠 Property</div>

          <div className="category-card">👕 Fashion</div>

          <div className="category-card">🪑 Furniture</div>

        </div>

      </section>

      {/* PRODUCTS */}

      <section className="product-section">

        <h2>

          Latest Products

        </h2>

        {

          loading ?

          <div className="loader"></div>

          :

          <div className="product-grid">

            {

              products.map((product)=>(

                <ProductCard

                  key={product._id}

                  product={product}

                />

              ))

            }

          </div>

        }

      </section>

    </div>

  );

};

export default Home;
