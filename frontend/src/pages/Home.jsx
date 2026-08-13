import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import api from "../services/api";
import ProductCard from "../components/ProductCard";

import "../styles/Home.css";


const Home = () => {

    const navigate = useNavigate();

    const [searchParams] = useSearchParams();

    const [products, setProducts] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [keyword, setKeyword] = useState(
        searchParams.get("search") || ""
    );

    const [category, setCategory] = useState(
        searchParams.get("category") || ""
    );

    const [page, setPage] = useState(1);

    const productsPerPage = 8;


    // ==================================================
    // FETCH PRODUCTS
    // ==================================================

    useEffect(() => {

        fetchProducts();

    }, [category]);


    const fetchProducts = async () => {

        try {

            setLoading(true);
            setError("");

            const params = new URLSearchParams();

            if (category) {
                params.append("category", category);
            }

            const response = await api.get(
                params.toString()
                    ? `/products?${params.toString()}`
                    : "/products"
            );

            const data =
                Array.isArray(response.data)
                    ? response.data
                    : response.data?.products || [];

            setProducts(data);

            setPage(1);

        } catch (err) {

            console.error(
                "Failed to load products:",
                err
            );

            setProducts([]);

            setError(
                err.response?.data?.message ||
                "Unable to load products right now."
            );

        } finally {

            setLoading(false);

        }

    };


    // ==================================================
    // SEARCH
    // ==================================================

    const handleSearchSubmit = (e) => {

        e.preventDefault();

        const search = keyword.trim();

        if (!search) {

            navigate("/");

            return;

        }

        navigate(
            `/search?q=${encodeURIComponent(search)}`
        );

    };


    // ==================================================
    // CATEGORY
    // ==================================================

    const handleCategoryChange = (e) => {

        const value = e.target.value;

        setCategory(value);

        setPage(1);

    };


    // ==================================================
    // PAGINATION
    // ==================================================

    const totalPages =
        Math.ceil(
            products.length /
            productsPerPage
        );

    const safeTotalPages =
        totalPages || 1;

    const lastIndex =
        page * productsPerPage;

    const firstIndex =
        lastIndex - productsPerPage;

    const currentProducts =
        products.slice(
            firstIndex,
            lastIndex
        );


    // ==================================================
    // LOADING
    // ==================================================

    if (loading) {

        return (

            <div className="home-loading">

                <motion.div
                    className="premium-loader-orb"

                    animate={{
                        rotateY: 360,
                        rotateX: 360
                    }}

                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                >

                    JR

                </motion.div>

                <motion.p
                    initial={{
                        opacity: 0
                    }}
                    animate={{
                        opacity: 1
                    }}
                >
                    Loading JR Store...
                </motion.p>

            </div>

        );

    }


    return (

        <motion.div
            className="home-page"

            initial={{
                opacity: 0
            }}

            animate={{
                opacity: 1
            }}

            transition={{
                duration: 0.7
            }}
        >


            {/* ==================================================
                PREMIUM 3D HERO
            ================================================== */}

            <section className="hero-section">

                <div className="hero-ambient ambient-one" />
                <div className="hero-ambient ambient-two" />
                <div className="hero-grid" />


                <motion.div
                    className="hero-content"

                    initial={{
                        opacity: 0,
                        y: 60
                    }}

                    animate={{
                        opacity: 1,
                        y: 0
                    }}

                    transition={{
                        duration: 1,
                        ease: [0.22, 1, 0.36, 1]
                    }}
                >

                    <motion.span
                        className="hero-badge"

                        initial={{
                            opacity: 0,
                            scale: 0.8
                        }}

                        animate={{
                            opacity: 1,
                            scale: 1
                        }}

                        transition={{
                            delay: 0.2,
                            duration: 0.6
                        }}
                    >
                        ✨ PREMIUM MARKETPLACE
                    </motion.span>


                    <h1>

                        Buy.
                        <span> Sell. </span>
                        Connect.

                    </h1>


                    <p>

                        Discover amazing products,
                        connect with sellers,
                        and enjoy a secure
                        marketplace experience.

                    </p>


                    {/* SEARCH */}

                    <motion.form
                        className="premium-search"

                        onSubmit={handleSearchSubmit}

                        initial={{
                            opacity: 0,
                            y: 25
                        }}

                        animate={{
                            opacity: 1,
                            y: 0
                        }}

                        transition={{
                            delay: 0.45,
                            duration: 0.7
                        }}
                    >

                        <span className="search-icon">
                            🔍
                        </span>


                        <input
                            type="search"
                            placeholder="Search products, sellers..."
                            value={keyword}
                            onChange={(e) =>
                                setKeyword(
                                    e.target.value
                                )
                            }
                        />


                        <button type="submit">
                            Search
                        </button>

                    </motion.form>

                </motion.div>


                {/* ==================================================
                    3D FLOATING CARDS
                ================================================== */}

                <motion.div
                    className="hero-3d-card card-one"

                    animate={{
                        y: [-12, 12, -12],
                        rotateZ: [-2, 2, -2]
                    }}

                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >

                    <div className="floating-card-icon">
                        🛍️
                    </div>

                    <strong>
                        Shop
                    </strong>

                    <span>
                        Discover products
                    </span>

                </motion.div>


                <motion.div
                    className="hero-3d-card card-two"

                    animate={{
                        y: [10, -14, 10],
                        rotateZ: [2, -2, 2]
                    }}

                    transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >

                    <div className="floating-card-icon">
                        💬
                    </div>

                    <strong>
                        Connect
                    </strong>

                    <span>
                        Chat with sellers
                    </span>

                </motion.div>


                <motion.div
                    className="hero-3d-card card-three"

                    animate={{
                        y: [-8, 15, -8],
                        rotateZ: [-1, 3, -1]
                    }}

                    transition={{
                        duration: 5.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >

                    <div className="floating-card-icon">
                        🔐
                    </div>

                    <strong>
                        Secure
                    </strong>

                    <span>
                        Safe marketplace
                    </span>

                </motion.div>

            </section>


            {/* ==================================================
                MARKETPLACE
            ================================================== */}

            <div className="container">


                <motion.div
                    className="marketplace-header"

                    initial={{
                        opacity: 0,
                        y: 25
                    }}

                    whileInView={{
                        opacity: 1,
                        y: 0
                    }}

                    viewport={{
                        once: true
                    }}
                >

                    <div>

                        <h2 className="title">
                            Explore Products
                        </h2>

                        <p className="subtitle">
                            Find exactly what you're looking for.
                        </p>

                    </div>


                    <span className="product-count">

                        {products.length} Products

                    </span>

                </motion.div>


                {/* ==================================================
                    FILTER
                ================================================== */}

                <div className="filter-bar">

                    <form
                        className="home-search"
                        onSubmit={handleSearchSubmit}
                    >

                        <span>
                            🔍
                        </span>

                        <input
                            type="search"
                            placeholder="Search products..."
                            value={keyword}
                            onChange={(e) =>
                                setKeyword(
                                    e.target.value
                                )
                            }
                        />

                        <button type="submit">
                            Search
                        </button>

                    </form>


                    <select
                        value={category}
                        onChange={
                            handleCategoryChange
                        }
                    >

                        <option value="">
                            All Categories
                        </option>

                        <option value="Electronics">
                            Electronics
                        </option>

                        <option value="Fashion">
                            Fashion
                        </option>

                        <option value="Books">
                            Books
                        </option>

                        <option value="Sports">
                            Sports
                        </option>

                        <option value="Home">
                            Home
                        </option>

                    </select>

                </div>


                {/* ==================================================
                    ERROR
                ================================================== */}

                {error && (

                    <div className="error-message">

                        {error}

                        <button
                            onClick={
                                fetchProducts
                            }
                        >
                            Retry
                        </button>

                    </div>

                )}


                {/* ==================================================
                    PRODUCTS
                ================================================== */}

                {!error &&
                    currentProducts.length > 0 && (

                    <motion.div
                        className="product-grid"

                        initial={{
                            opacity: 0
                        }}

                        animate={{
                            opacity: 1
                        }}

                        transition={{
                            duration: 0.6
                        }}
                    >

                        {currentProducts.map(
                            (product, index) => (

                                <motion.div
                                    key={
                                        product._id
                                    }

                                    initial={{
                                        opacity: 0,
                                        y: 35
                                    }}

                                    animate={{
                                        opacity: 1,
                                        y: 0
                                    }}

                                    transition={{
                                        delay:
                                            index * 0.06,
                                        duration: 0.5
                                    }}
                                >

                                    <ProductCard
                                        product={product}
                                    />

                                </motion.div>

                            )
                        )}

                    </motion.div>

                )}


                {/* ==================================================
                    NO PRODUCTS
                ================================================== */}

                {!error &&
                    currentProducts.length === 0 && (

                    <div className="no-products">

                        <div className="no-products-icon">
                            🔍
                        </div>

                        <h2>
                            No Products Found
                        </h2>

                        <p>
                            There are no products available
                            in this category.
                        </p>

                    </div>

                )}


                {/* ==================================================
                    PAGINATION
                ================================================== */}

                {products.length > 0 && (

                    <div className="pagination">

                        <button
                            disabled={page === 1}
                            onClick={() =>
                                setPage(
                                    page - 1
                                )
                            }
                        >
                            ← Previous
                        </button>


                        <div className="page-info">

                            Page{" "}
                            <strong>
                                {page}
                            </strong>

                            {" "}of{" "}

                            <strong>
                                {safeTotalPages}
                            </strong>

                        </div>


                        <button
                            disabled={
                                page ===
                                safeTotalPages
                            }

                            onClick={() =>
                                setPage(
                                    page + 1
                                )
                            }
                        >
                            Next →
                        </button>

                    </div>

                )}

            </div>

        </motion.div>

    );

};


export default Home;
