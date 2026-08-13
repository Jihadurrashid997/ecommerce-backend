import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
    FaUserCircle,
    FaSearch,
    FaComments,
    FaBoxOpen,
    FaArrowLeft
} from "react-icons/fa";

import api from "../services/api";

import ProductCard from "../components/ProductCard";

import "../styles/SearchResults.css";


const SearchResults = () => {

    const [searchParams] = useSearchParams();

    const keyword =
        searchParams.get("q")?.trim() || "";


    const [products, setProducts] =
        useState([]);

    const [users, setUsers] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    // ========================================
    // SEARCH
    // ========================================

    useEffect(() => {

        if (!keyword) {

            setProducts([]);
            setUsers([]);
            setLoading(false);

            return;
        }

        searchEverything();

    }, [keyword]);


    // ========================================
    // SEARCH PRODUCTS + USERS
    // ========================================

    const searchEverything = async () => {

        try {

            setLoading(true);
            setError("");


            const encodedKeyword =
                encodeURIComponent(keyword);


            const requests = [

                api.get(
                    `/products?keyword=${encodedKeyword}`
                ),

                api.get(
                    `/users/search?q=${encodedKeyword}`
                )

            ];


            const [
                productResponse,
                userResponse
            ] = await Promise.allSettled(
                requests
            );


            // ====================================
            // PRODUCTS
            // ====================================

            if (
                productResponse.status ===
                "fulfilled"
            ) {

                const productData =
                    productResponse.value.data;

                setProducts(
                    Array.isArray(productData)
                        ? productData
                        : productData?.products || []
                );

            } else {

                console.error(
                    "Product search failed:",
                    productResponse.reason
                );

                setProducts([]);

            }


            // ====================================
            // USERS
            // ====================================

            if (
                userResponse.status ===
                "fulfilled"
            ) {

                const userData =
                    userResponse.value.data;

                setUsers(
                    Array.isArray(userData)
                        ? userData
                        : userData?.users || []
                );

            } else {

                console.error(
                    "User search failed:",
                    userResponse.reason
                );

                setUsers([]);

            }


            // ====================================
            // BOTH REQUESTS FAILED
            // ====================================

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


    // ========================================
    // NO SEARCH KEYWORD
    // ========================================

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


                {/* =================================
                    HEADER
                ================================= */}

                <div className="search-results-header">

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

                </div>


                {/* =================================
                    ERROR
                ================================= */}

                {error && (

                    <div className="search-error">

                        {error}

                    </div>

                )}


                {/* =================================
                    LOADING
                ================================= */}

                {loading ? (

                    <div className="search-loading">

                        <div className="search-spinner"></div>

                        <p>
                            Searching Marketplace...
                        </p>

                    </div>

                ) : (

                    <>


                        {/* =============================
                            PEOPLE
                        ============================== */}

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
                                        (person) => {

                                            const avatar =
                                                person.profileImage ||
                                                person.avatar ||
                                                person.image ||
                                                null;


                                            return (

                                                <div
                                                    className="user-search-card"
                                                    key={
                                                        person._id
                                                    }
                                                >


                                                    {/* AVATAR */}

                                                    <div className="user-search-avatar">

                                                        {avatar ? (

                                                            <img
                                                                src={avatar}
                                                                alt={
                                                                    person.name ||
                                                                    "User"
                                                                }
                                                            />

                                                        ) : (

                                                            <FaUserCircle />

                                                        )}

                                                    </div>


                                                    {/* INFO */}

                                                    <div className="user-search-info">

                                                        <h3>

                                                            {person.name ||
                                                                "Marketplace User"}

                                                        </h3>


                                                        <span>

                                                            {person.role ||
                                                                "customer"}

                                                        </span>


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

                                                </div>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </section>


                        {/* =============================
                            PRODUCTS
                        ============================== */}

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

                                <div className="product-grid">

                                    {products.map(
                                        (product) => (

                                            <ProductCard
                                                key={
                                                    product._id
                                                }
                                                product={
                                                    product
                                                }
                                            />

                                        )
                                    )}

                                </div>

                            )}

                        </section>


                    </>

                )}

            </div>

        </div>

    );

};


export default SearchResults;
