import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import api from "../services/api";

import "../styles/SearchResults.css";


const SearchResults = () => {

    const [searchParams] = useSearchParams();

    const query =
        searchParams.get("q")?.trim() || "";

    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    // =====================================================
    // SEARCH PRODUCTS + USERS
    // =====================================================

    useEffect(() => {

        const searchEverything = async () => {

            if (!query) {

                setProducts([]);
                setUsers([]);
                setLoading(false);

                return;
            }


            setLoading(true);
            setError("");


            try {

                // ==========================================
                // SEARCH PRODUCTS
                // ==========================================

                let productData = [];

                try {

                    const productResponse =
                        await api.get(
                            `/products?keyword=${encodeURIComponent(query)}`
                        );

                    productData =
                        productResponse.data?.products ||
                        productResponse.data?.data ||
                        productResponse.data ||
                        [];

                    if (!Array.isArray(productData)) {
                        productData = [];
                    }

                } catch (productError) {

                    console.error(
                        "Product search error:",
                        productError
                    );

                    productData = [];

                }


                // ==========================================
                // SEARCH USERS
                // ==========================================

                let userData = [];

                try {

                    const userResponse =
                        await api.get(
                            `/users/search?q=${encodeURIComponent(query)}`
                        );


                    userData =
                        userResponse.data?.users ||
                        userResponse.data?.data ||
                        userResponse.data ||
                        [];


                    if (!Array.isArray(userData)) {
                        userData = [];
                    }

                } catch (userError) {

                    console.error(
                        "User search error:",
                        userError
                    );

                    userData = [];

                }


                setProducts(productData);
                setUsers(userData);


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


        searchEverything();

    }, [query]);


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
            api.defaults.baseURL?.replace(
                "/api",
                ""
            ) || "";


        return `${baseURL}${image.startsWith("/") ? "" : "/"}${image}`;

    };


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <div className="search-results-page">

                <div className="search-loading">

                    <h2>
                        Searching...
                    </h2>

                    <p>
                        Finding products and people.
                    </p>

                </div>

            </div>

        );

    }


    // =====================================================
    // ERROR
    // =====================================================

    if (error) {

        return (

            <div className="search-results-page">

                <div className="search-empty">

                    <h2>
                        Search Error
                    </h2>

                    <p>
                        {error}
                    </p>

                </div>

            </div>

        );

    }


    return (

        <div className="search-results-page">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="search-results-header">

                <h1>
                    Search Results
                </h1>

                <p>
                    Results for:
                    <strong>
                        {" "}
                        "{query}"
                    </strong>
                </p>

            </div>



            {/* =================================================
                PEOPLE
            ================================================= */}

            {users.length > 0 && (

                <section className="search-section">

                    <div className="search-section-title">

                        <h2>
                            👤 People
                        </h2>

                        <span>
                            {users.length} found
                        </span>

                    </div>


                    <div className="people-search-grid">

                        {users.map((person) => {

                            const personId =
                                person._id ||
                                person.id;


                            const image =
                                person.profileImage ||
                                person.avatar ||
                                person.image;


                            return (

                                <Link
                                    key={personId}
                                    to={`/user/${personId}`}
                                    className="person-search-card"
                                >

                                    <div className="person-search-avatar">

                                        {image ? (

                                            <img
                                                src={
                                                    getImageUrl(
                                                        image
                                                    )
                                                }
                                                alt={
                                                    person.name ||
                                                    "User"
                                                }
                                            />

                                        ) : (

                                            <span>
                                                {
                                                    person.name
                                                        ?.charAt(0)
                                                        ?.toUpperCase() ||
                                                    "U"
                                                }
                                            </span>

                                        )}

                                    </div>


                                    <div className="person-search-info">

                                        <h3>
                                            {
                                                person.name ||
                                                "User"
                                            }
                                        </h3>


                                        {person.email && (

                                            <p>
                                                {
                                                    person.email
                                                }
                                            </p>

                                        )}


                                        {person.role && (

                                            <span className="person-role">

                                                {
                                                    person.role
                                                }

                                            </span>

                                        )}

                                    </div>

                                </Link>

                            );

                        })}

                    </div>

                </section>

            )}



            {/* =================================================
                PRODUCTS
            ================================================= */}

            {products.length > 0 && (

                <section className="search-section">

                    <div className="search-section-title">

                        <h2>
                            🛍️ Products
                        </h2>

                        <span>
                            {products.length} found
                        </span>

                    </div>


                    <div className="search-products-grid">

                        {products.map((product) => {

                            const productId =
                                product._id ||
                                product.id;


                            const image =
                                product.image ||
                                product.imageUrl ||
                                product.productImage ||
                                (
                                    Array.isArray(
                                        product.images
                                    )
                                        ? product.images[0]
                                        : null
                                );


                            return (

                                <Link
                                    key={productId}
                                    to={`/product/${productId}`}
                                    className="search-product-card"
                                >

                                    <div className="search-product-image">

                                        {image ? (

                                            <img
                                                src={
                                                    getImageUrl(
                                                        image
                                                    )
                                                }
                                                alt={
                                                    product.name ||
                                                    "Product"
                                                }
                                            />

                                        ) : (

                                            <div>
                                                No Image
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
                                                ৳
                                                {
                                                    product.price
                                                }
                                            </strong>

                                        )}

                                    </div>

                                </Link>

                            );

                        })}

                    </div>

                </section>

            )}



            {/* =================================================
                NOTHING FOUND
            ================================================= */}

            {users.length === 0 &&
                products.length === 0 && (

                    <div className="search-empty">

                        <div className="search-empty-icon">
                            🔍
                        </div>

                        <h2>
                            No results found
                        </h2>

                        <p>
                            We couldn't find any
                            person or product matching
                            "{query}".
                        </p>

                    </div>

                )}

        </div>

    );

};


export default SearchResults;
