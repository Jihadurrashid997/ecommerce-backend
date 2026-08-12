import React, { useEffect, useState } from "react";
import {
    Link,
    useSearchParams
} from "react-router-dom";

import {
    FaUserCircle,
    FaSearch,
    FaComments,
    FaBoxOpen
} from "react-icons/fa";

import api from "../services/api";

import ProductCard from "../components/ProductCard";

import "../styles/SearchResults.css";

const SearchResults = () => {

    const [searchParams] =
        useSearchParams();

    const keyword =
        searchParams.get("q") || "";


    const [products, setProducts] =
        useState([]);

    const [users, setUsers] =
        useState([]);

    const [loading, setLoading] =
        useState(true);


    useEffect(() => {

        if (!keyword.trim()) {

            setProducts([]);
            setUsers([]);
            setLoading(false);

            return;
        }

        searchEverything();

    }, [keyword]);


    const searchEverything = async () => {

        try {

            setLoading(true);


            const [
                productResponse,
                userResponse
            ] = await Promise.all([

                api.get(
                    `/products?keyword=${encodeURIComponent(
                        keyword
                    )}`
                ),

                api.get(
                    `/users/search?q=${encodeURIComponent(
                        keyword
                    )}`
                )

            ]);


            setProducts(
                productResponse.data || []
            );

            setUsers(
                userResponse.data || []
            );


        } catch (err) {

            console.error(
                "Search error:",
                err
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="search-results-page">

            <div className="search-results-container">


                {/* ==========================
                    HEADER
                =========================== */}

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


                {loading ? (

                    <div className="search-loading">
                        Searching...
                    </div>

                ) : (

                    <>


                        {/* ==========================
                            PEOPLE
                        =========================== */}

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

                                    No users found.

                                </div>

                            ) : (

                                <div className="user-search-grid">

                                    {users.map(
                                        (person) => (

                                            <div
                                                className="user-search-card"
                                                key={
                                                    person._id
                                                }
                                            >

                                                <div className="user-search-avatar">

                                                    {person.profileImage ? (

                                                        <img
                                                            src={
                                                                person.profileImage
                                                            }
                                                            alt={
                                                                person.name
                                                            }
                                                        />

                                                    ) : (

                                                        <FaUserCircle />

                                                    )}

                                                </div>


                                                <div className="user-search-info">

                                                    <h3>
                                                        {person.name}
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

                                        )
                                    )}

                                </div>

                            )}

                        </section>


                        {/* ==========================
                            PRODUCTS
                        =========================== */}

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
