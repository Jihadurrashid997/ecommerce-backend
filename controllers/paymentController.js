const SSLCommerzPayment = require("sslcommerz-lts");
const Order = require("../models/Order");

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;

const is_live = false;


// ==================================================
// INITIATE PAYMENT
// POST /api/payment/sslcommerz
// ==================================================

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


        if (!store_id || !store_passwd) {

            return res.status(500).json({
                message:
                    "SSLCommerz credentials are not configured."
            });

        }


        const order =
            await Order.findById(orderId);


        if (!order) {

            return res.status(404).json({
                message: "Order not found."
            });

        }


        // Make sure the order belongs
        // to the logged-in customer

        if (
            order.user.toString() !==
            req.user.id.toString()
        ) {

            return res.status(403).json({
                message:
                    "You are not authorized to pay for this order."
            });

        }


        // Check amount

        if (
            Number(order.totalPrice) !==
            Number(totalAmount)
        ) {

            return res.status(400).json({
                message:
                    "Payment amount does not match order total."
            });

        }


        const transactionId =
            "TXN_" + Date.now();


        // Save transaction information

        order.paymentMethod =
            "sslcommerz";

        order.transactionId =
            transactionId;

        order.paymentStatus =
            "pending";

        order.shippingAddress = {

            name,
            phone,
            address,
            city: city || "Dhaka",
            postalCode: postalCode || ""

        };


        await order.save();


        const data = {

            total_amount:
                Number(order.totalPrice),

            currency:
                "BDT",

            tran_id:
                transactionId,


            // Customer will be redirected here
            success_url:
                `${process.env.CLIENT_URL}/payment-success?transactionId=${transactionId}`,

            fail_url:
                `${process.env.CLIENT_URL}/payment-fail?transactionId=${transactionId}`,

            cancel_url:
                `${process.env.CLIENT_URL}/payment-cancel?transactionId=${transactionId}`,


            // SSLCommerz server will call this
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


        const sslcz =
            new SSLCommerzPayment(
                store_id,
                store_passwd,
                is_live
            );


        const apiResponse =
            await sslcz.init(data);


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



// ==================================================
// SUCCESS CALLBACK
// ==================================================

exports.paymentSuccess = async (req, res) => {

    try {

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        if (!transactionId) {

            return res.redirect(
                `${process.env.CLIENT_URL}/payment-fail?reason=Transaction%20ID%20missing`
            );

        }


        const order =
            await Order.findOne({
                transactionId
            });


        if (!order) {

            return res.redirect(
                `${process.env.CLIENT_URL}/payment-fail?reason=Order%20not%20found`
            );

        }


        /*
        IMPORTANT:
        Do not mark paid only because
        customer reached success callback.

        IPN / validation should confirm it.
        */

        res.redirect(

            `${process.env.CLIENT_URL}/payment-success?transactionId=${transactionId}`

        );


    } catch (err) {

        console.error(
            "Success callback error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/payment-fail`
        );

    }

};



// ==================================================
// FAILED CALLBACK
// ==================================================

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
            "Payment fail callback error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/payment-fail`
        );

    }

};



// ==================================================
// CANCEL CALLBACK
// ==================================================

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
            "Payment cancel callback error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/payment-cancel`
        );

    }

};



// ==================================================
// IPN
// POST /api/payment/ipn
// ==================================================

exports.paymentIPN = async (req, res) => {

    try {

        const {

            tran_id,
            val_id,
            status,
            amount,
            currency

        } = req.body;


        console.log(
            "SSLCommerz IPN:",
            req.body
        );


        if (!tran_id) {

            return res.status(400).json({
                message:
                    "Transaction ID is missing."
            });

        }


        const order =
            await Order.findOne({
                transactionId: tran_id
            });


        if (!order) {

            return res.status(404).json({
                message:
                    "Order not found."
            });

        }


        /*
        Failed payment
        */

        if (
            status === "FAILED"
        ) {

            order.paymentStatus =
                "failed";

            await order.save();

            return res.status(200).json({
                message:
                    "Payment marked as failed."
            });

        }


        /*
        Cancelled payment
        */

        if (
            status === "CANCELLED"
        ) {

            order.paymentStatus =
                "cancelled";

            await order.save();

            return res.status(200).json({
                message:
                    "Payment marked as cancelled."
            });

        }


        /*
        Successful payment must be VALID
        */

        if (
            status !== "VALID" &&
            status !== "VALIDATED"
        ) {

            return res.status(400).json({
                message:
                    "Payment is not valid."
            });

        }


        /*
        Check amount
        */

        if (
            Number(amount) !==
            Number(order.totalPrice)
        ) {

            return res.status(400).json({
                message:
                    "Payment amount does not match order amount."
            });

        }


        /*
        Check currency
        */

        if (
            currency &&
            currency !== "BDT"
        ) {

            return res.status(400).json({
                message:
                    "Invalid payment currency."
            });

        }


        /*
        Validate transaction with SSLCommerz
        */

        if (!val_id) {

            return res.status(400).json({
                message:
                    "Validation ID is missing."
            });

        }


        const sslcz =
            new SSLCommerzPayment(
                store_id,
                store_passwd,
                is_live
            );


        const validationResponse =
            await sslcz.validate(val_id);


        console.log(
            "SSLCommerz validation response:",
            validationResponse
        );


        const validationStatus =
            validationResponse?.status;


        if (
            validationStatus !== "VALID" &&
            validationStatus !== "VALIDATED"
        ) {

            order.paymentStatus =
                "failed";

            await order.save();

            return res.status(400).json({
                message:
                    "Payment validation failed."
            });

        }


        /*
        Final successful payment
        */

        order.paymentStatus =
            "paid";


        await order.save();


        return res.status(200).json({

            success: true,

            message:
                "Payment verified and order marked as paid."

        });


    } catch (err) {

        console.error(
            "Payment IPN error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Payment verification failed."

        });

    }

};
