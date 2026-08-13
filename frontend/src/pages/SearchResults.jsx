import React, { useEffect, useState } from "react";

import {
    Link,
    useSearchParams
} from "react-router-dom";

import {
    FaUserCircle,
    FaSearch,
    FaComments,
    FaBoxOpen,
    FaArrowLeft
} from "react-icons/fa";

import {
    motion
} from "framer-motion";

import api from "../services/api";

import ProductCard from "../components/ProductCard";

import "../styles/SearchResults.css";


const SearchResults = () => {

    const [searchParams] =
        useSearchParams();


    // ==========================================
    // SEARCH KEYWORD
    // ==========================================

    const keyword =
        (
            searchParams.get("q") ||
            searchParams.get("search") ||
            searchParams.get("keyword") ||
            ""
        ).trim();


    // ==========================================
    // STATES
    // ==========================================

    const [products, setProducts] =
        useState([]);

    const [users, setUsers] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    // ==========================================
    // SEARCH
    // ==========================================

    useEffect(() => {

        let cancelled = false;


        if (!keyword) {

            setProducts([]);
            setUsers([]);
            setLoading(false);

            return;

        }


        const searchEverything =
            async () => {

                try {

                    setLoading(true);
                    setError("");


                    const encodedKeyword =
                        encodeURIComponent(
                            keyword
                        );


                    // ==================================
                    // PRODUCT SEARCH
                    // ==================================

                    const productRequest =
                        api.get(
                            `/products?keyword=${encodedKeyword}`
                        );


                    // ==================================
                    // USER SEARCH
                    // ==================================

                    const userRequest =
                        api.get(
                            `/users/search?q=${encodedKeyword}`
                        );


                    const [
                        productResponse,
                        userResponse
                    ] =
                        await Promise.allSettled([
                            productRequest,
                            userRequest
                        ]);


                    if (cancelled) return;


                    // ==================================
                    // PRODUCTS
                    // ==================================

                    if (
                        productResponse.status ===
                        "fulfilled"
                    ) {

                        const data =
                            productResponse.value.data;


                        const productList =
                            Array.isArray(data)
                                ? data
                                : Array.isArray(
                                    data?.products
                                )
                                    ? data.products
                                    : [];


                        setProducts(
                            productList
                        );

                    } else {

                        console.error(
                            "Product search failed:",
                            productResponse.reason
                        );

                        setProducts([]);

                    }


                    // ==================================
                    // USERS
                    // ==================================

                    if (
                        userResponse.status ===
                        "fulfilled"
                    ) {

                        const data =
                            userResponse.value.data;


                        const userList =
                            Array.isArray(data)
                                ? data
                                : Array.isArray(
                                    data?.users
                                )
                                    ? data.users
                                    : [];


                        setUsers(
                            userList
                        );

                    } else {

                        console.error(
                            "User search failed:",
                            userResponse.reason
                        );

                        setUsers([]);

                    }


                    // ==================================
                    // BOTH FAILED
                    // ==================================

                    if (
                        productResponse.status ===
                        "rejected" &&
                        userResponse.status ===
                        "rejected"
                    ) {

                        setError(
                            "Unable to search right now. Please try again."
                        );

                    }

                } catch (err) {

                    if (cancelled) return;


                    console.error(
                        "Search error:",
                        err
                    );


                    setError(
                        err.response?.data?.message ||
                        "Something went wrong while searching."
                    );

                } finally {

                    if (!cancelled) {
                        setLoading(false);
                    }

                }

            };


        searchEverything();


        return () => {
            cancelled = true;
        };

    }, [keyword]);


    // ==========================================
    // NO KEYWORD
    // ==========================================

    if (!keyword) {

        return (

            <div className="search-results-page">

                <div className="search-results-container">

                    <div className="no-results">

                        <FaSearch />

                        <h2>
                            Search Marketplace
                        </h2>

                        <p>
                            Search for products,
                            sellers and users.
                        </p>


                        <Link
                            to="/"
                            className="profile-result-btn"
                        >

                            <FaArrowLeft />

                            Back to Marketplace

                        </Link>

                    </div>

                </div>

            </div>

        );

    }


    return (

        <div className="search-results-page">

            <div className="search-results-container">


                {/* ==================================
                    HEADER
                =================================== */}

                <motion.div
                    className="search-results-header"
                    initial={{
                        opacity: 0,
                        y: 20
                    }}
                    animate={{
                        opacity: 1,
                        y: 0
                    }}
                >

                    <FaSearch />

                    <div>

                        <h1>
                            Search Results
                        </h1>

                        <p>

                            Results for{" "}

                            <strong>
                                "{keyword}"
                            </strong>

                        </p>

                    </div>

                </motion.div>


                {/* ==================================
                    ERROR
                =================================== */}

                {error && (

                    <div className="search-error">
                        {error}
                    </div>

                )}


                {/* ==================================
                    LOADING
                =================================== */}

                {loading ? (

                    <div className="search-loading">

                        <div className="search-spinner" />

                        <p>
                            Searching Marketplace...
                        </p>

                    </div>

                ) : (

                    <>


                        {/* =================================
                            PEOPLE
                        ================================= */}

                        <section className="search-section">

                            <div className="section-heading">

                                <h2>
                                    People
                                </h2>

                                <span>
                                    {users.length}
                                </span>

                            </div>


                            {users.length === 0 ? (

                                <div className="no-results-small">

                                    No users found for{" "}

                                    <strong>
                                        "{keyword}"
                                    </strong>

                                </div>

                            ) : (

                                <div className="user-search-grid">

                                    {users.map(
                                        (person, index) => {

                                            const avatar =
                                                person.profileImage ||
                                                person.avatar ||
                                                person.image ||
                                                null;


                                            const userId =
                                                person._id ||
                                                person.id;


                                            return (

                                                <motion.div
                                                    className="user-search-card"
                                                    key={
                                                        userId ||
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


                                                    {/* AVATAR */}

                                                    <div className="user-search-avatar">

                                                        {avatar ? (

                                                            <img
                                                                src={
                                                                    avatar
                                                                }
                                                                alt={
                                                                    person.name ||
                                                                    "User"
                                                                }
                                                                onError={(
                                                                    e
                                                                ) => {

                                                                    e.currentTarget.style.display =
                                                                        "none";

                                                                }}
                                                            />

                                                        ) : (

                                                            <FaUserCircle />

                                                        )}

                                                    </div>


                                                    {/* INFO */}

                                                    <div className="user-search-info">

                                                        <h3>
                                                            {
                                                                person.name ||
                                                                "Marketplace User"
                                                            }
                                                        </h3>


                                                        <span>
                                                            {
                                                                person.role ||
                                                                "customer"
                                                            }
                                                        </span>


                                                        {person.bio && (

                                                            <p>
                                                                {
                                                                    person.bio
                                                                }
                                                            </p>

                                                        )}

                                                    </div>


                                                    {/* ACTIONS */}

                                                    <div className="user-search-actions">

                                                        {userId && (

                                                            <Link
                                                                to={`/user/${userId}`}
                                                                className="profile-result-btn"
                                                            >
                                                                Profile
                                                            </Link>

                                                        )}


                                                        {userId && (

                                                            <Link
                                                                to={`/messenger?user=${userId}`}
                                                                className="message-result-btn"
                                                            >

                                                                <FaComments />

                                                                Message

                                                            </Link>

                                                        )}

                                                    </div>

                                                </motion.div>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </section>


                        {/* =================================
                            PRODUCTS
                        ================================= */}

                        <section className="search-section">

                            <div className="section-heading">

                                <h2>
                                    Products
                                </h2>

                                <span>
                                    {products.length}
                                </span>

                            </div>


                            {products.length === 0 ? (

                                <div className="no-results">

                                    <FaBoxOpen />

                                    <h3>
                                        No products found
                                    </h3>

                                    <p>
                                        Try searching with
                                        another keyword.
                                    </p>

                                </div>

                            ) : (

                                <motion.div
                                    className="product-grid"
                                    initial={{
                                        opacity: 0
                                    }}
                                    animate={{
                                        opacity: 1
                                    }}
                                >

                                    {products.map(
                                        (
                                            product,
                                            index
                                        ) => (

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
                                                    product={
                                                        product
                                                    }
                                                />

                                            </motion.div>

                                        )
                                    )}

                                </motion.div>

                            )}

                        </section>

                    </>

                )}

            </div>

        </div>

    );

};


export default SearchResults;
