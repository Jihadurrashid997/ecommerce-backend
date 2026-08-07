import React, { useEffect, useState } from "react";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import "../styles/Home.css";

const Home = () => {

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [keyword, setKeyword] = useState("");
    const [category, setCategory] = useState("");

    const [page, setPage] = useState(1);

    const productsPerPage = 8;

    useEffect(() => {

        fetchProducts();

    }, [keyword, category]);

    const fetchProducts = async () => {

        try {

            setLoading(true);

            const res = await api.get(

                `/products?keyword=${keyword}&category=${category}`

            );

            setProducts(res.data);

        } catch (err) {

            console.log(err);

        } finally {

            setLoading(false);

        }

    };

    const lastIndex = page * productsPerPage;
    const firstIndex = lastIndex - productsPerPage;

    const currentProducts = products.slice(firstIndex, lastIndex);

    const totalPages = Math.ceil(products.length / productsPerPage);

    if (loading) {

        return <div className="loader"></div>;

    }

    return (

        <div className="container">

            <h1 className="title">

                Marketplace

            </h1>

            <div className="filter-bar">

                <input

                    type="text"

                    placeholder="Search products..."

                    value={keyword}

                    onChange={(e)=>{

                        setKeyword(e.target.value);

                        setPage(1);

                    }}

                />

                <select

                    value={category}

                    onChange={(e)=>{

                        setCategory(e.target.value);

                        setPage(1);

                    }}

                >

                    <option value="">All Categories</option>

                    <option value="Electronics">Electronics</option>

                    <option value="Fashion">Fashion</option>

                    <option value="Books">Books</option>

                    <option value="Sports">Sports</option>

                    <option value="Home">Home</option>

                </select>

            </div>

            <div className="product-grid">

                {

                    currentProducts.map(product=>(

                        <ProductCard

                            key={product._id}

                            product={product}

                        />

                    ))

                }

            </div>

            <div className="pagination">

                <button

                    disabled={page===1}

                    onClick={()=>setPage(page-1)}

                >

                    Previous

                </button>

                <span>

                    {page} / {totalPages || 1}

                </span>

                <button

                    disabled={page===totalPages || totalPages===0}

                    onClick={()=>setPage(page+1)}

                >

                    Next

                </button>

            </div>

        </div>

    );

};

export default Home;
