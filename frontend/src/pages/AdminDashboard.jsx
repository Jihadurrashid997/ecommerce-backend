import React, { useEffect, useState } from "react";

import api from "../services/api";

import "../styles/AdminDashboard.css";


const AdminDashboard = () => {

    const [analytics, setAnalytics] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    const fetchAnalytics = async () => {

        try {

            setLoading(true);

            setError("");


            const response =
                await api.get("/admin/analytics");


            if (
                response.data &&
                response.data.analytics
            ) {

                setAnalytics(
                    response.data.analytics
                );

            } else {

                throw new Error(
                    "Analytics data not found."
                );

            }

        } catch (err) {

            console.error(
                "Admin analytics error:",
                err
            );


            setError(
                err.response?.data?.message ||
                err.message ||
                "Failed to load admin analytics."
            );

        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        fetchAnalytics();

    }, []);


    if (loading) {

        return (

            <div className="admin-dashboard">

                <div className="admin-loading">

                    Loading Admin Analytics...

                </div>

            </div>

        );

    }


    if (error) {

        return (

            <div className="admin-dashboard">

                <div className="admin-error">

                    <h2>
                        Unable to Load Analytics
                    </h2>

                    <p>
                        {error}
                    </p>

                    <button
                        onClick={fetchAnalytics}
                    >
                        Try Again
                    </button>

                </div>

            </div>

        );

    }


    return (

        <div className="admin-dashboard">

            <div className="admin-container">


                {/* =========================
                    HEADER
                ========================== */}

                <div className="admin-header">

                    <div>

                        <h1>
                            Admin Dashboard
                        </h1>

                        <p>
                            Marketplace overview
                            and analytics
                        </p>

                    </div>


                    <button
                        className="refresh-btn"
                        onClick={fetchAnalytics}
                    >
                        ↻ Refresh
                    </button>

                </div>


                {/* =========================
                    MAIN STATISTICS
                ========================== */}

                <div className="analytics-grid">


                    <div className="analytics-card">

                        <div className="analytics-icon">
                            👥
                        </div>

                        <div>

                            <p>
                                Total Users
                            </p>

                            <h2>
                                {analytics.totalUsers}
                            </h2>

                        </div>

                    </div>


                    <div className="analytics-card">

                        <div className="analytics-icon">
                            📦
                        </div>

                        <div>

                            <p>
                                Total Products
                            </p>

                            <h2>
                                {analytics.totalProducts}
                            </h2>

                        </div>

                    </div>


                    <div className="analytics-card">

                        <div className="analytics-icon">
                            🛒
                        </div>

                        <div>

                            <p>
                                Total Orders
                            </p>

                            <h2>
                                {analytics.totalOrders}
                            </h2>

                        </div>

                    </div>


                    <div className="analytics-card revenue-card">

                        <div className="analytics-icon">
                            ৳
                        </div>

                        <div>

                            <p>
                                Total Revenue
                            </p>

                            <h2>
                                ৳
                                {Number(
                                    analytics.totalRevenue ||
                                    0
                                ).toFixed(2)}
                            </h2>

                        </div>

                    </div>

                </div>


                {/* =========================
                    ORDER STATISTICS
                ========================== */}

                <div className="analytics-section">

                    <h2>
                        Order Statistics
                    </h2>


                    <div className="statistics-grid">


                        <div className="stat-box pending">

                            <span>
                                ⏳
                            </span>

                            <div>

                                <p>
                                    Pending
                                </p>

                                <strong>
                                    {
                                        analytics.orders
                                            ?.pending || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box processing">

                            <span>
                                ⚙️
                            </span>

                            <div>

                                <p>
                                    Processing
                                </p>

                                <strong>
                                    {
                                        analytics.orders
                                            ?.processing || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box shipped">

                            <span>
                                🚚
                            </span>

                            <div>

                                <p>
                                    Shipped
                                </p>

                                <strong>
                                    {
                                        analytics.orders
                                            ?.shipped || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box delivered">

                            <span>
                                ✅
                            </span>

                            <div>

                                <p>
                                    Delivered
                                </p>

                                <strong>
                                    {
                                        analytics.orders
                                            ?.delivered || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box cancelled">

                            <span>
                                ❌
                            </span>

                            <div>

                                <p>
                                    Cancelled
                                </p>

                                <strong>
                                    {
                                        analytics.orders
                                            ?.cancelled || 0
                                    }
                                </strong>

                            </div>

                        </div>

                    </div>

                </div>


                {/* =========================
                    PAYMENT STATISTICS
                ========================== */}

                <div className="analytics-section">

                    <h2>
                        Payment Statistics
                    </h2>


                    <div className="statistics-grid">


                        <div className="stat-box paid">

                            <span>
                                💰
                            </span>

                            <div>

                                <p>
                                    Paid
                                </p>

                                <strong>
                                    {
                                        analytics.payments
                                            ?.paid || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box payment-pending">

                            <span>
                                ⏳
                            </span>

                            <div>

                                <p>
                                    Pending Payment
                                </p>

                                <strong>
                                    {
                                        analytics.payments
                                            ?.pending || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box payment-failed">

                            <span>
                                ⚠️
                            </span>

                            <div>

                                <p>
                                    Failed
                                </p>

                                <strong>
                                    {
                                        analytics.payments
                                            ?.failed || 0
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="stat-box payment-cancelled">

                            <span>
                                ❌
                            </span>

                            <div>

                                <p>
                                    Cancelled
                                </p>

                                <strong>
                                    {
                                        analytics.payments
                                            ?.cancelled || 0
                                    }
                                </strong>

                            </div>

                        </div>

                    </div>

                </div>


                {/* =========================
                    SUMMARY
                ========================== */}

                <div className="analytics-summary">

                    <h2>
                        Marketplace Summary
                    </h2>

                    <p>
                        The marketplace currently has{" "}
                        <strong>
                            {analytics.totalUsers}
                        </strong>{" "}
                        users and{" "}
                        <strong>
                            {analytics.totalProducts}
                        </strong>{" "}
                        products.
                    </p>

                    <p>
                        A total of{" "}
                        <strong>
                            {analytics.totalOrders}
                        </strong>{" "}
                        orders have been placed.
                    </p>

                    <p>
                        Total revenue from paid
                        orders is{" "}
                        <strong>
                            ৳
                            {Number(
                                analytics.totalRevenue ||
                                0
                            ).toFixed(2)}
                        </strong>.
                    </p>

                </div>


            </div>

        </div>

    );

};


export default AdminDashboard;
