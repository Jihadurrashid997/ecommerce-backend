import React, { useEffect, useState } from "react";

import api from "../services/api";

import "../styles/SellerOrders.css";

const SellerOrders = () => {

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmingFulfillment, setConfirmingFulfillment] = useState("");
    const [shipmentDrafts, setShipmentDrafts] = useState({});
    const [disputeReplies, setDisputeReplies] = useState({});
    const [respondingToDispute, setRespondingToDispute] = useState("");
    const nextShipmentStatuses = {
        Pending: ["Processing"],
        Processing: ["Shipped"],
        Shipped: ["Delivered"],
        Delivered: [],
        Cancelled: []
    };

    const fetchOrders = async () => {

        try {

            const res = await api.get("/orders/seller/orders");

            setOrders(res.data);
            setShipmentDrafts(previous => Object.fromEntries(
                (res.data || []).map(order => [
                    order._id,
                    previous[order._id] || {
                        status: order.status,
                        courierName: order.payout?.courierName || "",
                        trackingNumber: order.payout?.trackingNumber || "",
                        trackingUrl: order.payout?.trackingUrl || "",
                        deliveryEvidence: ""
                    }
                ])
            ));

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


    const updateStatus = async (orderId, shipment) => {

        try {

            await api.put(
                `/orders/seller/${orderId}/status`,
                shipment
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

    const confirmPayout = async (orderId, payout) => {
        const fulfillmentId = payout.id;
        setConfirmingFulfillment(fulfillmentId);

        try {
            await api.put(
                `/orders/seller/${orderId}/confirm-payout/${fulfillmentId}`,
                {
                    payoutMethod: payout.payoutMethod,
                    payoutAccount: payout.payoutAccount
                }
            );
            await fetchOrders();
        } catch (err) {
            alert(
                err.response?.data?.message ||
                "Failed to confirm the shipment and payout amount."
            );
        } finally {
            setConfirmingFulfillment("");
        }
    };

    const respondToDispute = async (orderId, payout) => {
        const sellerReply = String(disputeReplies[payout.id] || "").trim();
        if (sellerReply.length < 3 || sellerReply.length > 1000) {
            window.alert("Provide a response between 3 and 1000 characters.");
            return;
        }

        setRespondingToDispute(payout.id);
        try {
            await api.put(
                `/orders/seller/${orderId}/shipments/${payout.id}/dispute-response`,
                { sellerReply }
            );
            setDisputeReplies(previous => ({
                ...previous,
                [payout.id]: ""
            }));
            await fetchOrders();
        } catch (error) {
            window.alert(
                error.response?.data?.message ||
                "Could not save the delivery issue response."
            );
        } finally {
            setRespondingToDispute("");
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


                            <p>
                                Buyer account details are private. Use the shipping details below only to deliver this order.
                            </p>

                            <h4>Delivery details</h4>
                            <p><strong>Recipient:</strong> {order.shippingAddress?.name || "N/A"}</p>
                            <p><strong>Phone:</strong> {order.shippingAddress?.phone || "N/A"}</p>
                            <p><strong>Address:</strong> {order.shippingAddress?.address || "N/A"}</p>
                            <p><strong>City:</strong> {order.shippingAddress?.city || "N/A"}</p>


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

                            {order.refundStatus === "requested" && (
                                <div className="seller-refund-notice" role="status">
                                    <p>
                                        <strong>English:</strong> A full-order refund request is under Shop review. Shipment updates and payout confirmation are paused; please wait for the Shop administrator's decision.
                                    </p>
                                    <p lang="bn">
                                        <strong>বাংলা:</strong> পুরো অর্ডারের রিফান্ড অনুরোধ Shop পর্যালোচনা করছে। শিপমেন্ট আপডেট ও পেআউট নিশ্চিতকরণ সাময়িকভাবে বন্ধ; Shop administrator-এর সিদ্ধান্তের জন্য অপেক্ষা করুন।
                                    </p>
                                </div>
                            )}

                            {order.refundStatus === "refunded" && (
                                <div className="seller-refund-notice" role="status">
                                    <p>
                                        <strong>English:</strong> The Shop administrator recorded a refund for this order. Any unpaid seller payout was cancelled.
                                    </p>
                                    <p lang="bn">
                                        <strong>বাংলা:</strong> Shop administrator এই অর্ডারের রিফান্ড রেকর্ড করেছেন। বাকি থাকা পেআউট বাতিল করা হয়েছে।
                                    </p>
                                </div>
                            )}

                            {order.payout?.trackingNumber && (
                                <p>
                                    <strong>Tracking:</strong>{" "}
                                    {order.payout.courierName || "Courier"} · {order.payout.trackingNumber}
                                    {order.payout.trackingUrl && (
                                        <> · <a href={order.payout.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a></>
                                    )}
                                </p>
                            )}

                            <p>
                                <strong>Seller payout:</strong>{" "}
                                {order.payout?.deliveryDispute?.status === "open"
                                    ? "Paused during delivery issue review"
                                    : order.refundStatus === "requested"
                                    ? "Paused during refund review"
                                    : order.refundStatus === "refunded"
                                        ? "Cancelled after refund"
                                        : order.payout?.status === "held"
                                    ? "Awaiting both confirmations; payment is not held by the Shop"
                                    : order.payout?.status === "ready"
                                        ? "Both confirmations received; awaiting admin approval"
                                        : order.payout?.status === "approved"
                                            ? "Admin approved; manual transfer not yet recorded"
                                        : order.payout?.status === "paid"
                                            ? "Paid by Shop admin"
                                            : order.payout?.status === "cancelled"
                                                ? "Not payable"
                                                : "Waiting for payment"}
                            </p>

                            {order.payout?.deliveryDispute?.status === "open" && (
                                <div className="seller-refund-notice" role="status">
                                    <p><strong>Buyer-reported issue:</strong> {order.payout.deliveryDispute.reason}</p>
                                    {order.payout.deliveryDispute.sellerReply ? (
                                        <p><strong>Your response:</strong> {order.payout.deliveryDispute.sellerReply}</p>
                                    ) : (
                                        <div>
                                            <label>
                                                Response for Shop admin
                                                <textarea
                                                    rows={3}
                                                    maxLength={1000}
                                                    value={disputeReplies[order.payout.id] || ""}
                                                    onChange={event => setDisputeReplies(previous => ({
                                                        ...previous,
                                                        [order.payout.id]: event.target.value
                                                    }))}
                                                    placeholder="Add your response (3–1000 characters)"
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                disabled={respondingToDispute === order.payout.id}
                                                onClick={() => respondToDispute(order._id, order.payout)}
                                            >
                                                {respondingToDispute === order.payout.id
                                                    ? "Submitting..."
                                                    : "Send response"}
                                            </button>
                                        </div>
                                    )}
                                    <p>Shipment updates, confirmations, and payout actions are paused until admin review.</p>
                                </div>
                            )}

                            {order.paymentStatus === "paid" &&
                                order.status === "Delivered" &&
                                order.payout?.status === "held" &&
                                order.payout?.deliveryDispute?.status !== "open" &&
                                !["requested", "refunded"].includes(order.refundStatus) && (
                                    <>
                                        <p>
                                            <strong>Customer receipt:</strong>{" "}
                                            {order.payout.receiptConfirmedAt
                                                ? "Confirmed"
                                                : "Waiting for customer"}
                                        </p>
                                        <p>
                                            <strong>Your confirmation:</strong>{" "}
                                            {order.payout.sellerConfirmedAt
                                                ? "Confirmed"
                                                : "Required"}
                                        </p>
                                        <p>
                                            <strong>Payout destination:</strong>{" "}
                                            {order.payout.payoutMethod || "Not set"} ·{" "}
                                            {order.payout.payoutAccount || "Not set"}
                                        </p>
                                        {!order.payout.sellerConfirmedAt && (
                                            <button
                                                type="button"
                                                className="seller-confirm-payout"
                                                disabled={
                                                    confirmingFulfillment === order.payout.id ||
                                                    !order.payout.payoutMethod ||
                                                    !order.payout.payoutAccount
                                                }
                                                onClick={() => confirmPayout(order._id, order.payout)}
                                            >
                                                {confirmingFulfillment === order.payout.id
                                                    ? "Confirming..."
                                                    : !order.payout.payoutAccount
                                                        ? "Add payout details in Seller Dashboard"
                                                        : `Confirm delivery, ৳${Number(order.payout.amount).toLocaleString("en-BD")} & payout method`}
                                            </button>
                                        )}
                                    </>
                                )}

                            {order.payout?.receiptConfirmedAt &&
                                order.payout?.sellerConfirmedAt && (
                                    <div className="seller-payout-instruction">
                                        {order.refundStatus === "requested" ? (
                                            <>
                                                <p>
                                                    <strong>English:</strong> Payout instructions are paused during refund review. Do not send or confirm any payout transfer.
                                                </p>
                                                <p lang="bn">
                                                    <strong>বাংলা:</strong> রিফান্ড পর্যালোচনার সময় পেআউট নির্দেশনা বন্ধ থাকবে। কোনো পেআউট ট্রান্সফার পাঠাবেন বা নিশ্চিত করবেন না।
                                                </p>
                                            </>
                                        ) : order.refundStatus === "refunded" ||
                                            order.payout.status === "cancelled" ? (
                                            <>
                                                <p>
                                                    <strong>English:</strong> This seller payout was cancelled. No transfer should be sent for this order.
                                                </p>
                                                <p lang="bn">
                                                    <strong>বাংলা:</strong> এই পেআউট বাতিল করা হয়েছে। এই অর্ডারের জন্য কোনো টাকা পাঠাবেন না।
                                                </p>
                                            </>
                                        ) : order.payout.status === "paid" ? (
                                            <>
                                                <p>
                                                    <strong>English:</strong> Your payout has been sent to your saved payout account. Please check your account. If it has not arrived, contact Shop support with this order number.
                                                </p>
                                                <p lang="bn">
                                                    <strong>বাংলা:</strong> আপনার সংরক্ষিত পেআউট অ্যাকাউন্টে টাকা পাঠানো হয়েছে। অ্যাকাউন্ট যাচাই করুন। টাকা না পেলে এই অর্ডার নম্বর দিয়ে Shop support-এর সঙ্গে যোগাযোগ করুন।
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p>
                                                    <strong>English:</strong> You and the customer have confirmed delivery, the ৳{Number(order.payout.amount).toLocaleString("en-BD")} payout amount, and the {order.payout.payoutMethod} account ending {order.payout.payoutAccount.slice(-4)}. The Shop admin will send the money to this confirmed account after review. This is a manual transfer, not an automatic payment. Never share your OTP or PIN.
                                                </p>
                                                <p lang="bn">
                                                    <strong>বাংলা:</strong> আপনি ও ক্রেতা ডেলিভারি, ৳{Number(order.payout.amount).toLocaleString("en-BD")} পেআউটের পরিমাণ এবং {order.payout.payoutMethod} অ্যাকাউন্টের শেষ ৪ সংখ্যা {order.payout.payoutAccount.slice(-4)} নিশ্চিত করেছেন। যাচাই শেষে Shop admin এই নিশ্চিত অ্যাকাউন্টে টাকা পাঠাবেন। এটি ম্যানুয়াল ট্রান্সফার, স্বয়ংক্রিয় পেমেন্ট নয়। OTP বা PIN কারও সঙ্গে শেয়ার করবেন না।
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}


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
                                    Shipment status and tracking (seller-entered)
                                </label>

                                <select
                                    value={shipmentDrafts[order._id]?.status || order.status}
                                    disabled={
                                        order.paymentStatus !== "paid" ||
                                                ["requested", "refunded"].includes(order.refundStatus) ||
                                                order.payout?.deliveryDispute?.status === "open"
                                    }
                                    onChange={event => setShipmentDrafts(previous => ({
                                        ...previous,
                                        [order._id]: {
                                            ...previous[order._id],
                                            status: event.target.value
                                        }
                                    }))}
                                >

                                    {[order.status, ...(nextShipmentStatuses[order.status] || [])]
                                        .filter((status, index, statuses) => statuses.indexOf(status) === index)
                                        .map(status => (
                                            <option value={status} key={status}>
                                                {status}
                                            </option>
                                        ))}

                                </select>

                                <input
                                    value={shipmentDrafts[order._id]?.courierName || ""}
                                    maxLength={80}
                                    placeholder="Courier name (optional)"
                                    aria-label={`Courier for order ${order._id.slice(-8)}`}
                                    disabled={["requested", "refunded"].includes(order.refundStatus)}
                                    onChange={event => setShipmentDrafts(previous => ({
                                        ...previous,
                                        [order._id]: {
                                            ...previous[order._id],
                                            courierName: event.target.value
                                        }
                                    }))}
                                />
                                <input
                                    value={shipmentDrafts[order._id]?.trackingNumber || ""}
                                    maxLength={120}
                                    placeholder="Tracking number (optional)"
                                    aria-label={`Tracking number for order ${order._id.slice(-8)}`}
                                    disabled={["requested", "refunded"].includes(order.refundStatus)}
                                    onChange={event => setShipmentDrafts(previous => ({
                                        ...previous,
                                        [order._id]: {
                                            ...previous[order._id],
                                            trackingNumber: event.target.value
                                        }
                                    }))}
                                />
                                <input
                                    type="url"
                                    value={shipmentDrafts[order._id]?.trackingUrl || ""}
                                    maxLength={500}
                                    placeholder="HTTPS tracking link (optional)"
                                    aria-label={`Tracking link for order ${order._id.slice(-8)}`}
                                    disabled={["requested", "refunded"].includes(order.refundStatus)}
                                    onChange={event => setShipmentDrafts(previous => ({
                                        ...previous,
                                        [order._id]: {
                                            ...previous[order._id],
                                            trackingUrl: event.target.value
                                        }
                                    }))}
                                />
                                <textarea
                                    value={shipmentDrafts[order._id]?.deliveryEvidence || ""}
                                    maxLength={500}
                                    rows={2}
                                    placeholder="Delivery note/evidence required when marking delivered"
                                    aria-label={`Delivery note for order ${order._id.slice(-8)}`}
                                    disabled={["requested", "refunded"].includes(order.refundStatus)}
                                    onChange={event => setShipmentDrafts(previous => ({
                                        ...previous,
                                        [order._id]: {
                                            ...previous[order._id],
                                            deliveryEvidence: event.target.value
                                        }
                                    }))}
                                />
                                <button
                                    type="button"
                                    disabled={["requested", "refunded"].includes(order.refundStatus)}
                                    onClick={() => updateStatus(
                                        order._id,
                                        shipmentDrafts[order._id] || { status: order.status }
                                    )}
                                >
                                    Save shipment update
                                </button>

                            </div>

                        </div>

                    ))}

                </div>

            )}

        </div>

    );

};

export default SellerOrders;
