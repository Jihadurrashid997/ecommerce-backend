import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useCart } from "../context/CartContext";

import "../styles/Payment.css";

const PaymentSuccess = () => {

    const [searchParams] = useSearchParams();

    const transactionId =
        searchParams.get("transactionId") ||
        searchParams.get("tran_id");

    const [paymentStatus, setPaymentStatus] = useState("checking");
    const [statusError, setStatusError] = useState("");
    const { clearCart } = useCart();

    useEffect(() => {
        if (!transactionId) {
            setPaymentStatus("unknown");
            return undefined;
        }

        let active = true;
        let timer;
        let attempts = 0;

        const checkStatus = async () => {
            try {
                const response = await api.get(
                    `/payment/status/${encodeURIComponent(transactionId)}`
                );
                if (!active) return;

                const nextStatus = response.data?.paymentStatus || "unknown";
                setPaymentStatus(nextStatus);
                setStatusError("");

                if (nextStatus === "paid") {
                    clearCart();
                }

                if (nextStatus === "pending" && attempts < 9) {
                    attempts += 1;
                    timer = setTimeout(checkStatus, 3000);
                }
            } catch (error) {
                if (!active) return;
                setPaymentStatus("unknown");
                setStatusError(
                    error.response?.data?.message ||
                    "We couldn't verify the payment status."
                );
            }
        };

        checkStatus();

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [transactionId, clearCart]);

    const isPaid = paymentStatus === "paid";
    const isChecking = paymentStatus === "checking";


    return (

        <div className="payment-page">

            <div className="payment-card success-card">

                <div className="payment-icon">
                    {isPaid ? "✓" : isChecking ? "…" : "!"}
                </div>


                <h1>
                    {isPaid
                        ? "Payment Successful!"
                        : isChecking
                            ? "Verifying payment..."
                            : paymentStatus === "pending"
                                ? "Payment is processing"
                                : `Payment ${paymentStatus}`}
                </h1>


                <p>
                    {isPaid
                        ? "Your payment has been verified."
                        : isChecking
                            ? "Please wait while we confirm your payment."
                            : paymentStatus === "pending"
                                ? "The gateway has returned, but confirmation is still pending. Check your order history shortly."
                                : statusError || "We couldn't confirm this payment."}
                </p>


                {transactionId && (

                    <p className="transaction-id">

                        Transaction ID:{" "}

                        <strong>
                            {transactionId}
                        </strong>

                    </p>

                )}


                <div className="payment-actions">

                    <Link
                        to="/orders"
                        className="payment-btn"
                    >
                        View My Orders
                    </Link>


                    <Link
                        to="/"
                        className="payment-btn secondary-btn"
                    >
                        Continue Shopping
                    </Link>

                </div>

            </div>

        </div>

    );

};


export default PaymentSuccess;
