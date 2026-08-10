const SSLCommerzPayment = require("sslcommerz-lts");
const Order = require("../models/Order");

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;

const is_live = false;


/*
====================================================
INITIALIZE PAYMENT
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
            "TXN_" + Date.now();


        /*
        Create pending order
        */

        const order = await Order.create({

            user: req.user.id,

            items: [],

            totalPrice: Number(totalAmount),

            shippingAddress: {
                name,
                phone,
                address,
                city: "Dhaka",
                postalCode: ""
            },

            paymentMethod: "sslcommerz",

            paymentStatus: "pending",

            status: "Pending",

            transactionId

        });


        const data = {

            total_amount: Number(totalAmount),

            currency: "BDT",

            tran_id: transactionId,


            /*
            Frontend URLs
            */

            success_url:
                `${process.env.CLIENT_URL}/payment-success?transactionId=${transactionId}`,

            fail_url:
                `${process.env.CLIENT_URL}/payment-fail?transactionId=${transactionId}`,

            cancel_url:
                `${process.env.CLIENT_URL}/payment-cancel?transactionId=${transactionId}`,


            /*
            Backend IPN URL
            */

            ipn_url:
                `${process.env.SERVER_URL}/api/payment/ipn`,


            shipping_method: "Courier",

            product_name: "Marketplace Order",

            product_category: "Ecommerce",

            product_profile: "general",


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


        if (!apiResponse?.GatewayPageURL) {

            await Order.findByIdAndUpdate(
                order._id,
                {
                    paymentStatus: "failed"
                }
            );

            return res.status(500).json({
                message:
                    "SSLCommerz gateway URL was not returned."
            });

        }


        res.status(200).json({

            success: true,

            gateway:
                apiResponse.GatewayPageURL,

            transactionId,

            orderId:
                order._id

        });


    } catch (err) {

        console.error(
            "SSLCommerz initialization error:",
            err
        );


        res.status(500).json({

            message:
                err.message ||
                "Payment initialization failed."

        });

    }

};



/*
====================================================
PAYMENT SUCCESS
====================================================
*/

exports.paymentSuccess = async (req, res) => {

    try {

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        if (transactionId) {

            await Order.findOneAndUpdate(

                {
                    transactionId
                },

                {
                    paymentStatus: "paid"
                }

            );

        }


        /*
        Redirect user to frontend
        */

        const frontendUrl =
            process.env.CLIENT_URL;


        res.redirect(
            `${frontendUrl}/payment-success?transactionId=${transactionId || ""}`
        );


    } catch (err) {

        console.error(
            "Payment success error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/payment-fail`
        );

    }

};



/*
====================================================
PAYMENT FAILED
====================================================
*/

exports.paymentFail = async (req, res) => {

    try {

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        if (transactionId) {

            await Order.findOneAndUpdate(

                {
                    transactionId
                },

                {
                    paymentStatus: "failed"
                }

            );

        }


        res.redirect(
            `${process.env.CLIENT_URL}/payment-fail?transactionId=${transactionId || ""}`
        );


    } catch (err) {

        console.error(
            "Payment fail error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/payment-fail`
        );

    }

};



/*
====================================================
PAYMENT CANCELLED
====================================================
*/

exports.paymentCancel = async (req, res) => {

    try {

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        if (transactionId) {

            await Order.findOneAndUpdate(

                {
                    transactionId
                },

                {
                    paymentStatus: "cancelled"
                }

            );

        }


        res.redirect(
            `${process.env.CLIENT_URL}/payment-cancel?transactionId=${transactionId || ""}`
        );


    } catch (err) {

        console.error(
            "Payment cancel error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/payment-cancel`
        );

    }

};



/*
====================================================
IPN
====================================================
*/

exports.paymentIPN = async (req, res) => {

    try {

        console.log(
            "SSLCommerz IPN:",
            req.body
        );


        const transactionId =
            req.body?.tran_id;


        if (!transactionId) {

            return res.status(400).json({
                message:
                    "Transaction ID is missing."
            });

        }


        /*
        Verify transaction with SSLCommerz
        */

        const sslcz =
            new SSLCommerzPayment(
                store_id,
                store_passwd,
                is_live
            );


        const validationResponse =
            await sslcz.validate(
                req.body.val_id
            );


        console.log(
            "SSLCommerz validation:",
            validationResponse
        );


        /*
        Check validation status
        */

        if (
            validationResponse?.status === "VALID" ||
            validationResponse?.status === "VALIDATED"
        ) {

            await Order.findOneAndUpdate(

                {
                    transactionId
                },

                {
                    paymentStatus: "paid"
                }

            );


            return res.status(200).json({

                success: true,

                message:
                    "Payment verified and order updated."

            });

        }


        /*
        Invalid payment
        */

        await Order.findOneAndUpdate(

            {
                transactionId
            },

            {
                paymentStatus: "failed"
            }

        );


        res.status(400).json({

            success: false,

            message:
                "Payment validation failed."

        });


    } catch (err) {

        console.error(
            "IPN verification error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "IPN verification failed."

        });

    }

};
