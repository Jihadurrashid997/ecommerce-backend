import React, {
    useEffect,
    useState
} from "react";

import {
    useSearchParams,
    Link
} from "react-router-dom";

import {
    FaUser,
    FaEnvelope,
    FaMapMarkerAlt,
    FaSearch
} from "react-icons/fa";

import api from "../services/api";

import "../styles/App.css";


const SearchResults = () => {

    const [
        searchParams
    ] = useSearchParams();


    const query =
        searchParams.get("q") || "";


    const [
        users,
        setUsers
    ] = useState([]);


    const [
        products,
        setProducts
    ] = useState([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState("");


    // ==========================
    // SEARCH
    // ==========================

    useEffect(() => {

        const search =
            async () => {

                if (!query.trim()) {

                    setUsers([]);
                    setProducts([]);
                    setLoading(false);

                    return;

                }


                try {

                    setLoading(true);
                    setError("");


                    // ==========================
                    // SEARCH USERS
                    // ==========================

                    const userResponse =
                        await api.get(
                            `/users/search?q=${encodeURIComponent(
                                query.trim()
                            )}`
                        );


                    const userData =
                        userResponse.data?.users ||
                        userResponse.data?.data ||
                        userResponse.data ||
                        [];


                    setUsers(
                        Array.isArray(userData)
                            ? userData
                            : []
                    );


                    // ==========================
                    // SEARCH PRODUCTS
                    // ==========================

                    try {

                        const productResponse =
                            await api.get(
                                `/products/search?q=${encodeURIComponent(
                                    query.trim()
                                )}`
                            );


                        const productData =
                            productResponse.data?.products ||
                            productResponse.data?.data ||
                            productResponse.data ||
                            [];


                        setProducts(
                            Array.isArray(productData)
                                ? productData
                                : []
                        );

                    } catch (productError) {

                        // Product search route
                        // না থাকলেও user search
                        // কাজ করবে।

                        console.log(
                            "Product search unavailable:",
                            productError
                        );

                        setProducts([]);

                    }


                } catch (err) {

                    console.error(
                        "Search error:",
                        err
                    );

                    setError(
                        err.response?.data?.message ||
                        "Search failed"
                    );

                    setUsers([]);
                    setProducts([]);

                } finally {

                    setLoading(false);

                }

            };


        search();

    }, [query]);


    // ==========================
    // PROFILE IMAGE
    // ==========================

    const getProfileImage = (
        item
    ) => {

        return (
            item.profileImage ||
            item.avatar ||
            item.image ||
            ""
        );

    };


    // ==========================
    // IMAGE URL
    // ==========================

    const getImageUrl = (
        image
    ) => {

        if (!image) {
            return "";
        }

        if (
            image.startsWith("http://") ||
            image.startsWith("https://")
        ) {

            return image;

        }


        const baseURL =
            process.env.REACT_APP_API_URL
                ? process.env.REACT_APP_API_URL.replace(
                    "/api",
                    ""
                )
                : window.location.origin;


        return `${baseURL}${image.startsWith("/") ? "" : "/"}${image}`;

    };


    return (

        <div
            className="container"
            style={{
                paddingTop: "120px",
                paddingBottom: "60px",
                minHeight: "70vh"
            }}
        >


            {/* ==========================
                HEADER
            ========================== */}

            <div
                style={{
                    marginBottom: "30px"
                }}
            >

                <h1>
                    Search Results
                </h1>


                <p>

                    Search for:

                    <strong>
                        {" "}
                        "{query}"
                    </strong>

                </p>

            </div>


            {/* ==========================
                LOADING
            ========================== */}

            {loading && (

                <div>

                    <h3>
                        Searching...
                    </h3>

                </div>

            )}


            {/* ==========================
                ERROR
            ========================== */}

            {!loading && error && (

                <div>

                    <h3>
                        {error}
                    </h3>

                </div>

            )}


            {!loading &&
                !error &&
                query && (

                <>


                    {/* ==========================
                        PEOPLE
                    ========================== */}

                    <section
                        style={{
                            marginBottom: "45px"
                        }}
                    >

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "20px"
                            }}
                        >

                            <FaUser />

                            <h2>
                                People
                            </h2>

                            <span>
                                ({users.length})
                            </span>

                        </div>


                        {users.length === 0 ? (

                            <div
                                style={{
                                    padding: "25px",
                                    borderRadius: "15px",
                                    background:
                                        "rgba(255,255,255,0.05)"
                                }}
                            >

                                <p>
                                    No people found for "{query}".
                                </p>

                            </div>

                        ) : (

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fill, minmax(280px, 1fr))",
                                    gap: "20px"
                                }}
                            >

                                {users.map(
                                    person => {

                                        const id =
                                            person._id ||
                                            person.id;


                                        const image =
                                            getProfileImage(
                                                person
                                            );


                                        return (

                                            <Link
                                                key={id}
                                                to={`/user/${id}`}
                                                style={{
                                                    textDecoration:
                                                        "none",
                                                    color:
                                                        "inherit"
                                                }}
                                            >

                                                <div
                                                    style={{
                                                        padding: "20px",
                                                        borderRadius:
                                                            "18px",
                                                        border:
                                                            "1px solid rgba(255,255,255,0.1)",
                                                        display:
                                                            "flex",
                                                        alignItems:
                                                            "center",
                                                        gap: "15px",
                                                        cursor:
                                                            "pointer"
                                                    }}
                                                >

                                                    {/* AVATAR */}

                                                    {image ? (

                                                        <img
                                                            src={getImageUrl(
                                                                image
                                                            )}
                                                            alt={
                                                                person.name
                                                            }
                                                            style={{
                                                                width:
                                                                    "60px",
                                                                height:
                                                                    "60px",
                                                                borderRadius:
                                                                    "50%",
                                                                objectFit:
                                                                    "cover"
                                                            }}
                                                        />

                                                    ) : (

                                                        <div
                                                            style={{
                                                                width:
                                                                    "60px",
                                                                height:
                                                                    "60px",
                                                                borderRadius:
                                                                    "50%",
                                                                display:
                                                                    "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "center",
                                                                fontSize:
                                                                    "22px",
                                                                fontWeight:
                                                                    "700",
                                                                background:
                                                                    "#333"
                                                            }}
                                                        >

                                                            {
                                                                person.name
                                                                    ?.charAt(
                                                                        0
                                                                    )
                                                                    ?.toUpperCase() ||
                                                                "U"
                                                            }

                                                        </div>

                                                    )}


                                                    {/* INFO */}

                                                    <div>

                                                        <h3
                                                            style={{
                                                                margin:
                                                                    "0 0 6px"
                                                            }}
                                                        >

                                                            {
                                                                person.name ||
                                                                "User"
                                                            }

                                                        </h3>


                                                        {person.email && (

                                                            <p
                                                                style={{
                                                                    margin:
                                                                        "3px 0",
                                                                    opacity:
                                                                        0.75
                                                                }}
                                                            >

                                                                <FaEnvelope />
                                                                {" "}
                                                                {
                                                                    person.email
                                                                }

                                                            </p>

                                                        )}


                                                        {person.location && (

                                                            <p
                                                                style={{
                                                                    margin:
                                                                        "3px 0",
                                                                    opacity:
                                                                        0.75
                                                                }}
                                                            >

                                                                <FaMapMarkerAlt />
                                                                {" "}
                                                                {
                                                                    person.location
                                                                }

                                                            </p>

                                                        )}

                                                    </div>

                                                </div>

                                            </Link>

                                        );

                                    }
                                )}

                            </div>

                        )}

                    </section>


                    {/* ==========================
                        PRODUCTS
                    ========================== */}

                    <section>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "20px"
                            }}
                        >

                            <FaSearch />

                            <h2>
                                Products
                            </h2>

                            <span>
                                ({products.length})
                            </span>

                        </div>


                        {products.length === 0 ? (

                            <p>
                                No products found.
                            </p>

                        ) : (

                            <div
                                className="product-grid"
                            >

                                {products.map(
                                    product => (

                                        <Link
                                            key={
                                                product._id ||
                                                product.id
                                            }
                                            to={`/product/${
                                                product._id ||
                                                product.id
                                            }`}
                                        >

                                            <div
                                                className="product-card"
                                            >

                                                <h3>
                                                    {
                                                        product.name
                                                    }
                                                </h3>

                                                {product.price && (

                                                    <p>
                                                        ৳{
                                                            product.price
                                                        }
                                                    </p>

                                                )}

                                            </div>

                                        </Link>

                                    )
                                )}

                            </div>

                        )}

                    </section>

                </>

            )}


            {!loading &&
                !query && (

                <div>

                    <h3>
                        Type something to search.
                    </h3>

                </div>

            )}

        </div>

    );

};


export default SearchResults;
