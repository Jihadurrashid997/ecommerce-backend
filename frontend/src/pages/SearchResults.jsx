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
    FaArrowLeft,
    FaStore
} from "react-icons/fa";

import { motion } from "framer-motion";

import api from "../services/api";

import ProductCard from "../components/ProductCard";

import "../styles/SearchResults.css";


const SearchResults = () => {

    const [searchParams] =
        useSearchParams();


    // Supports both:
    // /search?q=jisan
    // /search?search=jisan

    const keyword =
        (
            searchParams.get("q") ||
            searchParams.get("search") ||
            ""
        ).trim();


    const [products, setProducts] =
        useState([]);

    const [users, setUsers] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    // ==================================================
    // SEARCH
    // ==================================================

    useEffect(() => {

        if (!keyword) {

            setProducts([]);
            setUsers([]);
            setLoading(false);

            return;

        }

        searchEverything();

    }, [keyword]);


    // ==================================================
    // SEARCH PRODUCTS + USERS
    // ==================================================

    const searchEverything = async () => {

        try {

            setLoading(true);
            setError("");


            const encoded =
                encodeURIComponent(
                    keyword
                );


            const [
                productResponse,
                userResponse
            ] = await Promise.allSettled([

                api.get(
                    `/products?keyword=${encoded}&search=${encoded}`
                ),

                api.get(
                    `/users/search?q=${encoded}`
                )

            ]);


            // ==================================================
            // PRODUCTS
            // ==================================================

            if (
                productResponse.status ===
                "fulfilled"
            ) {

                const data =
                    productResponse.value.data;


                const productList =
                    Array.isArray(data)
                        ? data
                        : data?.products || [];


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


            // ==================================================
            // USERS
            // ==================================================

            if (
                userResponse.status ===
                "fulfilled"
            ) {

                const data =
                    userResponse.value.data;


                const userList =
                    Array.isArray(data)
                        ? data
                        : data?.users || [];


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


            // ==================================================
            // BOTH FAILED
            // ==================================================

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

            console.error(
                "Search error:",
                err
            );

            setError(
                "Something went wrong while searching."
            );

        } finally {

            setLoading(false);

        }

    };


    // ==================================================
    // NO KEYWORD
    // ==================================================

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

        <motion.div
            className="search-results-page"

            initial={{
                opacity: 0
            }}

            animate={{
                opacity: 1
            }}

            transition={{
                duration: 0.5
            }}
        >

            <div className="search-results-container">


                {/* ==================================================
                    HEADER
                ================================================== */}

                <div className="search-results-header">

                    <motion.div
                        animate={{
                            rotate: [0, 8, -8, 0]
                        }}

                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 4
                        }}
                    >

                        <FaSearch />

                    </motion.div>


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

                </div>


                {/* ==================================================
                    ERROR
                ================================================== */}

                {error && (

                    <div className="search-error">

                        {error}

                        <button
                            onClick={
                                searchEverything
                            }
                        >
                            Try Again
                        </button>

                    </div>

                )}


                {/* ==================================================
                    LOADING
                ================================================== */}

                {loading ? (

                    <div className="search-loading">

                        <motion.div
                            className="search-spinner"

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
                            Searching Marketplace...
                        </p>

                    </div>

                ) : (

                    <>


                        {/* ==================================================
                            PEOPLE
                        ================================================== */}

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


                                            return (

                                                <motion.div

                                                    className="user-search-card"

                                                    key={
                                                        person._id
                                                    }

                                                    initial={{
                                                        opacity: 0,
                                                        y: 25
                                                    }}

                                                    animate={{
                                                        opacity: 1,
                                                        y: 0
                                                    }}

                                                    transition={{
                                                        delay:
                                                            index *
                                                            0.08
                                                    }}
                                                >


                                                    {/* AVATAR */}

                                                    <Link
                                                        to={`/user/${person._id}`}
                                                        className="user-search-avatar"
                                                    >

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

                                                                    e.currentTarget.parentElement.classList.add(
                                                                        "avatar-fallback"
                                                                    );

                                                                }}
                                                            />

                                                        ) : (

                                                            <FaUserCircle />

                                                        )}

                                                    </Link>


                                                    {/* INFO */}

                                                    <div className="user-search-info">

                                                        <Link
                                                            to={`/user/${person._id}`}
                                                        >

                                                            <h3>

                                                                {person.name ||
                                                                    "Marketplace User"}

                                                            </h3>

                                                        </Link>


                                                        <span>

                                                            {person.role ||
                                                                "customer"}

                                                        </span>


                                                        {person.location && (

                                                            <small>
                                                                📍{" "}
                                                                {person.location}
                                                            </small>

                                                        )}


                                                        {person.bio && (

                                                            <p>
                                                                {person.bio}
                                                            </p>

                                                        )}

                                                    </div>


                                                    {/* ACTIONS */}

                                                    <div className="user-search-actions">

                                                        <Link
                                                            to={`/user/${person._id}`}
                                                            className="profile-result-btn"
                                                        >

                                                            <FaUserCircle />

                                                            Profile

                                                        </Link>


                                                        <Link
                                                            to={`/messenger?user=${person._id}`}
                                                            className="message-result-btn"
                                                        >

                                                            <FaComments />

                                                            Message

                                                        </Link>

                                                    </div>

                                                </motion.div>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </section>


                        {/* ==================================================
                            PRODUCTS
                        ================================================== */}

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
                                        Try another product
                                        name or keyword.
                                    </p>

                                </div>

                            ) : (

                                <div className="product-grid">

                                    {products.map(
                                        (
                                            product,
                                            index
                                        ) => (

                                            <motion.div
                                                key={
                                                    product._id
                                                }

                                                initial={{
                                                    opacity: 0,
                                                    y: 30
                                                }}

                                                animate={{
                                                    opacity: 1,
                                                    y: 0
                                                }}

                                                transition={{
                                                    delay:
                                                        index *
                                                        0.05
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

                                </div>

                            )}

                        </section>


                    </>

                )}

            </div>

        </motion.div>

    );

};


export default SearchResults;
