import React, { useEffect, useState } from "react";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import "../styles/Home.css";

const Home = () => {

    const [products, setProducts] = useState([]);

    const [filteredProducts, setFilteredProducts] = useState([]);

    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");

    useEffect(() => {

        fetchProducts();

    }, []);

    useEffect(() => {

        const result = products.filter(product =>

            product.name.toLowerCase().includes(search.toLowerCase())

        );

        setFilteredProducts(result);

    }, [search, products]);

    const fetchProducts = async () => {

        try {

            const res = await api.get("/products");

            setProducts(res.data);

            setFilteredProducts(res.data);

        } catch (err) {

            console.log(err);

        } finally {

            setLoading(false);

        }

    };

    if (loading) {

        return (

            <div className="loader-container">

                <div className="loader"></div>

            </div>

        );

    }

    return (

        <div className="home">

            <div className="hero">

                <h1>

                    Welcome To Marketplace

                </h1>

                <p>

                    Buy • Sell • Chat Securely

                </p>

            </div>

            <div className="search-section">

                <input

                    type="text"

                    placeholder="Search Products..."

                    value={search}

                    onChange={(e)=>setSearch(e.target.value)}

                />

            </div>

            {

                filteredProducts.length===0 ?

                (

                    <div className="no-product">

                        No Product Found

                    </div>

                )

                :

                (

                    <div className="product-grid">

                        {

                            filteredProducts.map(product=>(

                                <ProductCard

                                key={product._id}

                                product={product}

                                />

                            ))

                        }

                    </div>

                )

            }

        </div>

    );

};

export default Home;
