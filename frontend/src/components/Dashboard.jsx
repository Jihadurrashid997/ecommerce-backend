import React, { useEffect, useState } from "react";
import { FaBoxOpen, FaShoppingBag, FaMoneyBillWave, FaUsers } from "react-icons/fa";
import api from "../services/api";
import "../styles/Dashboard.css";

const Dashboard = () => {

    const [stats, setStats] = useState({
        products: 0,
        orders: 0,
        users: 0,
        revenue: 0
    });

    useEffect(() => {

        loadDashboard();

    }, []);

    const loadDashboard = async () => {

        try {

            const productRes = await api.get("/products");

            setStats({

                products: productRes.data.length,
                orders: 0,
                users: 0,
                revenue: 0

            });

        } catch (err) {

            console.log(err);

        }

    };

    return (

        <div className="dashboard">

            <h1>Dashboard</h1>

            <div className="dashboard-grid">

                <div className="dashboard-card">

                    <FaBoxOpen className="dash-icon"/>

                    <h2>{stats.products}</h2>

                    <p>Total Products</p>

                </div>

                <div className="dashboard-card">

                    <FaShoppingBag className="dash-icon"/>

                    <h2>{stats.orders}</h2>

                    <p>Total Orders</p>

                </div>

                <div className="dashboard-card">

                    <FaUsers className="dash-icon"/>

                    <h2>{stats.users}</h2>

                    <p>Total Users</p>

                </div>

                <div className="dashboard-card">

                    <FaMoneyBillWave className="dash-icon"/>

                    <h2>৳ {stats.revenue}</h2>

                    <p>Total Revenue</p>

                </div>

            </div>

        </div>

    );

};

export default Dashboard;
