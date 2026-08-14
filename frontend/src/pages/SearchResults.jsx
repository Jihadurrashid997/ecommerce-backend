import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    Link,
    useSearchParams
} from "react-router-dom";

import {
    FaSearch,
    FaUserCircle,
    FaBoxOpen,
    FaArrowLeft,
    FaComments
} from "react-icons/fa";

import api from "../services/api";

import "../styles/SearchResults.css";


const SearchResults = () => {

    const [searchParams] =
        useSearchParams();

    const keyword =
        (
            searchParams.get("q") ||
            searchParams.get("search") ||
            ""
        ).trim();


    const [users, setUsers] =
        useState([]);

    const [products, setProducts] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [searched, setSearched] =
        useState(false);


    // ==================================================
    // API BASE
    // ==================================================

    const apiBase =
        useMemo(() => {

            return (
                api.defaults.baseURL ||
                ""
            ).replace(/\/api\/?$/, "");

        }, []);


    // ==================================================
    // IMAGE URL
    // ==================================================

    const getImageUrl = (value) => {

        if (!value) {
            return null;
        }

        const image =
            String(value);

        if (
            image.startsWith("http://") ||
            image.startsWith("https://") ||
            image.startsWith("data:")
        ) {

            return image;

        }

        return (
            apiBase +
            (
                image.startsWith("/")
                    ? image
                    : `/${image}`
            )
        );

    };


    // ==================================================
    // NORMALIZE USERS
    // ==================================================

    const normalizeUsers = (response) => {

        const data =
            response?.data;

        if (
            Array.isArray(data)
        ) {
            return data;
        }

        if (
            Array.isArray(
                data?.users
            )
        ) {
            return data.users;
        }

        if (
            Array.isArray(
                data?.data
            )
        ) {
            return data.data;
        }

        if (
            Array.isArray(
                data?.results
            )
        ) {
            return data.results;
        }

        return [];

    };


    // ==================================================
    // NORMALIZE PRODUCTS
    // ==================================================

    const normalizeProducts =
        (response) => {

            const data =
                response?.data;

            if (
                Array.isArray(data)
            ) {
                return data;
            }

            if (
                Array.isArray(
                    data?.products
                )
            ) {
                return data.products;
            }

            if (
                Array.isArray(
                    data?.data
                )
            ) {
                return data.data;
            }

            if (
                Array.isArray(
                    data?.results
                )
            ) {
                return data.results;
            }

            return [];

        };


    // ==================================================
    // SEARCH
    // ==================================================

    useEffect(() => {

        let cancelled = false;

        const runSearch = async () => {

            if (!keyword) {

                setUsers([]);
                setProducts([]);
                setError("");
                setLoading(false);
                setSearched(false);

                return;

            }

            setLoading(true);
            setError("");
            setSearched(false);


            const encoded =
                encodeURIComponent(
                    keyword
                );


            const [
                userResult,
                productResult
            ] =
                await Promise.allSettled([

                    api.get(
                        `/users/search?q=${encoded}`,
                        {
                            timeout: 12000
                        }
                    ),

                    api.get(
                        `/products?keyword=${encoded}`,
                        {
                            timeout: 12000
                        }
                    )

                ]);


            if (cancelled) {
                return;
            }


            let foundUsers = [];
            let foundProducts = [];


            // USERS

            if (
                userResult.status ===
                "fulfilled"
            ) {

                foundUsers =
                    normalizeUsers(
                        userResult.value
                    );

            } else {

                console.error(
                    "User search failed:",
                    userResult.reason
                );

            }


            // PRODUCTS

            if (
                productResult.status ===
                "fulfilled"
            ) {

                foundProducts =
                    normalizeProducts(
                        productResult.value
                    );

            } else {

                console.error(
                    "Product search failed:",
                    productResult.reason
                );

            }


            setUsers(
                Array.isArray(foundUsers)
                    ? foundUsers
                    : []
            );

            setProducts(
                Array.isArray(foundProducts)
                    ? foundProducts
                    : []
            );


            if (
                userResult.status === "rejected" &&
                productResult.status === "rejected"
            ) {

                setError(
                    "Search service is temporarily unavailable."
                );

            }


            setSearched(true);
            setLoading(false);

        };


        runSearch();


        return () => {

            cancelled = true;

        };

    }, [keyword]);


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
                            Search products,
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


    // ==================================================
    // LOADING
    // ==================================================

    if (loading) {

        return (

            <div className="search-results-page">

                <div className="search-results-container">

                    <div className="search-loading">

                        <div className="search-spinner"></div>

                        <h2>
                            Searching Marketplace
                        </h2>

                        <p>
                            Finding products and people...
                        </p>

                    </div>

                </div>

            </div>

        );

    }


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
                                "{keyword}"
                            </strong>
                        </p>

                    </div>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="search-error">

                        {error}

                    </div>

                )}


                {/* ==========================================
                    PEOPLE
                =========================================== */}

                <section className="search-section">

                    <div className="section-heading">

                        <h2>
                            👤 People
                        </h2>

                        <span>
                            {users.length}
                        </span>

                    </div>


                    {users.length === 0 ? (

                        <div className="no-results-small">

                            No people found for{" "}
                            <strong>
                                "{keyword}"
                            </strong>

                        </div>

                    ) : (

                        <div className="user-search-grid">

                            {users.map(
                                (person) => {

                                    const id =
                                        person._id ||
                                        person.id;

                                    const avatar =
                                        person.profileImage ||
                                        person.avatar ||
                                        person.image;


                                    if (!id) {
                                        return null;
                                    }


                                    return (

                                        <div
                                            key={id}
                                            className="user-search-card"
                                        >

                                            <div className="user-search-avatar">

                                                {avatar ? (

                                                    <img
                                                        src={
                                                            getImageUrl(
                                                                avatar
                                                            )
                                                        }
                                                        alt={
                                                            person.name ||
                                                            "User"
                                                        }
                                                        onError={(e) => {

                                                            e.currentTarget.style.display =
                                                                "none";

                                                            if (
                                                                e.currentTarget
                                                                    .nextSibling
                                                            ) {

                                                                e.currentTarget
                                                                    .nextSibling
                                                                    .style.display =
                                                                    "flex";

                                                            }

                                                        }}
                                                    />

                                                ) : null}


                                                <FaUserCircle
                                                    style={{
                                                        display:
                                                            avatar
                                                                ? "none"
                                                                : "block"
                                                    }}
                                                />

                                            </div>


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
                                                        {person.bio}
                                                    </p>

                                                )}

                                                {person.location && (

                                                    <small>
                                                        📍{" "}
                                                        {
                                                            person.location
                                                        }
                                                    </small>

                                                )}

                                            </div>


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

                                }
                            )}

                        </div>

                    )}

                </section>


                {/* ==========================================
                    PRODUCTS
                =========================================== */}

                <section className="search-section">

                    <div className="section-heading">

                        <h2>
                            🛍️ Products
                        </h2>

                        <span>
                            {products.length}
                        </span>

                    </div>


                    {products.length === 0 ? (

                        <div className="no-results-small">

                            <FaBoxOpen />

                            <p>
                                No products found for{" "}
                                <strong>
                                    "{keyword}"
                                </strong>
                            </p>

                        </div>

                    ) : (

                        <div className="product-grid">

                            {products.map(
                                (product) => {

                                    const id =
                                        product._id ||
                                        product.id;

                                    if (!id) {
                                        return null;
                                    }

                                    return (

                                        <Link
                                            key={id}
                                            to={`/product/${id}`}
                                            className="search-product-card"
                                        >

                                            <div className="search-product-image">

                                                {product.image ||
                                                product.imageUrl ||
                                                product.productImage ||
                                                (
                                                    Array.isArray(
                                                        product.images
                                                    )
                                                        ? product.images[0]
                                                        : null
                                                ) ? (

                                                    <img
                                                        src={
                                                            getImageUrl(
                                                                product.image ||
                                                                product.imageUrl ||
                                                                product.productImage ||
                                                                product.images?.[0]
                                                            )
                                                        }
                                                        alt={
                                                            product.name ||
                                                            product.title ||
                                                            "Product"
                                                        }
                                                    />

                                                ) : (

                                                    <div>
                                                        📦
                                                    </div>

                                                )}

                                            </div>


                                            <div className="search-product-info">

                                                <h3>
                                                    {
                                                        product.name ||
                                                        product.title ||
                                                        "Product"
                                                    }
                                                </h3>

                                                {product.price !== undefined && (

                                                    <strong>
                                                        ৳{" "}
                                                        {
                                                            product.price
                                                        }
                                                    </strong>

                                                )}

                                                {product.category && (

                                                    <small>
                                                        {
                                                            product.category
                                                        }
                                                    </small>

                                                )}

                                            </div>

                                        </Link>

                                    );

                                }
                            )}

                        </div>

                    )}

                </section>


                {/* NOTHING */}

                {searched &&
                    users.length === 0 &&
                    products.length === 0 &&
                    !error && (

                        <div className="no-results">

                            <FaSearch />

                            <h2>
                                Nothing Found
                            </h2>

                            <p>
                                Try another name,
                                email or product keyword.
                            </p>

                        </div>

                    )}

            </div>

        </div>

    );

};


export default SearchResults;
