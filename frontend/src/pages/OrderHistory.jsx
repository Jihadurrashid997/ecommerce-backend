import React, { useEffect, useState } from "react";

import api from "../services/api";

import "../styles/OrderHistory.css";


const OrderHistory = () => {

    const [orders, setOrders] = useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [confirmingFulfillment, setConfirmingFulfillment] =
        useState("");

    const [cancellingOrder, setCancellingOrder] =
        useState("");

    const [refundReasons, setRefundReasons] = useState({});

    const [refundingOrder, setRefundingOrder] = useState("");

    const [notice, setNotice] = useState("");


    const fetchOrders = async () => {

        try {

            setLoading(true);

            setError("");


            const response =
                await api.get("/orders");


            setOrders(
                Array.isArray(response.data)
                    ? response.data
                    : []
            );


        } catch (err) {

            console.error(
                "Order history error:",
                err
            );


            setError(
                err.response?.data?.message ||
                "Failed to load your orders."
            );


        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        fetchOrders();

    }, []);

    const confirmReceipt = async (orderId, fulfillmentId) => {
        setConfirmingFulfillment(fulfillmentId);
        setError("");

        try {
            await api.put(
                `/orders/${orderId}/confirm-received/${fulfillmentId}`
            );
            await fetchOrders();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Could not confirm delivery."
            );
        } finally {
            setConfirmingFulfillment("");
        }
    };

    const cancelOrder = async order => {
        if (!window.confirm(
            `Cancel unpaid order #${order._id.slice(-8)}? This releases the reserved stock.`
        )) {
            return;
        }

        setCancellingOrder(order._id);
        setError("");

        try {
            await api.put(`/orders/${order._id}/cancel`);
            await fetchOrders();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Could not cancel this order."
            );
        } finally {
            setCancellingOrder("");
        }
    };

    const requestRefund = async order => {
        const reason = String(refundReasons[order._id] || "").trim();
        if (reason.length < 10 || reason.length > 1000) {
            setError("Explain your full-order refund request in 10 to 1000 characters.");
            return;
        }

        setRefundingOrder(order._id);
        setError("");
        setNotice("");

        try {
            const response = await api.post(
                `/orders/${order._id}/refund-request`,
                { reason }
            );
            setRefundReasons(previous => ({
                ...previous,
                [order._id]: ""
            }));
            setNotice(response.data?.message || "Refund request sent for review.");
            await fetchOrders();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Could not submit your refund request."
            );
        } finally {
            setRefundingOrder("");
        }
    };


    const getPaymentStatusClass =
        (status) => {

            switch (status) {

                case "paid":
                    return "status-paid";

                case "refunded":
                    return "status-refunded";

                case "failed":
                    return "status-failed";

                case "cancelled":
                    return "status-cancelled";

                default:
                    return "status-pending";

            }

        };


    const getOrderStatusClass =
        (status) => {

            switch (status) {

                case "Delivered":
                    return "status-delivered";

                case "Shipped":
                    return "status-shipped";

                case "Processing":
                    return "status-processing";

                case "Cancelled":
                    return "status-cancelled";

                default:
                    return "status-pending";

            }

        };


    if (loading) {

        return (

            <div className="order-history-page">

                <div className="order-loading">

                    Loading your orders...

                </div>

            </div>

        );

    }


    return (

        <div className="order-history-page">

            <div className="order-history-container">

                <h1>
                    My Orders
                </h1>


                <p className="order-history-subtitle">
                    View your previous orders,
                    payment status and delivery status.
                </p>


                {error && (

                    <div className="order-error">

                        {error}

                    </div>

                )}

                {notice && (
                    <div className="order-notice" role="status">
                        {notice}
                    </div>
                )}


                {!error &&
                    orders.length === 0 && (

                    <div className="empty-orders">

                        <h2>
                            No Orders Yet
                        </h2>

                        <p>
                            You haven't placed
                            any orders yet.
                        </p>

                    </div>

                )}


                <div className="orders-list">

                    {orders.map((order) => (

                        <div
                            className="order-history-card"
                            key={order._id}
                        >


                            {/* =========================
                                ORDER HEADER
                            ========================== */}

                            <div className="order-header">

                                <div>

                                    <h2>
                                        Order #
                                        {order._id.slice(-8)}
                                    </h2>

                                    <p>

                                        {order.createdAt
                                            ? new Date(
                                                order.createdAt
                                            ).toLocaleString()
                                            : ""
                                        }

                                    </p>

                                </div>


                                <div className="order-statuses">

                                    <span
                                        className={
                                            `order-status ${
                                                getOrderStatusClass(
                                                    order.status
                                                )
                                            }`
                                        }
                                    >

                                        {order.status}

                                    </span>


                                    <span
                                        className={
                                            `payment-status ${
                                                getPaymentStatusClass(
                                                    order.paymentStatus
                                                )
                                            }`
                                        }
                                    >

                                        Payment:{" "}

                                        {order.paymentStatus
                                            ? order.paymentStatus
                                            : "pending"
                                        }

                                    </span>

                                </div>

                                {order.paymentStatus !== "paid" &&
                                    (order.paymentStatus !== "pending" || !order.transactionId) &&
                                    !["Cancelled", "Shipped", "Delivered"].includes(order.status) && (
                                        <button
                                            type="button"
                                            className="cancel-unpaid-order-btn"
                                            disabled={cancellingOrder === order._id}
                                            onClick={() => cancelOrder(order)}
                                        >
                                            {cancellingOrder === order._id
                                                ? "Cancelling..."
                                                : "Cancel unpaid order"}
                                        </button>
                                    )}

                            </div>


                            {/* =========================
                                PRODUCTS
                            ========================== */}

                            <div className="order-products">

                                <h3>
                                    Products
                                </h3>


                                {order.items?.map(
                                    (item, index) => (

                                    <div
                                        className="order-product"
                                        key={index}
                                    >

                                        {item.image && (

                                            <img
                                                src={
                                                    item.image.startsWith(
                                                        "http"
                                                    )
                                                        ? item.image
                                                        : item.image
                                            }
                                                alt={
                                                    item.name
                                                }
                                            />

                                        )}


                                        <div className="order-product-info">

                                            <h4>
                                                {item.name}
                                            </h4>

                                            <p>
                                                Quantity:{" "}
                                                {item.quantity}
                                            </p>

                                            <p>
                                                Price: ৳
                                                {Number(
                                                    item.price || 0
                                                ).toFixed(2)}
                                            </p>

                                        </div>


                                        <strong>

                                            ৳
                                            {(
                                                Number(
                                                    item.price || 0
                                                ) *
                                                Number(
                                                    item.quantity || 1
                                                )
                                            ).toFixed(2)}

                                        </strong>

                                    </div>

                                ))}

                            </div>


                            {order.sellerSettlements?.length > 0 && (
                                <div className="order-shipping">
                                    <h3>Private delivery and payout</h3>
                                    <p>Seller profiles and contact details stay private. You and the seller must both confirm each delivered shipment and its amount before an administrator can process the manual payout.</p>
                                    {order.sellerSettlements.map((settlement, index) => (
                                        <div className="order-settlement" key={settlement._id}>
                                            <p>
                                                <strong>Shipment {index + 1}:</strong>{" "}
                                                {settlement.deliveryStatus}
                                            </p>
                                            {(settlement.courierName || settlement.trackingNumber) && (
                                                <p>
                                                    <strong>Tracking:</strong>{" "}
                                                    {settlement.courierName || "Courier"}
                                                    {settlement.trackingNumber
                                                        ? ` · ${settlement.trackingNumber}`
                                                        : ""}
                                                    {settlement.trackingUrl && (
                                                        <> · <a href={settlement.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a></>
                                                    )}
                                                </p>
                                            )}
                                            {settlement.deliveryEvidence && (
                                                <p><strong>Seller delivery note:</strong> {settlement.deliveryEvidence}</p>
                                            )}
                                            <p>
                                                Seller payout:{" "}
                                                {settlement.payoutStatus === "held"
                                                    ? "Held until you and the seller confirm"
                                                    : settlement.payoutStatus === "ready"
                                                        ? "Both confirmations received; awaiting admin payout"
                                                        : settlement.payoutStatus === "paid"
                                                            ? "Paid by Shop admin"
                                                            : settlement.payoutStatus === "cancelled"
                                                                ? "Not payable"
                                                                : "Waiting for payment"}
                                            </p>
                                            <p>
                                                Seller confirmation:{" "}
                                                {settlement.sellerConfirmedAt
                                                    ? "Confirmed"
                                                    : "Waiting for seller"}
                                            </p>
                                            {order.paymentStatus === "paid" &&
                                                settlement.deliveryStatus === "Delivered" &&
                                                settlement.payoutStatus === "held" &&
                                                !settlement.receiptConfirmedAt && (
                                                    <button
                                                        type="button"
                                                        className="confirm-receipt-btn"
                                                        disabled={confirmingFulfillment === settlement._id}
                                                        onClick={() => confirmReceipt(order._id, settlement._id)}
                                                    >
                                                        {confirmingFulfillment === settlement._id
                                                            ? "Confirming..."
                                                            : `Confirm receipt & ৳${Number(settlement.amount).toLocaleString("en-BD")} amount`}
                                                    </button>
                                                )}
                                        </div>
                                    ))}
                                </div>
                            )}


                            {/* =========================
                                SHIPPING ADDRESS
                            ========================== */}

                            <div className="order-shipping">

                                <h3>
                                    Shipping Address
                                </h3>


                                <p>
                                    <strong>
                                        Name:
                                    </strong>{" "}
                                    {
                                        order.shippingAddress?.name ||
                                        "N/A"
                                    }
                                </p>


                                <p>
                                    <strong>
                                        Phone:
                                    </strong>{" "}
                                    {
                                        order.shippingAddress?.phone ||
                                        "N/A"
                                    }
                                </p>


                                <p>
                                    <strong>
                                        Address:
                                    </strong>{" "}
                                    {
                                        order.shippingAddress?.address ||
                                        "N/A"
                                    }
                                </p>


                                <p>
                                    <strong>
                                        City:
                                    </strong>{" "}
                                    {
                                        order.shippingAddress?.city ||
                                        "N/A"
                                    }
                                </p>

                            </div>


                            {/* =========================
                                PAYMENT INFORMATION
                            ========================== */}

                            <div className="order-payment">

                                <p>

                                    <strong>
                                        Payment Method:
                                    </strong>{" "}

                                    {
                                        order.paymentMethod ||
                                        "cod"
                                    }

                                </p>


                                {order.transactionId && (

                                    <p>

                                        <strong>
                                            Transaction ID:
                                        </strong>{" "}

                                        {
                                            order.transactionId
                                        }

                                    </p>

                                )}

                            </div>

                            {["paid", "refunded"].includes(order.paymentStatus) && (
                                <section className="order-refund">
                                    <h3>
                                        {order.paymentStatus === "refunded"
                                            ? "Refund status"
                                            : "Full-order refund request"}
                                    </h3>
                                    {order.paymentStatus === "paid" && (
                                        <p>
                                            Refund requests are reviewed by Shop administrators. Submitting a request does not automatically cancel the order or refund your payment.
                                        </p>
                                    )}
                                    {order.refundRequest?.status === "requested" && (
                                        <p role="status">
                                            Your request is under review. Shipment updates and seller payouts are paused while it is pending.
                                        </p>
                                    )}
                                    {order.refundRequest?.status === "rejected" && (
                                        <p>
                                            Previous request reviewed: {order.refundRequest.adminNote || "No additional note."} You may submit a new request if you still need help.
                                        </p>
                                    )}
                                    {order.refundRequest?.status === "refunded" && (
                                        <p role="status">
                                            Refund recorded by the Shop administrator via {order.refundRequest.refundMethod || "manual transfer"}
                                            {order.refundRequest.refundReference
                                                ? ` (reference: ${order.refundRequest.refundReference})`
                                                : ""}.
                                        </p>
                                    )}
                                    {order.refundRequest?.status !== "requested" &&
                                        order.refundRequest?.status !== "refunded" &&
                                        order.status !== "Cancelled" &&
                                        order.sellerSettlements?.some(
                                            settlement => settlement.payoutStatus === "paid"
                                        ) && (
                                            <p>
                                                In-app refund requests are unavailable because a seller payout has already been sent.
                                            </p>
                                        )}
                                    {order.refundRequest?.status !== "requested" &&
                                        order.refundRequest?.status !== "refunded" &&
                                        order.status !== "Cancelled" &&
                                        !order.sellerSettlements?.some(
                                            settlement => settlement.payoutStatus === "paid"
                                        ) && (
                                            <div className="order-refund-form">
                                                <textarea
                                                    value={refundReasons[order._id] || ""}
                                                    onChange={event => setRefundReasons(previous => ({
                                                        ...previous,
                                                        [order._id]: event.target.value
                                                    }))}
                                                    rows={3}
                                                    minLength={10}
                                                    maxLength={1000}
                                                    placeholder="Tell us why you are requesting a full refund (10-1000 characters)."
                                                    aria-label={`Refund reason for order ${order._id.slice(-8)}`}
                                                />
                                                <button
                                                    type="button"
                                                    className="request-refund-btn"
                                                    disabled={refundingOrder === order._id}
                                                    onClick={() => requestRefund(order)}
                                                >
                                                    {refundingOrder === order._id
                                                        ? "Submitting..."
                                                        : "Request full refund"}
                                                </button>
                                            </div>
                                        )}
                                </section>
                            )}


                            {/* =========================
                                TOTAL
                            ========================== */}

                            <div className="order-total">

                                <span>
                                    Total
                                </span>

                                <strong>

                                    ৳
                                    {Number(
                                        order.totalPrice || 0
                                    ).toFixed(2)}

                                </strong>

                            </div>

                        </div>

                    ))}

                </div>

            </div>

        </div>

    );

};


export default OrderHistory;
