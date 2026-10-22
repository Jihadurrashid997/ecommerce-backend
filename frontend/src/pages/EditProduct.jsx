import React, { useCallback, useEffect, useState } from "react";
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
        stock:"",
        variants:""
    });

    const loadProduct = useCallback(async () => {
        try{
            const res = await api.get(`/products/${id}`);
            setForm({
                ...res.data,
                variants: Array.isArray(res.data.variants)
                    ? JSON.stringify(res.data.variants.map(({
                        _id,
                        name,
                        sku,
                        price,
                        stock,
                        image
                    }) => ({ _id, name, sku, price, stock, image })), null, 2)
                    : ""
            });
        }
        catch(err){
            console.log(err);
        }
    }, [id]);

    useEffect(() => {
        loadProduct();
    }, [loadProduct]);

    const handleChange=(e)=>{

        setForm({

            ...form,

            [e.target.name]:e.target.value

        });

    };

    const handleSubmit=async(e)=>{

        e.preventDefault();

        try{

            const payload = { ...form };
            if (!payload.variants.trim()) delete payload.variants;
            await api.put(`/products/${id}`,payload);

            alert("Product Updated Successfully");

            navigate("/shop/seller/products");

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

                <label>
                    Variants (optional JSON)
                    <textarea
                        name="variants"
                        value={form.variants || ""}
                        onChange={handleChange}
                        rows={6}
                        placeholder='[{"name":"Large / Black","sku":"TSHIRT-L-BLK","price":500,"stock":8}]'
                    />
                    <small>When variants are set, their prices and stock replace the product-level values.</small>
                </label>

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
