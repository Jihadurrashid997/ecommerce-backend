const SSLCommerzPayment = require("sslcommerz-lts");

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;

// false = sandbox
// true = live
const is_live = false;


/*
====================================================
INITIALIZE SSL COMMERZ PAYMENT
POST /api/payment/sslcommerz
====================================================
*/

exports.initPayment = async (req, res) => {

    try {

        const {
            totalAmount,
            name,
            email,
            phone,
            address
        } = req.body;


        // Basic validation

        if (
            !totalAmount ||
            !name ||
            !email ||
            !phone ||
            !address
        ) {

            return res.status(400).json({
                message: "All payment information is required."
            });

        }


        if (Number(totalAmount) <= 0) {

            return res.status(400).json({
                message: "Invalid payment amount."
            });

        }


        if (!store_id || !store_passwd) {

            return res.status(500).json({
                message:
                    "SSLCommerz credentials are not configured."
            });

        }


        const transactionId =
            "TXN_" +
            Date.now();


        const data = {

            total_amount: Number(totalAmount),

            currency: "BDT",

            tran_id: transactionId,


            /*
            Frontend callback URLs
            */

            success_url:
                `${process.env.CLIENT_URL}/payment-success`,

            fail_url:
                `${process.env.CLIENT_URL}/payment-fail`,

            cancel_url:
                `${process.env.CLIENT_URL}/payment-cancel`,


            /*
            IPN must point to BACKEND,
            not frontend.
            */

            ipn_url:
                `${process.env.SERVER_URL}/api/payment/ipn`,


            shipping_method: "Courier",

            product_name: "Marketplace Order",

            product_category: "Ecommerce",

            product_profile: "general",


            /*
            Customer information
            */

            cus_name: name,

            cus_email: email,

            cus_add1: address,

            cus_city: "Dhaka",

            cus_country: "Bangladesh",

            cus_phone: phone

        };


        const sslcz =
            new SSLCommerzPayment(
                store_id,
                store_passwd,
                is_live
            );


        const apiResponse =
            await sslcz.init(data);


        if (!apiResponse) {

            return res.status(500).json({
                message:
                    "No response received from SSLCommerz."
            });

        }


        if (!apiResponse.GatewayPageURL) {

            return res.status(500).json({
                message:
                    "SSLCommerz gateway URL was not returned.",
                response: apiResponse
            });

        }


        res.status(200).json({

            success: true,

            gateway:
                apiResponse.GatewayPageURL,

            transactionId

        });


    } catch (err) {

        console.error(
            "SSLCommerz initialization error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Payment initialization failed."

        });

    }

};



/*
====================================================
PAYMENT SUCCESS
POST /api/payment/success
====================================================
*/

exports.paymentSuccess = async (req, res) => {

    try {

        console.log(
            "SSLCommerz SUCCESS:",
            req.body
        );


        /*
        SSLCommerz sends the user back to
        the frontend success URL.

        We return a simple response here
        for backend testing.
        */

        res.status(200).json({

            success: true,

            message:
                "Payment successful.",

            transactionId:
                req.body?.tran_id || null

        });


    } catch (err) {

        console.error(
            "Payment success error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};



/*
====================================================
PAYMENT FAILED
POST /api/payment/fail
====================================================
*/

exports.paymentFail = async (req, res) => {

    try {

        console.log(
            "SSLCommerz FAILED:",
            req.body
        );


        res.status(200).json({

            success: false,

            message:
                "Payment failed.",

            transactionId:
                req.body?.tran_id || null

        });


    } catch (err) {

        console.error(
            "Payment fail error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};



/*
====================================================
PAYMENT CANCELLED
POST /api/payment/cancel
====================================================
*/

exports.paymentCancel = async (req, res) => {

    try {

        console.log(
            "SSLCommerz CANCELLED:",
            req.body
        );


        res.status(200).json({

            success: false,

            message:
                "Payment was cancelled.",

            transactionId:
                req.body?.tran_id || null

        });


    } catch (err) {

        console.error(
            "Payment cancel error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};



/*
====================================================
IPN - INSTANT PAYMENT NOTIFICATION
POST /api/payment/ipn
====================================================
*/

exports.paymentIPN = async (req, res) => {

    try {

        console.log(
            "SSLCommerz IPN:",
            req.body
        );


        /*
        IMPORTANT:

        এখানে পরে Order database update করা যাবে
        যখন তোমার Order model-এর exact fields জানা যাবে.

        এখন IPN receive হচ্ছে কিনা সেটা নিশ্চিত করছি.
        */


        res.status(200).json({

            success: true,

            message:
                "IPN received successfully."

        });


    } catch (err) {

        console.error(
            "IPN error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message

        });

    }

};
