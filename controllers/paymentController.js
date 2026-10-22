const SSLCommerzPayment = require("sslcommerz-lts");
const crypto = require("crypto");
const Order = require("../models/Order");
const { notifyShopUsers } = require("../services/shopNotifications");

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;

const is_live = process.env.SSLC_IS_LIVE === "true";

const markPaymentAttemptEnded = async (transactionId, paymentStatus) => {
    const order = await Order.findOne({ transactionId })
        .select("_id user");
    const result = await Order.updateOne(
        {
            transactionId,
            paymentStatus: { $nin: ["paid", "refunded"] },
            "refundRequest.status": { $ne: "refunded" },
            status: { $ne: "Cancelled" }
        },
        {
            $set: {
                paymentStatus,
                "sellerSettlements.$[settlement].payoutStatus": "cancelled"
            }
        },
        {
            arrayFilters: [{
                "settlement.payoutStatus": "awaiting_payment"
            }]
        }
    );

    if (result.modifiedCount === 1 && order) {
        const failed = paymentStatus === "failed";
        await notifyShopUsers({
            recipients: [order.user],
            eventKey: `${order._id}:payment-${paymentStatus}:${transactionId}`,
            type: failed ? "payment_failed" : "payment_cancelled",
            title: failed ? "Shop payment failed" : "Shop payment cancelled",
            message: failed
                ? `Payment for order #${String(order._id).slice(-8)} failed. Review the order and try checkout again. / অর্ডারটির পেমেন্ট ব্যর্থ হয়েছে; অর্ডার দেখে আবার পেমেন্টের চেষ্টা করুন।`
                : `Payment for order #${String(order._id).slice(-8)} was cancelled. You can retry from your Shop orders. / অর্ডারটির পেমেন্ট বাতিল হয়েছে; Shop orders থেকে আবার চেষ্টা করতে পারেন।`,
            href: "/shop/orders",
            orderId: order._id
        });
    }
    return result;
};
exports.getPaymentStatus = async (req, res) => {
    try {
        const transactionId = String(req.params.transactionId || "").trim();

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Transaction ID is required."
            });
        }

        const order = await Order.findOne({ transactionId })
            .select("user status paymentStatus transactionId");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Payment not found."
            });
        }

        if (String(order.user) !== String(req.user.id) && req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this payment."
            });
        }

        return res.json({
            success: true,
            transactionId: order.transactionId,
            paymentStatus: order.paymentStatus,
            orderStatus: order.status
        });
    } catch (error) {
        console.error("GET PAYMENT STATUS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load payment status."
        });
    }
};


// ==================================================
// INITIATE PAYMENT
// POST /api/payment/sslcommerz
// ==================================================

