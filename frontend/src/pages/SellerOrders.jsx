import React, { useEffect, useState } from "react";

import api from "../services/api";

import "../styles/SellerOrders.css";

const SellerOrders = () => {

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmingFulfillment, setConfirmingFulfillment] = useState("");

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

                            <p>
                                <strong>Seller payout:</strong>{" "}
                                {order.refundStatus === "requested"
                                    ? "Paused during refund review"
                                    : order.refundStatus === "refunded"
                                        ? "Cancelled after refund"
                                        : order.payout?.status === "held"
                                    ? "Held until both you and the customer confirm"
                                    : order.payout?.status === "ready"
                                        ? "Both confirmations received; awaiting admin payout"
                                        : order.payout?.status === "paid"
                                            ? "Paid by Shop admin"
                                            : order.payout?.status === "cancelled"
                                                ? "Not payable"
                                                : "Waiting for payment"}
                            </p>

                            {order.paymentStatus === "paid" &&
                                order.status === "Delivered" &&
                                order.payout?.status === "held" &&
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
                                    Update Status
                                </label>


                                <select
                                    value={order.status}
                                    disabled={["requested", "refunded"].includes(order.refundStatus)}
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
