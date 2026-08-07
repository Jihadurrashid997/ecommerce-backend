import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import "../styles/Dashboard.css";

const EditProduct = () => {

    const { id } = useParams();

    const navigate = useNavigate();

    const [form, setForm] = useState({
        name:"",
        description:"",
        price:"",
        category:"",
        image:"",
        stock:""
    });

    useEffect(()=>{

        loadProduct();

    },[]);

    const loadProduct = async()=>{

        try{

            const res = await api.get(`/products/${id}`);

            setForm(res.data);

        }

        catch(err){

            console.log(err);

        }

    };

    const handleChange=(e)=>{

        setForm({

            ...form,

            [e.target.name]:e.target.value

        });

    };

    const handleSubmit=async(e)=>{

        e.preventDefault();

        try{

            await api.put(`/products/${id}`,form);

            alert("Product Updated Successfully");

            navigate("/seller-products");

        }

        catch(err){

            alert("Update Failed");

        }

    };

    return(

        <div className="dashboard">

            <h1>Edit Product</h1>

            <form
            className="dashboard-form"
            onSubmit={handleSubmit}
            >

                <input
                name="name"
                value={form.name}
                onChange={handleChange}
                />

                <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                />

                <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                />

                <input
                name="category"
                value={form.category}
                onChange={handleChange}
                />

                <input
                name="image"
                value={form.image}
                onChange={handleChange}
                />

                <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                />

                <button type="submit">

                    Update Product

                </button>

            </form>

        </div>

    );

};

export default EditProduct;
