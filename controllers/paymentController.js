const SSLCommerzPayment = require("sslcommerz-lts");
const crypto = require("crypto");
const Order = require("../models/Order");
const { notifyShopUsers } = require("../services/shopNotifications");
const { getSSLCommerzConfig } = require("../services/sslcommerzConfig");

const amountsMatch = (provided, expected) => {
    const providedAmount = Number(provided);
    const expectedAmount = Number(expected);
    const providedCents = Math.round(providedAmount * 100);
    const expectedCents = Math.round(expectedAmount * 100);
    return Number.isFinite(providedAmount) &&
        Number.isFinite(expectedAmount) &&
        Math.abs(providedAmount * 100 - providedCents) < 0.000001 &&
        Math.abs(expectedAmount * 100 - expectedCents) < 0.000001 &&
        providedCents === expectedCents;
};

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
            .select("user status paymentStatus transactionId paymentEnvironment");

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
            orderStatus: order.status,
            paymentEnvironment: order.paymentEnvironment
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
        const config = getSSLCommerzConfig();

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

        const customerFields = [name, email, phone, address];
        const normalizedCustomer = customerFields.map(value =>
            typeof value === "string" ? value.trim() : ""
        );
        const [customerName, customerEmail, customerPhone, customerAddress] =
            normalizedCustomer;

        if (!orderId) {

            return res.status(400).json({
                message: "Order ID is required."
            });

        }


        if (
            !Number.isFinite(Number(totalAmount)) ||
            customerName.length < 1 ||
            customerName.length > 50 ||
            customerEmail.length < 3 ||
            customerEmail.length > 50 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
            customerPhone.length < 1 ||
            customerPhone.length > 20 ||
            customerAddress.length < 1 ||
            customerAddress.length > 50 ||
            String(city || "Dhaka").length > 50 ||
            String(postalCode || "").length > 30
        ) {

            return res.status(400).json({
                message:
                    "Enter valid customer details within the payment provider's field limits."
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

        if (
            order.reservationExpiresAt &&
            order.reservationExpiresAt <= new Date()
        ) {
            return res.status(409).json({
                message: "This order reservation has expired. Return to the Shop and place a new order."
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

        if (!amountsMatch(order.totalPrice, totalAmount)) {

            return res.status(400).json({
                message:
                    "Payment amount does not match order total."
            });

        }

        if (
            Number(order.totalPrice) < 10 ||
            Number(order.totalPrice) > 500000
        ) {
            return res.status(400).json({
                success: false,
                message: "Sandbox checkout amount must be between ৳10.00 and ৳500,000.00."
            });
        }


        transactionId = `TXN_${crypto.randomBytes(12).toString("hex")}`;


        const paymentAttemptStartedAt = new Date();
        const paymentAttempt = await Order.updateOne(
            {
                _id: order._id,
                user: req.user.id,
                status: { $ne: "Cancelled" },
                paymentStatus: order.paymentStatus,
                transactionId: order.transactionId || "",
                "refundRequest.status": { $nin: ["requested", "refunded"] },
                $or: [
                    { reservationExpiresAt: { $gt: paymentAttemptStartedAt } },
                    { reservationExpiresAt: null }
                ]
            },
            {
                $set: {
                    paymentMethod: "sslcommerz",
                    paymentEnvironment: config.mode,
                    transactionId,
                    paymentStatus: "pending",
                    shippingAddress: {
                        name,
                        phone,
                        address: customerAddress,
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
                `${config.serverUrl}/api/payment/success`,

            fail_url:
                `${config.serverUrl}/api/payment/fail`,

            cancel_url:
                `${config.serverUrl}/api/payment/cancel`,


            // SSLCommerz server will call this
            ipn_url:
                `${config.serverUrl}/api/payment/ipn`,


            shipping_method:
                "Courier",

            product_name:
                "Marketplace Order",

            product_category:
                "Ecommerce",

            product_profile:
                "general",


            cus_name:
                customerName,

            cus_email:
                customerEmail,

            cus_add1:
                customerAddress,

            cus_city:
                city || "Dhaka",

            cus_postcode:
                postalCode || "",

            cus_country:
                "Bangladesh",

            cus_phone:
                customerPhone

        };


        const sslcz =
            new SSLCommerzPayment(
                config.storeId,
                config.storePassword,
                config.isLive
            );


        const apiResponse =
            await sslcz.init(data);

        let gatewayUrl;
        try {
            const parsedGatewayUrl = new URL(apiResponse?.GatewayPageURL);
            if (
                parsedGatewayUrl.protocol === "https:" &&
                parsedGatewayUrl.hostname === "sandbox.sslcommerz.com"
            ) {
                gatewayUrl = parsedGatewayUrl.toString();
            }
        } catch (_error) {
            gatewayUrl = "";
        }

        if (
            !gatewayUrl
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
                gatewayUrl,

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
            "SSLCommerz sandbox initialization failed:",
            err?.name || "provider error"
        );
        res.status(500).json({
            success: false,
            message: "Sandbox payment initialization failed. Check backend configuration and SSLCommerz sandbox availability."
        });

    }

};



// ==================================================
// SUCCESS CALLBACK
// ==================================================

exports.paymentSuccess = async (req, res) => {

    try {
        const config = getSSLCommerzConfig();

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        if (!transactionId) {

            return res.redirect(
                `${config.clientUrl}/shop/payment-fail?reason=Transaction%20ID%20missing`
            );

        }


        const order =
            await Order.findOne({
                transactionId
            });


        if (!order) {

            return res.redirect(
                `${config.clientUrl}/shop/payment-fail?reason=Order%20not%20found`
            );

        }


        /*
        IMPORTANT:
        Do not mark paid only because
        customer reached success callback.

        IPN / validation should confirm it.
        */

        res.redirect(

            `${config.clientUrl}/shop/payment-success?transactionId=${encodeURIComponent(transactionId)}`

        );


    } catch (err) {

        console.error(
            "Success callback error:",
            err
        );


        res.redirect("/shop/payment-fail");

    }

};



// ==================================================
// FAILED CALLBACK
// ==================================================

exports.paymentFail = async (req, res) => {

    try {
        const config = getSSLCommerzConfig();

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        res.redirect(
            `${config.clientUrl}/shop/payment-fail?transactionId=${encodeURIComponent(transactionId || "")}`

        );


    } catch (err) {

        console.error(
            "Payment fail callback error:",
            err
        );


        res.redirect("/shop/payment-fail");

    }

};



// ==================================================
// CANCEL CALLBACK
// ==================================================

exports.paymentCancel = async (req, res) => {

    try {
        const config = getSSLCommerzConfig();

        const transactionId =
            req.body?.tran_id ||
            req.query?.transactionId;


        res.redirect(
            `${config.clientUrl}/shop/payment-cancel?transactionId=${encodeURIComponent(transactionId || "")}`

        );


    } catch (err) {

        console.error(
            "Payment cancel callback error:",
            err
        );


        res.redirect("/shop/payment-cancel");

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
            currency,
            currency_type

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

        if (
            order.reservationExpiresAt &&
            order.reservationExpiresAt <= new Date()
        ) {
            return res.status(409).json({
                success: false,
                message: "This order reservation expired before payment was confirmed."
            });
        }

        if (
            ["FAILED", "CANCELLED", "EXPIRED", "UNATTEMPTED"].includes(status)
        ) {
            if (
                !amountsMatch(amount, order.totalPrice) ||
                currency !== "BDT" ||
                currency_type !== "BDT"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Provider failure notification does not match this order."
                });
            }
            const paymentStatus = status === "FAILED" || status === "EXPIRED"
                ? "failed"
                : "cancelled";
            await markPaymentAttemptEnded(tran_id, paymentStatus);
            return res.status(200).json({
                success: true,
                message: `Payment attempt marked ${paymentStatus}.`
            });
        }

        /*
        Verify every IPN with the official server-side Order Validation API.
        */

        if (!val_id) {

            return res.status(400).json({
                message:
                    "Validation ID is missing."
            });

        }

        const config = getSSLCommerzConfig();

        const sslcz =
            new SSLCommerzPayment(
                config.storeId,
                config.storePassword,
                config.isLive
            );


        const validationResponse =
            await sslcz.validate({ val_id });

        if (validationResponse instanceof Error) {
            return res.status(503).json({
                success: false,
                message: "SSLCommerz validation service is temporarily unavailable. The payment remains unconfirmed."
            });
        }

        const validationStatus =
            validationResponse?.status;


        if (validationStatus !== "VALID" && validationStatus !== "VALIDATED") {
            return res.status(400).json({
                message:
                    "Payment validation failed."
            });
        }

        if (status !== "VALID" && status !== "VALIDATED") {
            return res.status(400).json({
                success: false,
                message: "IPN status does not indicate a successful validated payment."
            });
        }

        if (
            validationResponse.tran_id !== tran_id ||
            validationResponse.val_id !== val_id ||
            !amountsMatch(amount, order.totalPrice) ||
            !amountsMatch(validationResponse.amount, order.totalPrice) ||
            currency !== "BDT" ||
            currency_type !== "BDT" ||
            validationResponse.currency !== "BDT" ||
            validationResponse.currency_type !== "BDT"
        ) {
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
                paymentEnvironment: "sandbox",
                paymentStatus: { $nin: ["paid", "refunded"] },
                "refundRequest.status": { $ne: "refunded" },
                status: { $ne: "Cancelled" },
                $or: [
                    { reservationExpiresAt: { $gt: new Date() } },
                    { reservationExpiresAt: null }
                ]
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
            "Payment IPN verification failed:",
            err?.name || "provider error"
        );
        res.status(500).json({
            success: false,
            message: "Payment verification failed. Check backend logs and SSLCommerz sandbox availability."

        });

    }

};