exports.initPayment = async (req, res) => {
    let transactionId;

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

        if (order.status === "Cancelled") {
            return res.status(409).json({
                message: "Cancelled orders cannot be paid."
            });
        }

        if (order.paymentStatus === "refunded") {
            return res.status(409).json({
                message: "This order has already been refunded and cannot be paid again."
            });
        }

        if (order.paymentStatus === "paid") {
            return res.status(409).json({
                message: "This order has already been paid."
            });
        }

        if (order.paymentStatus === "pending" && order.transactionId) {
            return res.status(409).json({
                message: "A payment attempt is already active for this order. Wait for its result before retrying."
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


        transactionId = `TXN_${crypto.randomBytes(12).toString("hex")}`;


        const paymentAttempt = await Order.updateOne(
            {
                _id: order._id,
                user: req.user.id,
                status: { $ne: "Cancelled" },
                paymentStatus: order.paymentStatus,
                transactionId: order.transactionId || "",
                "refundRequest.status": { $nin: ["requested", "refunded"] }
            },
            {
                $set: {
                    paymentMethod: "sslcommerz",
                    transactionId,
                    paymentStatus: "pending",
                    shippingAddress: {
                        name,
                        phone,
                        address,
                        city: city || "Dhaka",
                        postalCode: postalCode || ""
                    },
                    "sellerSettlements.$[settlement].payoutStatus": "awaiting_payment"
                }
            },
            {
                arrayFilters: [{
                    "settlement.payoutStatus": { $in: ["awaiting_payment", "cancelled"] }
                }]
            }
        );

        if (paymentAttempt.modifiedCount !== 1) {
            return res.status(409).json({
                message: "Another payment attempt is active or this order is no longer payable."
            });
        }


        const data = {

            total_amount:
                Number(order.totalPrice),

            currency:
                "BDT",

            tran_id:
                transactionId,


            // Customer will be redirected here
            success_url:
                `${process.env.CLIENT_URL}/shop/payment-success?transactionId=${transactionId}`,

            fail_url:
                `${process.env.CLIENT_URL}/shop/payment-fail?transactionId=${transactionId}`,

            cancel_url:
                `${process.env.CLIENT_URL}/shop/payment-cancel?transactionId=${transactionId}`,


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
            await markPaymentAttemptEnded(transactionId, "failed");


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
        if (transactionId) {
            try {
                await markPaymentAttemptEnded(transactionId, "failed");
            } catch (statusError) {
                console.error("PAYMENT INITIALIZATION STATUS ERROR:", statusError);
            }
        }

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
                `${process.env.CLIENT_URL}/shop/payment-fail?reason=Transaction%20ID%20missing`
            );

        }


        const order =
            await Order.findOne({
                transactionId
            });


        if (!order) {

            return res.redirect(
                `${process.env.CLIENT_URL}/shop/payment-fail?reason=Order%20not%20found`
            );

        }


        /*
        IMPORTANT:
        Do not mark paid only because
        customer reached success callback.

        IPN / validation should confirm it.
        */

        res.redirect(

            `${process.env.CLIENT_URL}/shop/payment-success?transactionId=${transactionId}`

        );


    } catch (err) {

        console.error(
            "Success callback error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/shop/payment-fail`
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

            await markPaymentAttemptEnded(transactionId, "failed");

        }


        res.redirect(

            `${process.env.CLIENT_URL}/shop/payment-fail?transactionId=${transactionId || ""}`

        );


    } catch (err) {

        console.error(
            "Payment fail callback error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/shop/payment-fail`
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

            await markPaymentAttemptEnded(transactionId, "cancelled");

        }


        res.redirect(

            `${process.env.CLIENT_URL}/shop/payment-cancel?transactionId=${transactionId || ""}`

        );


    } catch (err) {

        console.error(
            "Payment cancel callback error:",
            err
        );


        res.redirect(
            `${process.env.CLIENT_URL}/shop/payment-cancel`
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

        if (order.paymentStatus === "paid") {
            return res.status(200).json({
                success: true,
                message: "Payment was already verified."
            });
        }

        if (order.paymentStatus === "refunded") {
            return res.status(409).json({
                success: false,
                message: "This order has already been refunded and cannot be paid again."
            });
        }

        if (order.status === "Cancelled") {
            return res.status(409).json({
                success: false,
                message: "A cancelled order cannot be paid."
            });
        }

        /*
        Failed payment
        */

        if (
            status === "FAILED"
        ) {

            await markPaymentAttemptEnded(tran_id, "failed");

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

            await markPaymentAttemptEnded(tran_id, "cancelled");

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


        const validationStatus =
            validationResponse?.status;


        if (
            validationStatus !== "VALID" &&
            validationStatus !== "VALIDATED"
        ) {

            await markPaymentAttemptEnded(tran_id, "failed");

            return res.status(400).json({
                message:
                    "Payment validation failed."
            });

        }

        if (
            validationResponse.tran_id !== tran_id ||
            Number(validationResponse.amount) !== Number(order.totalPrice) ||
            validationResponse.currency !== "BDT"
        ) {
            await markPaymentAttemptEnded(tran_id, "failed");
            return res.status(400).json({
                message: "Validated payment details do not match this order."
            });
        }


        /*
        Final successful payment
        */

        const paymentUpdate = await Order.updateOne(
            {
                _id: order._id,
                transactionId: tran_id,
                paymentStatus: { $nin: ["paid", "refunded"] },
                "refundRequest.status": { $ne: "refunded" },
                status: { $ne: "Cancelled" }
            },
            {
                $set: {
                    paymentStatus: "paid",
                    "sellerSettlements.$[settlement].payoutStatus": "held"
                }
            },
            {
                arrayFilters: [{
                    "settlement.payoutStatus": {
                        $in: ["awaiting_payment", "cancelled"]
                    }
                }]
            }
        );

        if (paymentUpdate.modifiedCount !== 1) {
            const currentOrder = await Order.findById(order._id)
                .select("paymentStatus status refundRequest.status");

            if (currentOrder?.paymentStatus === "paid") {
                return res.status(200).json({
                    success: true,
                    message: "Payment was already verified."
                });
            }

            return res.status(409).json({
                success: false,
                message: "Order changed while payment was being confirmed. Please contact Shop support."
            });
        }

        const orderNumber = String(order._id).slice(-8);
        await notifyShopUsers({
            recipients: [order.user],
            eventKey: `${order._id}:payment-received`,
            type: "payment_received",
            title: "Shop payment confirmed",
            message: `Payment for order #${orderNumber} was confirmed. / অর্ডারটির পেমেন্ট নিশ্চিত হয়েছে।`,
            href: "/shop/orders",
            orderId: order._id
        });
        await notifyShopUsers({
            recipients: (order.sellerSettlements || []).map(
                settlement => settlement.seller
            ),
            eventKey: `${order._id}:new-paid-order`,
            type: "payment_received",
            title: "New paid Shop order",
            message: `Order #${orderNumber} has been paid. Review your seller orders to prepare fulfillment. Buyer identity remains private. / অর্ডারটির পেমেন্ট হয়েছে; পণ্য পাঠানোর প্রস্তুতির জন্য seller orders দেখুন। ক্রেতার পরিচয় গোপন।`,
            href: "/shop/seller/orders",
            orderId: order._id
        });

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
