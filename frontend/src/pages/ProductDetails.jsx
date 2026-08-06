import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/ProductDetails.css";

const ProductDetails = () => {

    const { id } = useParams();

    const [product, setProduct] = useState(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        fetchProduct();

    }, []);

    const fetchProduct = async () => {

        try{

            const res = await api.get(`/products/${id}`);

            setProduct(res.data);

        }

        catch(err){

            console.log(err);

        }

        finally{

            setLoading(false);

        }

    };

    if(loading){

        return(

            <div className="loader"></div>

        );

    }

    if(!product){

        return(

            <h2 style={{textAlign:"center"}}>

                Product Not Found

            </h2>

        );

    }

    return(

        <div className="product-details">

            <div className="product-left">

                <img

                src={product.image}

                alt={product.name}

                />

            </div>

            <div className="product-right">

                <h1>

                    {product.name}

                </h1>

                <h2>

                    ৳ {product.price}

                </h2>

                <p>

                    {product.description}

                </p>

                <button className="buy-btn">

                    Buy Now

                </button>

                <button className="cart-btn">

                    Add To Cart

                </button>

                <button className="wish-btn">

                    Add To Wishlist

                </button>

            </div>

        </div>

    );

};

export default ProductDetails;
