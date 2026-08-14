import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useSearchParams
} from "react-router-dom";

import api from "../services/api";

import ProductCard
    from "../components/ProductCard";

import "../styles/Home.css";


const Home = () => {

    const [
        searchParams,
        setSearchParams
    ] = useSearchParams();


    const initialKeyword =
        (
            searchParams.get("search") ||
            searchParams.get("q") ||
            ""
        ).trim();


    const initialCategory =
        (
            searchParams.get("category") ||
            ""
        ).trim();


    const [
        keyword,
        setKeyword
    ] =
        useState(
            initialKeyword
        );


    const [
        category,
        setCategory
    ] =
        useState(
            initialCategory
        );


    const [
        products,
        setProducts
    ] =
        useState([]);


    const [
        loading,
        setLoading
    ] =
        useState(true);


    const [
        error,
        setError
    ] =
        useState("");


    const [
        page,
        setPage
    ] =
        useState(1);


    const productsPerPage =
        8;


    // ==================================================
    // SYNC URL
    // ==================================================

    useEffect(() => {

        const urlSearch =
            (
                searchParams.get("search") ||
                searchParams.get("q") ||
                ""
            ).trim();

        const urlCategory =
            (
                searchParams.get("category") ||
                ""
            ).trim();


        setKeyword(
            previous =>
                previous === urlSearch
                    ? previous
                    : urlSearch
        );


        setCategory(
            previous =>
                previous === urlCategory
                    ? previous
                    : urlCategory
        );


    }, [searchParams]);


    // ==================================================
    // FETCH PRODUCTS
    // ==================================================

    useEffect(() => {

        let cancelled = false;


        const fetchProducts =
            async () => {

                try {

                    setLoading(true);
                    setError("");


                    const params =
                        new URLSearchParams();


                    if (
                        keyword.trim()
                    ) {

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


                    const query =
                        params.toString();


                    const response =
                        await api.get(

                            query
                                ? `/products?${query}`
                                : "/products",

                            {
                                timeout: 12000
                            }

                        );


                    if (cancelled) {
                        return;
                    }


                    const data =
                        response.data;


                    const list =
                        Array.isArray(data)
                            ? data
                            : (
                                data?.products ||
                                data?.data ||
                                []
                            );


                    setProducts(
                        Array.isArray(list)
                            ? list
                            : []
                    );


                } catch (err) {

                    if (cancelled) {
                        return;
                    }


                    console.error(
                        "PRODUCT LOAD ERROR:",
                        err
                    );


                    setProducts([]);


                    setError(
                        err.response?.data?.message ||
                        "Failed to load products."
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

    }, [
        keyword,
        category
    ]);


    // ==================================================
    // SEARCH
    // ==================================================

    const handleSearch =
        (e) => {

            const value =
                e.target.value;


            setKeyword(value);
            setPage(1);


            const params = {};


            if (
                value.trim()
            ) {

                params.search =
                    value.trim();

            }


            if (category) {

                params.category =
                    category;

            }


            setSearchParams(
                params
            );

        };


    // ==================================================
    // CATEGORY
    // ==================================================

    const handleCategory =
        (e) => {

            const value =
                e.target.value;


            setCategory(value);
            setPage(1);


            const params = {};


            if (
                keyword.trim()
            ) {

                params.search =
                    keyword.trim();

            }


            if (value) {

                params.category =
                    value;

            }


            setSearchParams(
                params
            );

        };


    // ==================================================
    // PAGINATION
    // ==================================================

    const totalPages =
        Math.max(
            Math.ceil(
                products.length /
                productsPerPage
            ),
            1
        );


    const safePage =
        Math.min(
            page,
            totalPages
        );


    const firstIndex =
        (
            safePage - 1
        ) *
        productsPerPage;


    const currentProducts =
        products.slice(
            firstIndex,
            firstIndex +
            productsPerPage
        );


    // ==================================================
    // CLEAR
    // ==================================================

    const clearFilters =
        () => {

            setKeyword("");
            setCategory("");
            setPage(1);

            setSearchParams({});

        };


    // ==================================================
    // LOADING
    // ==================================================

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


            {/* HERO */}

            <section className="hero-section">

                <div className="hero-content">

                    <span className="hero-badge">
                        ✨ Your Trusted Marketplace
                    </span>

                    <h1>

                        Buy.
                        <span>
                            {" "}Sell.{" "}
                        </span>
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


            <div className="container">


                {/* HEADER */}

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


                {/* FILTER */}

                <div className="filter-bar">

                    <div className="home-search">

                        <span>
                            🔍
                        </span>

                        <input
                            type="search"
                            value={keyword}
                            onChange={
                                handleSearch
                            }
                            placeholder="Search products..."
                        />

                    </div>


                    <select
                        value={category}
                        onChange={
                            handleCategory
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


                {error && (

                    <div className="error-message">

                        {error}

                    </div>

                )}


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
                                products matching
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


                {currentProducts.length > 0 && (

                    <div className="product-grid">

                        {currentProducts.map(
                            product => (

                                <ProductCard
                                    key={
                                        product._id ||
                                        product.id
                                    }
                                    product={
                                        product
                                    }
                                />

                            )
                        )}

                    </div>

                )}


                {/* PAGINATION */}

                {products.length > 0 && (

                    <div className="pagination">

                        <button
                            disabled={
                                safePage === 1
                            }
                            onClick={() =>
                                setPage(
                                    safePage - 1
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
                                    safePage + 1
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
