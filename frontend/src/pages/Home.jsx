import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../services/api";
import ProductCard from "../components/ProductCard";

import "../styles/Home.css";


const Home = () => {

    const [searchParams, setSearchParams] =
        useSearchParams();


    const [products, setProducts] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    const [keyword, setKeyword] =
        useState(
            searchParams.get("search") || ""
        );

    const [category, setCategory] =
        useState(
            searchParams.get("category") || ""
        );


    const [page, setPage] =
        useState(1);


    const productsPerPage = 8;


    // ==========================
    // FETCH PRODUCTS
    // ==========================

    useEffect(() => {

        fetchProducts();

    }, [keyword, category]);


    const fetchProducts = async () => {

        try {

            setLoading(true);
            setError("");


            const params = new URLSearchParams();


            if (keyword.trim()) {

                params.append(
                    "keyword",
                    keyword.trim()
                );

            }


            if (category) {

                params.append(
                    "category",
                    category
                );

            }


            const query =
                params.toString();


            const res = await api.get(
                query
                    ? `/products?${query}`
                    : "/products"
            );


            const data =
                Array.isArray(res.data)
                    ? res.data
                    : res.data?.products || [];


            setProducts(data);


        } catch (err) {

            console.error(
                "Failed to load products:",
                err
            );


            setProducts([]);


            setError(
                err.response?.data?.message ||
                "Failed to load products."
            );


        } finally {

            setLoading(false);

        }

    };


    // ==========================
    // SEARCH
    // ==========================

    const handleSearchChange = (e) => {

        const value =
            e.target.value;


        setKeyword(value);
        setPage(1);


        const params = {};


        if (value.trim()) {

            params.search =
                value.trim();

        }


        if (category) {

            params.category =
                category;

        }


        setSearchParams(params);

    };


    // ==========================
    // CATEGORY
    // ==========================

    const handleCategoryChange = (e) => {

        const value =
            e.target.value;


        setCategory(value);
        setPage(1);


        const params = {};


        if (keyword.trim()) {

            params.search =
                keyword.trim();

        }


        if (value) {

            params.category =
                value;

        }


        setSearchParams(params);

    };


    // ==========================
    // PAGINATION
    // ==========================

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
        lastIndex -
        productsPerPage;


    const currentProducts =
        products.slice(
            firstIndex,
            lastIndex
        );


    // ==========================
    // LOADING
    // ==========================

    if (loading) {

        return (

            <div className="home-loading">

                <div className="loader"></div>

                <p>
                    Loading products...
                </p>

            </div>

        );

    }


    return (

        <div className="home-page">


            {/* ==========================
                HERO SECTION
            =========================== */}

            <section className="hero-section">

                <div className="hero-content">

                    <span className="hero-badge">
                        ✨ Your Trusted Marketplace
                    </span>


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


                </div>

            </section>


            {/* ==========================
                PRODUCTS SECTION
            =========================== */}

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

                        {products.length}
                        {" "}
                        Products

                    </span>

                </div>


                {/* ==========================
                    FILTER BAR
                =========================== */}

                <div className="filter-bar">


                    {/* SEARCH */}

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

                    </div>


                    {/* CATEGORY */}

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


                {/* ==========================
                    ERROR
                =========================== */}

                {error && (

                    <div className="error-message">

                        {error}

                    </div>

                )}


                {/* ==========================
                    NO PRODUCTS
                =========================== */}

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
                                onClick={() => {

                                    setKeyword("");
                                    setCategory("");
                                    setPage(1);

                                    setSearchParams({});

                                }}
                            >

                                Clear Filters

                            </button>

                        </div>

                    )}


                {/* ==========================
                    PRODUCT GRID
                =========================== */}

                {currentProducts.length > 0 && (

                    <div className="product-grid">

                        {currentProducts.map(
                            (product) => (

                                <ProductCard
                                    key={product._id}
                                    product={product}
                                />

                            )
                        )}

                    </div>

                )}


                {/* ==========================
                    PAGINATION
                =========================== */}

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

        </div>

    );

};


export default Home;
