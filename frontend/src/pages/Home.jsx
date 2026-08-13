import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import api from "../services/api";
import ProductCard from "../components/ProductCard";

import "../styles/Home.css";

const Home = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [keyword, setKeyword] = useState(
        searchParams.get("search") ||
        searchParams.get("q") ||
        ""
    );

    const [category, setCategory] = useState(
        searchParams.get("category") || ""
    );

    const [page, setPage] = useState(1);

    const productsPerPage = 8;

    // ==========================================
    // FETCH PRODUCTS
    // ==========================================

    useEffect(() => {
        let cancelled = false;

        const fetchProducts = async () => {
            try {
                setLoading(true);
                setError("");

                const params = new URLSearchParams();

                if (keyword.trim()) {
                    params.set(
                        "keyword",
                        keyword.trim()
                    );
                }

                if (category) {
                    params.set(
                        "category",
                        category
                    );
                }

                const query = params.toString();

                const response = await api.get(
                    query
                        ? `/products?${query}`
                        : "/products"
                );

                if (cancelled) return;

                const data = response.data;

                const productList =
                    Array.isArray(data)
                        ? data
                        : Array.isArray(data?.products)
                            ? data.products
                            : [];

                setProducts(productList);
                setPage(1);

            } catch (err) {
                if (cancelled) return;

                console.error(
                    "Failed to load products:",
                    err
                );

                setProducts([]);

                setError(
                    err.response?.data?.message ||
                    "Failed to load products. Please try again."
                );

            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchProducts();

        return () => {
            cancelled = true;
        };

    }, [keyword, category]);


    // ==========================================
    // UPDATE URL
    // ==========================================

    const updateSearchParams = (
        searchValue,
        categoryValue
    ) => {

        const params = {};

        if (searchValue.trim()) {
            params.search =
                searchValue.trim();
        }

        if (categoryValue) {
            params.category =
                categoryValue;
        }

        setSearchParams(params);
    };


    // ==========================================
    // SEARCH
    // ==========================================

    const handleSearchChange = (e) => {

        const value = e.target.value;

        setKeyword(value);
        setPage(1);

        updateSearchParams(
            value,
            category
        );
    };


    // ==========================================
    // CATEGORY
    // ==========================================

    const handleCategoryChange = (e) => {

        const value = e.target.value;

        setCategory(value);
        setPage(1);

        updateSearchParams(
            keyword,
            value
        );
    };


    // ==========================================
    // CLEAR FILTERS
    // ==========================================

    const clearFilters = () => {

        setKeyword("");
        setCategory("");
        setPage(1);

        setSearchParams({});
    };


    // ==========================================
    // PAGINATION
    // ==========================================

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                products.length /
                productsPerPage
            )
        );

    const safePage =
        Math.min(
            page,
            totalPages
        );

    const firstIndex =
        (safePage - 1) *
        productsPerPage;

    const lastIndex =
        firstIndex +
        productsPerPage;

    const currentProducts =
        products.slice(
            firstIndex,
            lastIndex
        );


    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (
            <div className="home-loading">

                <motion.div
                    className="loader"
                    animate={{
                        rotate: 360
                    }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />

                <p>
                    Loading products...
                </p>

            </div>
        );
    }


    return (

        <div className="home-page">

            {/* =====================================
                HERO
            ====================================== */}

            <section className="hero-section">

                <div className="hero-content">

                    <motion.span
                        className="hero-badge"
                        initial={{
                            opacity: 0,
                            y: 20
                        }}
                        animate={{
                            opacity: 1,
                            y: 0
                        }}
                    >
                        ✨ Your Trusted Marketplace
                    </motion.span>


                    <motion.h1
                        initial={{
                            opacity: 0,
                            y: 30
                        }}
                        animate={{
                            opacity: 1,
                            y: 0
                        }}
                        transition={{
                            delay: 0.1
                        }}
                    >

                        Buy.
                        <span> Sell. </span>
                        Connect.

                    </motion.h1>


                    <motion.p
                        initial={{
                            opacity: 0,
                            y: 20
                        }}
                        animate={{
                            opacity: 1,
                            y: 0
                        }}
                        transition={{
                            delay: 0.2
                        }}
                    >

                        Discover amazing products,
                        connect with sellers,
                        and enjoy a secure
                        marketplace experience.

                    </motion.p>

                </div>

            </section>


            {/* =====================================
                PRODUCTS
            ====================================== */}

            <div className="container">

                <div className="marketplace-header">

                    <div>

                        <h2 className="title">
                            Explore Products
                        </h2>

                        <p className="subtitle">
                            Find exactly what
                            you're looking for.
                        </p>

                    </div>

                    <span className="product-count">
                        {products.length} Products
                    </span>

                </div>


                {/* =====================================
                    FILTER BAR
                ====================================== */}

                <div className="filter-bar">

                    <div className="home-search">

                        <span>
                            🔍
                        </span>

                        <input
                            type="search"
                            placeholder="Search products..."
                            value={keyword}
                            onChange={
                                handleSearchChange
                            }
                        />

                        {keyword && (

                            <button
                                type="button"
                                onClick={clearFilters}
                                aria-label="Clear search"
                                className="search-clear"
                            >
                                ×
                            </button>

                        )}

                    </div>


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


                {/* =====================================
                    ERROR
                ====================================== */}

                {error && (

                    <div className="error-message">

                        <p>
                            {error}
                        </p>

                        <button
                            onClick={() =>
                                window.location.reload()
                            }
                        >
                            Try Again
                        </button>

                    </div>

                )}


                {/* =====================================
                    NO PRODUCTS
                ====================================== */}

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
                                We couldn't find
                                any products matching
                                your search.
                            </p>

                            <button
                                onClick={
                                    clearFilters
                                }
                            >
                                Clear Filters
                            </button>

                        </div>

                    )}


                {/* =====================================
                    PRODUCT GRID
                ====================================== */}

                {currentProducts.length > 0 && (

                    <motion.div
                        className="product-grid"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                    >

                        {currentProducts.map(
                            (product, index) => (

                                <motion.div
                                    key={
                                        product._id ||
                                        product.id ||
                                        index
                                    }
                                    initial={{
                                        opacity: 0,
                                        y: 20
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0
                                    }}
                                    transition={{
                                        delay:
                                            index * 0.05
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


                {/* =====================================
                    PAGINATION
                ====================================== */}

                {products.length > 0 && (

                    <div className="pagination">

                        <button
                            disabled={
                                safePage === 1
                            }
                            onClick={() =>
                                setPage(
                                    previous =>
                                        Math.max(
                                            1,
                                            previous - 1
                                        )
                                )
                            }
                        >
                            ← Previous
                        </button>


                        <div className="page-info">

                            Page{" "}
                            <strong>
                                {safePage}
                            </strong>

                            {" "}of{" "}

                            <strong>
                                {totalPages}
                            </strong>

                        </div>


                        <button
                            disabled={
                                safePage ===
                                totalPages
                            }
                            onClick={() =>
                                setPage(
                                    previous =>
                                        Math.min(
                                            totalPages,
                                            previous + 1
                                        )
                                )
                            }
                        >
                            Next →
                        </button>

                    </div>

                )}

            </div>

        </div>
    );
};

export default Home;
