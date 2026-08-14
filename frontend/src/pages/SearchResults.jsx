import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    FaSearch,
    FaUserCircle,
    FaComments,
    FaBoxOpen,
    FaArrowLeft,
    FaTimes
} from "react-icons/fa";

import api from "../services/api";
import ProductCard from "../components/ProductCard";

import "../styles/SearchResults.css";


const SearchResults = () => {

    const [searchParams] = useSearchParams();

    const query =
        (searchParams.get("q") || "").trim();


    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    // =====================================================
    // IMAGE URL
    // =====================================================

    const getImageUrl = (image) => {

        if (!image) {
            return null;
        }

        if (
            image.startsWith("http://") ||
            image.startsWith("https://")
        ) {
            return image;
        }

        const baseURL =
            api.defaults.baseURL
                ?.replace("/api", "") || "";

        return `${baseURL}${
            image.startsWith("/")
                ? ""
                : "/"
        }${image}`;

    };


    // =====================================================
    // SEARCH
    // =====================================================

    useEffect(() => {

        let cancelled = false;


        const runSearch = async () => {

            if (!query) {

                setProducts([]);
                setUsers([]);
                setLoading(false);

                return;
            }


            setLoading(true);
            setError("");


            // -------------------------------------------------
            // PRODUCTS
            // -------------------------------------------------

            const productRequest =
                api.get(
                    `/products?keyword=${encodeURIComponent(query)}`
                );


            // -------------------------------------------------
            // USERS
            //
            // We use /chat-users as the primary directory.
            // This avoids the old search endpoint problem.
            // -------------------------------------------------

            const userRequest =
                api.get("/users/chat-users");


            const [
                productResult,
                userResult
            ] = await Promise.allSettled([
                productRequest,
                userRequest
            ]);


            if (cancelled) {
                return;
            }


            // =================================================
            // PRODUCTS
            // =================================================

            if (
                productResult.status ===
                "fulfilled"
            ) {

                const data =
                    productResult.value.data;

                const list =
                    Array.isArray(data)
                        ? data
                        : data?.products ||
                          data?.data ||
                          [];

                setProducts(
                    Array.isArray(list)
                        ? list
                        : []
                );

            } else {

                console.error(
                    "Product search error:",
                    productResult.reason
                );

                setProducts([]);

            }


            // =================================================
            // USERS
            // =================================================

            if (
                userResult.status ===
                "fulfilled"
            ) {

                const response =
                    userResult.value.data;

                const allUsers =
                    response?.users ||
                    response?.data ||
                    response ||
                    [];


                const userList =
                    Array.isArray(allUsers)
                        ? allUsers
                        : [];


                const search =
                    query.toLowerCase();


                const matchedUsers =
                    userList.filter(
                        person => {

                            const name =
                                String(
                                    person.name ||
                                    ""
                                ).toLowerCase();

                            const email =
                                String(
                                    person.email ||
                                    ""
                                ).toLowerCase();

                            const role =
                                String(
                                    person.role ||
                                    ""
                                ).toLowerCase();

                            const bio =
                                String(
                                    person.bio ||
                                    ""
                                ).toLowerCase();

                            const location =
                                String(
                                    person.location ||
                                    ""
                                ).toLowerCase();


                            return (
                                name.includes(search) ||
                                email.includes(search) ||
                                role.includes(search) ||
                                bio.includes(search) ||
                                location.includes(search)
                            );

                        }
                    );


                setUsers(matchedUsers);

            } else {

                console.error(
                    "User directory error:",
                    userResult.reason
                );

                setUsers([]);

            }


            if (
                productResult.status ===
                    "rejected" &&
                userResult.status ===
                    "rejected"
            ) {

                setError(
                    "Search service is temporarily unavailable."
                );

            }


            setLoading(false);

        };


        runSearch();


        return () => {
            cancelled = true;
        };

    }, [query]);


    // =====================================================
    // RESULT COUNT
    // =====================================================

    const totalResults =
        useMemo(
            () =>
                users.length +
                products.length,
            [
                users.length,
                products.length
            ]
        );


    // =====================================================
    // NO QUERY
    // =====================================================

    if (!query) {

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
                            sellers and people.
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


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <div className="search-results-page">

                <div className="search-results-container">

                    <div className="search-loading">

                        <div className="search-spinner"></div>

                        <h2>
                            Searching Marketplace...
                        </h2>

                        <p>
                            Finding products and people.
                        </p>

                    </div>

                </div>

            </div>

        );

    }


    // =====================================================
    // PAGE
    // =====================================================

    return (

        <div className="search-results-page">

            <div className="search-results-container">


                {/* HEADER */}

                <div className="search-results-header">

                    <FaSearch />

                    <div>

                        <h1>
                            Search Results
                        </h1>

                        <p>

                            Results for{" "}

                            <strong>
                                "{query}"
                            </strong>

                            {" • "}

                            {totalResults} results

                        </p>

                    </div>

                    <Link
                        to="/"
                        className="search-back-button"
                        title="Back"
                    >
                        <FaTimes />
                    </Link>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="search-error">
                        {error}
                    </div>

                )}


                {/* =================================================
                    PEOPLE
                ================================================= */}

                <section className="search-section">

                    <div className="section-heading">

                        <h2>
                            <FaUserCircle />
                            People
                        </h2>

                        <span>
                            {users.length}
                        </span>

                    </div>


                    {users.length === 0 ? (

                        <div className="no-results-small">

                            No people found for{" "}

                            <strong>
                                "{query}"
                            </strong>

                        </div>

                    ) : (

                        <div className="user-search-grid">

                            {users.map(person => {

                                const id =
                                    person._id ||
                                    person.id;

                                const image =
                                    person.profileImage ||
                                    person.avatar ||
                                    person.image;


                                return (

                                    <div
                                        className="user-search-card"
                                        key={id}
                                    >

                                        <Link
                                            to={`/user/${id}`}
                                            className="user-search-main"
                                        >

                                            <div className="user-search-avatar">

                                                {image ? (

                                                    <img
                                                        src={getImageUrl(image)}
                                                        alt={
                                                            person.name ||
                                                            "User"
                                                        }
                                                        onError={e => {
                                                            e.currentTarget.style.display =
                                                                "none";
                                                        }}
                                                    />

                                                ) : (

                                                    <FaUserCircle />

                                                )}

                                            </div>


                                            <div className="user-search-info">

                                                <h3>
                                                    {
                                                        person.name ||
                                                        "Marketplace User"
                                                    }
                                                </h3>

                                                {person.email && (

                                                    <p>
                                                        {person.email}
                                                    </p>

                                                )}

                                                <span>
                                                    {
                                                        person.role ||
                                                        "customer"
                                                    }
                                                </span>

                                                {person.location && (

                                                    <small>
                                                        📍{" "}
                                                        {
                                                            person.location
                                                        }
                                                    </small>

                                                )}

                                            </div>

                                        </Link>


                                        <div className="user-search-actions">

                                            <Link
                                                to={`/user/${id}`}
                                                className="profile-result-btn"
                                            >
                                                Profile
                                            </Link>


                                            <Link
                                                to={`/messenger?user=${id}`}
                                                className="message-result-btn"
                                            >
                                                <FaComments />
                                                Message
                                            </Link>

                                        </div>

                                    </div>

                                );

                            })}

                        </div>

                    )}

                </section>


                {/* =================================================
                    PRODUCTS
                ================================================= */}

                <section className="search-section">

                    <div className="section-heading">

                        <h2>
                            <FaBoxOpen />
                            Products
                        </h2>

                        <span>
                            {products.length}
                        </span>

                    </div>


                    {products.length === 0 ? (

                        <div className="no-results-small">

                            No products found for{" "}

                            <strong>
                                "{query}"
                            </strong>

                        </div>

                    ) : (

                        <div className="product-grid">

                            {products.map(product => (

                                <ProductCard
                                    key={
                                        product._id ||
                                        product.id
                                    }
                                    product={product}
                                />

                            ))}

                        </div>

                    )}

                </section>


                {/* NOTHING */}

                {users.length === 0 &&
                    products.length === 0 && (

                        <div className="search-empty">

                            <FaSearch />

                            <h2>
                                No results found
                            </h2>

                            <p>
                                Try another name,
                                product or keyword.
                            </p>

                            <Link to="/">
                                Back to Marketplace
                            </Link>

                        </div>

                    )}

            </div>

        </div>

    );

};


export default SearchResults;
