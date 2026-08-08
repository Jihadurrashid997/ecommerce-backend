import React from "react";
import { Link, useSearchParams } from "react-router-dom";

import "../styles/Payment.css";

const PaymentFailed = () => {

    const [searchParams] = useSearchParams();

    const reason =
        searchParams.get("reason");

    return (

        <div className="payment-page">

            <div className="payment-card failed-card">

                <div className="payment-icon">
                    ✕
                </div>

                <h1>
                    Payment Failed
                </h1>

                <p>
                    Unfortunately, your payment could not be completed.
                </p>

                {reason && (
                    <p className="payment-error">
                        {reason}
                    </p>
                )}

                <div className="payment-actions">

                    <Link
                        to="/checkout"
                        className="payment-btn"
                    >
                        Try Again
                    </Link>

                    <Link
                        to="/cart"
                        className="payment-btn secondary-btn"
                    >
                        Back to Cart
                    </Link>

                </div>

            </div>

        </div>

    );

};

export default PaymentFailed;
