const SSLCommerzPayment = require("sslcommerz-lts");
const Order = require("../models/Order");

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;

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
            orderId,
            totalAmount,
            name,
            email,
            phone,
            address,
            city,
            postalCode
        } = req.body;


        /*
        Check required information
        */

        if (!orderId) {

            return res.status(400).json({
                message: "Order ID is required."
            });

        }


        if (
            !totalAmount ||
            !name ||
            !email ||
            !phone ||
            !address
        ) {

            return res.status(400).json({
                message:
                    "All payment information is required."
            });

        }


        /*
        Check SSLCommerz credentials
        */

        if (!store_id || !store_passwd) {

            return res.status(500).json({
                message:
                    "SSLCommerz credentials are not configured."
            });

        }


        /*
        Find order
        */

        const order =
            await Order.findById(orderId);


        if (!order) {

            return res.status(404).json({
                message: "Order not found."
            });

        }


        /*
        Make sure this order belongs
        to the logged-in user
        */

        if (
            order.user.toString() !==
            req.user.id.toString()
        ) {

            return res.status(403).json({
                message:
                    "You are not authorized to pay for this order."
            });

        }


        /*
        Make sure order is SSLCommerz
        */

        order.paymentMethod =
            "sslcommerz";


        /*
        Make sure amount matches
        */

        if (
            Number(order.totalPrice) !==
            Number(totalAmount)
        ) {

            return res.status(400).json({
                message:
                    "Payment amount does not match order total."
            });

        }


        /*
        Generate transaction ID
        */

        const transactionId =
            "TXN_" +
            Date.now();


        /*
        Save transaction ID
        */

        order.transactionId =
            transactionId;

        order.paymentStatus =
            "pending";


        /*
        Update shipping address
        */

        order.shippingAddress = {

            name:
                name,

            phone:
                phone,

            address:
                address,

            city:
                city || "Dhaka",

            postalCode:
                postalCode || ""

        };


        await order.save();


        /*
        SSLCommerz payment data
        */

        const data = {

            total_amount:
                Number(order.totalPrice),

            currency:
                "BDT",

            tran_id:
                transactionId,


            /*
            Frontend callback URLs
            */

            success_url:
                `${process.env.CLIENT_URL}/payment-success?transactionId=${transactionId}`,

            fail_url:
                `${process.env.CLIENT_URL}/payment-fail?transactionId=${transactionId}`,

            cancel_url:
                `${process.env.CLIENT_URL}/payment-cancel?transactionId=${transactionId}`,


            /*
            Backend IPN
            */

            ipn_url:
                `${process.env.SERVER_URL}/api/payment/ipn`,


            shipping_method:
                "Courier",

            product_name:
                "Marketplace Order",

            product_category:
                "Ecommerce",

            product_profile:
                "general",


            /*
            Customer information
            */

            cus_name:
                name,

            cus_email:
                email,

            cus_add1:
                address,

            cus_city:
                city || "Dhaka",

            cus_postcode:
                postalCode || "",

            cus_country:
                "Bangladesh",

            cus_phone:
                phone

        };


        /*
        Create SSLCommerz instance
        */

        const sslcz =
            new SSLCommerzPayment(
                store_id,
                store_passwd,
                is_live
            );


        /*
        Initialize payment
        */

        const apiResponse =
            await sslcz.init(data);


        /*
        Check gateway URL
        */

        if (
            !apiResponse ||
            !apiResponse.GatewayPageURL
        ) {

            order.paymentStatus =
                "failed";

            await order.save();


            return res.status(500).json({
                message:
                    "SSLCommerz gateway URL was not returned."
            });

        }


        /*
        Send gateway URL to frontend
        */

        res.status(200).json({

            success:
                true,

            gateway:
                apiResponse.GatewayPageURL,

            transactionId:
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

            success:
                false,

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

            const order =
                await Order.findOne({
                    transactionId
                });


            if (order) {

                order.paymentStatus =
                    "paid";

                await order.save();

            }

        }


        res.redirect(

            `${process.env.CLIENT_URL}/payment-success?transactionId=${transactionId || ""}`

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

            const order =
                await Order.findOne({
                    transactionId
                });


            if (order) {

                order.paymentStatus =
                    "failed";

                await order.save();

            }

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

            const order =
                await Order.findOne({
                    transactionId
                });


            if (order) {

                order.paymentStatus =
                    "cancelled";

                await order.save();

            }

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
IPN - PAYMENT VERIFICATION
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

        const valId =
            req.body?.val_id;


        if (!transactionId) {

            return res.status(400).json({

                success:
                    false,

                message:
                    "Transaction ID is missing."

            });

        }


        /*
        Find order
        */

        const order =
            await Order.findOne({
                transactionId
            });


        if (!order) {

            return res.status(404).json({

                success:
                    false,

                message:
                    "Order not found."

            });

        }


        /*
        If validation ID exists,
        verify payment with SSLCommerz.
        */

        if (valId) {

            const sslcz =
                new SSLCommerzPayment(
                    store_id,
                    store_passwd,
                    is_live
                );


            const validationResponse =
                await sslcz.validate(
                    valId
                );


            console.log(
                "SSLCommerz validation:",
                validationResponse
            );


            if (
                validationResponse?.status ===
                    "VALID" ||

                validationResponse?.status ===
                    "VALIDATED"
            ) {

                order.paymentStatus =
                    "paid";

                await order.save();


                return res.status(200).json({

                    success:
                        true,

                    message:
                        "Payment verified successfully."

                });

            }


            order.paymentStatus =
                "failed";

            await order.save();


            return res.status(400).json({

                success:
                    false,

                message:
                    "Payment validation failed."

            });

        }


        /*
        No validation ID
        */

        return res.status(400).json({

            success:
                false,

            message:
                "Payment validation ID is missing."

        });


    } catch (err) {

        console.error(
            "IPN verification error:",
            err
        );


        res.status(500).json({

            success:
                false,

            message:
                err.message ||
                "IPN verification failed."

        });

    }

};
