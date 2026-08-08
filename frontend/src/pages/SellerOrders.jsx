import React, { useEffect, useState } from "react";

import api from "../services/api";

import "../styles/SellerOrders.css";

const SellerOrders = () => {

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {

        try {

            const res = await api.get("/orders/seller/orders");

            setOrders(res.data);

        } catch (err) {

            console.error("Seller orders error:", err);

            alert(
                err.response?.data?.message ||
                "Failed to load seller orders"
            );

        } finally {

            setLoading(false);

        }

    };

    useEffect(() => {

        fetchOrders();

    }, []);


    const updateStatus = async (orderId, status) => {

        try {

            await api.put(
                `/orders/seller/${orderId}/status`,
                { status }
            );

            alert("Order status updated successfully.");

            fetchOrders();

        } catch (err) {

            console.error("Update status error:", err);

            alert(
                err.response?.data?.message ||
                "Failed to update order status"
            );

        }

    };


    if (loading) {

        return (
            <div className="loader">
                Loading seller orders...
            </div>
        );

    }


    return (

        <div className="seller-orders-page">

            <h1>
                Seller Order Management
            </h1>


            {orders.length === 0 ? (

                <div className="empty-orders">

                    <h2>
                        No Orders Found
                    </h2>

                    <p>
                        Orders for your products will appear here.
                    </p>

                </div>

            ) : (

                <div className="seller-orders-list">

                    {orders.map((order) => (

                        <div
                            className="seller-order-card"
                            key={order._id}
                        >

                            {/* Order Header */}

                            <div className="seller-order-header">

                                <h3>
                                    Order #{order._id.slice(-8)}
                                </h3>

                                <span>
                                    {order.status}
                                </span>

                            </div>


                            {/* Customer */}

                            <p>

                                <strong>
                                    Customer:
                                </strong>{" "}

                                {order.user?.name || "Unknown"}

                            </p>


                            <p>

                                <strong>
                                    Email:
                                </strong>{" "}

                                {order.user?.email || "N/A"}

                            </p>


                            {/* Products */}

                            <h4>
                                Products
                            </h4>


                            {order.items?.map((item, index) => (

                                <div
                                    className="seller-order-item"
                                    key={index}
                                >

                                    <span>
                                        {item.name}
                                    </span>

                                    <span>
                                        {item.quantity} × ৳{item.price}
                                    </span>

                                </div>

                            ))}


                            {/* Total */}

                            <p>

                                <strong>
                                    Total:
                                </strong>{" "}

                                ৳{order.totalPrice}

                            </p>


                            {/* Payment */}

                            <p>

                                <strong>
                                    Payment:
                                </strong>{" "}

                                {order.paymentMethod}

                            </p>


                            <p>

                                <strong>
                                    Payment Status:
                                </strong>{" "}

                                {order.paymentStatus}

                            </p>


                            {/* Date */}

                            <p>

                                <strong>
                                    Order Date:
                                </strong>{" "}

                                {order.createdAt
                                    ? new Date(
                                        order.createdAt
                                    ).toLocaleDateString()
                                    : "N/A"
                                }

                            </p>


                            {/* Status */}

                            <div className="status-controls">

                                <label>
                                    Update Status
                                </label>


                                <select
                                    value={order.status}
                                    onChange={(e) =>
                                        updateStatus(
                                            order._id,
                                            e.target.value
                                        )
                                    }
                                >

                                    <option value="Pending">
                                        Pending
                                    </option>

                                    <option value="Processing">
                                        Processing
                                    </option>

                                    <option value="Shipped">
                                        Shipped
                                    </option>

                                    <option value="Delivered">
                                        Delivered
                                    </option>

                                    <option value="Cancelled">
                                        Cancelled
                                    </option>

                                </select>

                            </div>

                        </div>

                    ))}

                </div>

            )}

        </div>

    );

};

export default SellerOrders;
