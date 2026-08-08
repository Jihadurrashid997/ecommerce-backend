import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/OrderHistory.css";

const OrderHistory = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await api.get("/orders");
            setOrders(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loader">Loading orders...</div>;
    }

    return (
        <div className="orders-page">

            <h1>My Orders</h1>

            {orders.length === 0 ? (
                <div className="empty-orders">
                    <h2>No Orders Yet</h2>
                    <p>Your orders will appear here.</p>
                </div>
            ) : (

                <div className="orders-list">

                    {orders.map((order) => (

                        <div
                            className="order-card"
                            key={order._id}
                        >

                            <div className="order-header">

                                <h3>
                                    Order #{order._id.slice(-8)}
                                </h3>

                                <span className="order-status">
                                    {order.status || "Pending"}
                                </span>

                            </div>

                            <p>
                                <strong>Total:</strong>{" "}
                                ৳ {order.totalPrice}
                            </p>

                            <p>
                                <strong>Payment:</strong>{" "}
                                {order.paymentMethod || "Cash On Delivery"}
                            </p>

                            <p>
                                <strong>Date:</strong>{" "}
                                {order.createdAt
                                    ? new Date(
                                        order.createdAt
                                    ).toLocaleDateString()
                                    : "N/A"}
                            </p>

                        </div>

                    ))}

                </div>

            )}

        </div>
    );
};

export default OrderHistory;
