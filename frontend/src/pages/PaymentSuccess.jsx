import React from "react";
import { Link, useSearchParams } from "react-router-dom";

import "../styles/Payment.css";

const PaymentSuccess = () => {

    const [searchParams] = useSearchParams();

    const transactionId =
        searchParams.get("transactionId") ||
        searchParams.get("tran_id");


    return (

        <div className="payment-page">

            <div className="payment-card success-card">

                <div className="payment-icon">
                    ✓
                </div>


                <h1>
                    Payment Successful!
                </h1>


                <p>
                    Your payment has been completed successfully.
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
