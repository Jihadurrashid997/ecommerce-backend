const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const marketplaceSettings = require("../services/marketplaceSettings");

const getCustomerOrder = order => {
    const result = typeof order.toObject === "function"
        ? order.toObject()
        : { ...order };
    const refundRequest = result.refundRequest || {};
    result.sellerSettlements = (result.sellerSettlements || []).map(
        settlement => ({
            _id: settlement._id,
            amount: settlement.amount,
            deliveryStatus: settlement.deliveryStatus,
            receiptConfirmedAt: settlement.receiptConfirmedAt,
            sellerConfirmedAt: settlement.sellerConfirmedAt,
            payoutStatus: settlement.payoutStatus
        })
    );
    result.refundRequest = {
        status: refundRequest.status || "none",
        reason: refundRequest.reason || "",
        requestedAt: refundRequest.requestedAt || null,
        adminNote: refundRequest.adminNote || "",
        reviewedAt: refundRequest.reviewedAt || null,
        refundMethod: refundRequest.refundMethod || "",
        refundReference: refundRequest.refundReference || "",
        refundedAt: refundRequest.refundedAt || null
    };
    return result;
};

const updateOverallDeliveryStatus = order => {
    const statuses = (order.sellerSettlements || [])
        .map(settlement => settlement.deliveryStatus);

    if (!statuses.length) {
        return;
    }

    if (statuses.every(status => status === "Cancelled")) {
        order.status = "Cancelled";
    } else if (statuses.every(status =>
        status === "Delivered" || status === "Cancelled"
    )) {
        order.status = "Delivered";
    } else if (statuses.some(status =>
        status === "Shipped" || status === "Delivered"
    )) {
        order.status = "Shipped";
    } else if (statuses.some(status => status === "Processing")) {
        order.status = "Processing";
    } else {
        order.status = "Pending";
    }
};

// ========================================
// CREATE ORDER
// ========================================

exports.createOrder = async (req, res) => {
    const reservedStock = [];
    let orderCreated = false;

    const restoreReservedStock = async () => {
        while (reservedStock.length) {
            const { productId, quantity } = reservedStock[0];
            await Product.updateOne(
                { _id: productId },
                { $inc: { stock: quantity } }
            );
            reservedStock.shift();
        }
    };

    try {
        const settings =
            await marketplaceSettings.getMarketplaceSettings();

        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                message: "The Shop is temporarily closed."
            });
        }

        const {
            items,
            shippingAddress,
            paymentMethod
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Order must contain at least one product"
            });
        }

        const recipientName = String(shippingAddress?.name || "").trim();
        const recipientPhone = String(shippingAddress?.phone || "").trim();
        const recipientAddress = String(shippingAddress?.address || "").trim();
        if (!recipientName || !recipientPhone || !recipientAddress) {
            return res.status(400).json({
                message: "Recipient name, phone, and delivery address are required."
            });
        }

        if (paymentMethod && paymentMethod !== "sslcommerz") {
            return res.status(400).json({
                message: "SSLCommerz is the only currently supported Shop payment method."
            });
        }

        const requestedQuantities = new Map();
        for (const item of items) {
            const productId = String(item?.product || item?._id || "");
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({
                    message: "One or more products are invalid."
                });
            }

            const quantity = item.quantity === undefined
                ? 1
                : Number(item.quantity);
            if (!Number.isSafeInteger(quantity) || quantity < 1) {
                return res.status(400).json({
                    message: "Product quantities must be positive whole numbers."
                });
            }

            const totalQuantity =
                (requestedQuantities.get(productId) || 0) + quantity;
            if (!Number.isSafeInteger(totalQuantity)) {
                return res.status(400).json({
                    message: "Requested quantity is too large."
                });
            }
            requestedQuantities.set(productId, totalQuantity);
        }

        let totalPrice = 0;
        const orderItems = [];
        const sellerAmounts = new Map();

        const products = new Map();
        for (const [productId, quantity] of requestedQuantities) {
            const product = await Product.findById(productId);

            if (!product) {
                return res.status(404).json({
                    message: "Product not found"
                });
            }

            if (!product.seller) {
                return res.status(400).json({
                    message: `${product.name} is not linked to a seller.`
                });
            }

            if (
                settings.requireProductApproval &&
                product.isApproved === false
            ) {
                return res.status(404).json({
                    message: "One of the products is not available."
                });
            }

            if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
                return res.status(400).json({
                    message: `${product.name} has an invalid price.`
                });
            }

            if (
                product.stock !== undefined &&
                product.stock !== null &&
                product.stock < quantity
            ) {
                return res.status(400).json({
                    message: `${product.name} is out of stock`
                });
            }

            products.set(productId, { product, quantity });
        }

        for (const [productId, { product: savedProduct, quantity }] of products) {
            let product = savedProduct;

            if (savedProduct.stock !== undefined && savedProduct.stock !== null) {
                product = await Product.findOneAndUpdate(
                    {
                        _id: productId,
                        seller: savedProduct.seller,
                        stock: { $gte: quantity },
                        ...(settings.requireProductApproval
                            ? { isApproved: { $ne: false } }
                            : {})
                    },
                    { $inc: { stock: -quantity } },
                    { new: true }
                );

                if (!product) {
                    await restoreReservedStock();
                    return res.status(409).json({
                        message: `${savedProduct.name} no longer has enough stock. Please refresh your cart.`
                    });
                }

                reservedStock.push({ productId, quantity });
            }

            if (
                !product.seller ||
                (
                    settings.requireProductApproval &&
                    product.isApproved === false
                )
            ) {
                if (reservedStock.length) {
                    await restoreReservedStock();
                }
                return res.status(409).json({
                    message: "One of the products is no longer available."
                });
            }

            totalPrice += product.price * quantity;
            if (!Number.isFinite(totalPrice)) {
                throw new Error("Order total is invalid.");
            }

            const sellerId = String(product.seller);
            sellerAmounts.set(
                sellerId,
                (sellerAmounts.get(sellerId) || 0) + product.price * quantity
            );

            orderItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity,
                image: product.image || ""
            });
        }

        const order = await Order.create({
            user: req.user.id,
            items: orderItems,
            totalPrice,
            shippingAddress: {
                name: recipientName,
                phone: recipientPhone,
                address: recipientAddress,
                city: String(shippingAddress?.city || "").trim(),
                postalCode: String(shippingAddress?.postalCode || "").trim()
            },
            paymentMethod: "sslcommerz",
            sellerSettlements: Array.from(sellerAmounts, ([seller, amount]) => ({
                seller,
                amount,
                payoutStatus: "awaiting_payment"
            }))
        });
        orderCreated = true;

        res.status(201).json({
            message: "Order created successfully",
            order: getCustomerOrder(order)
        });

    } catch (err) {
        console.error(err);

        if (!orderCreated && reservedStock.length) {
            try {
                await restoreReservedStock();
            } catch (rollbackError) {
                console.error("ORDER STOCK ROLLBACK ERROR:", rollbackError);
                return res.status(500).json({
                    message: "Checkout could not be completed safely. Contact Shop support before retrying."
                });
            }
        }

        res.status(500).json({
            message: err.message
        });
    }
};


// ========================================
// CUSTOMER - MY ORDERS
// ========================================

exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.user.id
        })
            .populate("items.product", "name image price")
            .sort({ createdAt: -1 });

        res.json(orders.map(getCustomerOrder));

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
};


// ========================================
// GET SINGLE ORDER
// ========================================

exports.getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("items.product", "name image price");

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        if (
            String(order.user) !== String(req.user.id) &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                message: "Not authorized"
            });
        }

        res.json(
            req.user.role === "admin"
                ? order
                : getCustomerOrder(order)
        );

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
};


// ========================================
// CUSTOMER - CANCEL ORDER
// ========================================

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.id,
                status: {
                    $nin: ["Cancelled", "Shipped", "Delivered"]
                },
                paymentStatus: { $ne: "paid" },
                $or: [
                    { paymentStatus: { $ne: "pending" } },
                    {
                        paymentStatus: "pending",
                        transactionId: ""
                    },
                    {
                        paymentStatus: "pending",
                        transactionId: { $exists: false }
                    }
                ]
            },
            {
                $set: {
                    status: "Cancelled",
                    "sellerSettlements.$[settlement].deliveryStatus": "Cancelled",
                    "sellerSettlements.$[settlement].payoutStatus": "cancelled"
                }
            },
            {
                new: true,
                arrayFilters: [{
                    "settlement.payoutStatus": { $ne: "paid" }
                }]
            }
        );

        if (!order) {
            return res.status(409).json({
                message: "This order is not eligible for unpaid cancellation. Paid eligible orders can submit a full-order refund request from Order History."
            });
        }

        // Restore stock for every item in this order, since it
        // was deducted when the order was placed. Without this,
        // cancelled orders would permanently shrink stock.
        for (const item of order.items) {

            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: item.quantity } }
            );

        }

        res.json({
            message: "Order cancelled successfully",
            order: getCustomerOrder(order)
        });

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
};


// ========================================
// SELLER - GET MY PRODUCT ORDERS
// ========================================

exports.getSellerOrders = async (req, res) => {
    try {

        const seller = await User.findById(req.user.id)
            .select("+payoutMethod +payoutAccount");
        const products = await Product.find({
            seller: req.user.id
        }).select("_id");

        const productIds = products.map(
            product => product._id
        );

        const orders = await Order.find({
            $or: [
                { "sellerSettlements.seller": req.user.id },
                {
                    "items.product": {
                        $in: productIds
                    }
                }
            ]
        })
            .populate(
                "items.product",
                "name price image seller"
            )
            .sort({
                createdAt: -1
            });

        const sellerOrders = orders.map(order => {

            const sellerItems = order.items.filter(
                item =>
                    item.product &&
                    item.product.seller &&
                    item.product.seller.toString() ===
                    req.user.id.toString()
            );

            const settlement = (order.sellerSettlements || []).find(
                record => String(record.seller) === String(req.user.id)
            );

            return {
                _id: order._id,
                items: sellerItems.map(item => ({
                    ...item.toObject(),
                    product: item.product
                        ? {
                              _id: item.product._id,
                              name: item.product.name,
                              price: item.product.price,
                              image: item.product.image
                          }
                        : null
                })),
                totalPrice: settlement?.amount ?? sellerItems.reduce(
                    (total, item) =>
                        total +
                        item.price * item.quantity,
                    0
                ),
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                refundStatus: order.refundRequest?.status || "none",
                status: settlement?.deliveryStatus || order.status,
                payout: settlement
                    ? {
                          id: settlement._id,
                          amount: settlement.amount,
                          status: settlement.payoutStatus,
                          receiptConfirmedAt: settlement.receiptConfirmedAt,
                          sellerConfirmedAt: settlement.sellerConfirmedAt,
                          payoutMethod: settlement.sellerPayoutMethod ||
                              seller?.payoutMethod || "",
                          payoutAccount: settlement.sellerPayoutAccount ||
                              seller?.payoutAccount || ""
                      }
                    : null,
                shippingAddress: order.shippingAddress,
                createdAt: order.createdAt
            };

        });

        res.json(sellerOrders);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: err.message
        });
    }
};


// ========================================
// SELLER - UPDATE ORDER STATUS
// ========================================

exports.updateSellerOrderStatus = async (
    req,
    res
) => {

    try {

        const {
            status
        } = req.body;

        const allowedStatuses = [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid order status"
            });
        }

        const order = await Order.findById(
            req.params.id
        ).populate(
            "items.product",
            "seller"
        );

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        const sellerOwnsProduct =
            order.items.some(
                item =>
                    item.product &&
                    item.product.seller &&
                    item.product.seller.toString() ===
                    req.user.id.toString()
            );

        if (!sellerOwnsProduct) {
            return res.status(403).json({
                message:
                    "You are not authorized to update this order"
            });
        }

        const settlement = (order.sellerSettlements || []).find(
            record => String(record.seller) === String(req.user.id)
        );

        if (order.status === "Cancelled") {
            return res.status(400).json({
                message: "Cancelled orders cannot be changed by a seller."
            });
        }

        if (["requested", "refunded"].includes(order.refundRequest?.status)) {
            return res.status(409).json({
                message: "Shipment updates are paused while the Shop reviews this refund request."
            });
        }

        if (order.paymentStatus === "paid" && status === "Cancelled") {
            return res.status(400).json({
                message: "Paid orders must use the Shop refund request and review process."
            });
        }

        if (settlement) {
            if (
                (settlement.receiptConfirmedAt || settlement.sellerConfirmedAt) &&
                status !== "Delivered"
            ) {
                return res.status(400).json({
                    message: "Delivery cannot be changed after either party confirms the delivered shipment."
                });
            }

            settlement.deliveryStatus = status;
            updateOverallDeliveryStatus(order);
        } else {
            order.status = status;
        }

        await order.save();

        res.json({
            message:
                "Order status updated successfully",
            order
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: err.message
        });
    }
};

const markSettlementReadyForPayout = (orderId, fulfillmentId) =>
    Order.updateOne(
        {
            _id: orderId,
            paymentStatus: "paid",
            "refundRequest.status": { $nin: ["requested", "refunded"] },
            sellerSettlements: {
                $elemMatch: {
                    _id: fulfillmentId,
                    deliveryStatus: "Delivered",
                    payoutStatus: "held",
                    receiptConfirmedAt: { $ne: null },
                    sellerConfirmedAt: { $ne: null }
                }
            }
        },
        {
            $set: {
                "sellerSettlements.$.payoutStatus": "ready"
            }
        }
    );

// ========================================
// CUSTOMER - CONFIRM RECEIPT
// ========================================

exports.confirmOrderReceipt = async (req, res) => {
    if (
        !mongoose.Types.ObjectId.isValid(req.params.id) ||
        !mongoose.Types.ObjectId.isValid(req.params.fulfillmentId)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid order or shipment ID."
        });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.id,
                paymentStatus: "paid",
                "refundRequest.status": { $nin: ["requested", "refunded"] },
                sellerSettlements: {
                    $elemMatch: {
                        _id: req.params.fulfillmentId,
                        deliveryStatus: "Delivered",
                        payoutStatus: "held",
                        receiptConfirmedAt: null
                    }
                }
            },
            {
                $set: {
                    "sellerSettlements.$.receiptConfirmedAt": new Date()
                }
            },
            { new: true }
        );

        if (!order) {
            return res.status(409).json({
                success: false,
                message: "Receipt can only be confirmed for a paid shipment marked delivered."
            });
        }

        await markSettlementReadyForPayout(
            req.params.id,
            req.params.fulfillmentId
        );

        return res.json({
            success: true,
            message: "Receipt confirmed. Payout becomes ready after the seller also confirms."
        });
    } catch (error) {
        console.error("CONFIRM ORDER RECEIPT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not confirm order receipt."
        });
    }
};

// ========================================
// SELLER - CONFIRM DELIVERY AND PAYOUT AMOUNT
// ========================================

exports.confirmSellerPayout = async (req, res) => {
    if (
        !mongoose.Types.ObjectId.isValid(req.params.id) ||
        !mongoose.Types.ObjectId.isValid(req.params.fulfillmentId)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid order or shipment ID."
        });
    }

    try {
        const payoutMethod = String(req.body?.payoutMethod || "").trim();
        const payoutAccount = String(req.body?.payoutAccount || "").trim();
        const seller = await User.findById(req.user.id)
            .select("+payoutMethod +payoutAccount");

        if (
            !seller?.payoutMethod ||
            !seller?.payoutAccount
        ) {
            return res.status(400).json({
                success: false,
                message: "Save your payout method and account in your Seller Dashboard before confirming."
            });
        }

        if (
            payoutMethod !== seller.payoutMethod ||
            payoutAccount !== seller.payoutAccount
        ) {
            return res.status(409).json({
                success: false,
                message: "Your payout details changed. Refresh the order and review them before confirming."
            });
        }

        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                paymentStatus: "paid",
                "refundRequest.status": { $nin: ["requested", "refunded"] },
                sellerSettlements: {
                    $elemMatch: {
                        _id: req.params.fulfillmentId,
                        seller: req.user.id,
                        deliveryStatus: "Delivered",
                        payoutStatus: "held",
                        sellerConfirmedAt: null
                    }
                }
            },
            {
                $set: {
                    "sellerSettlements.$.sellerConfirmedAt": new Date(),
                    "sellerSettlements.$.sellerPayoutMethod": seller.payoutMethod,
                    "sellerSettlements.$.sellerPayoutAccount": seller.payoutAccount
                }
            },
            { new: true }
        );

        if (!order) {
            return res.status(409).json({
                success: false,
                message: "You can confirm only your paid, delivered shipment, and only once."
            });
        }

        await markSettlementReadyForPayout(
            req.params.id,
            req.params.fulfillmentId
        );

        return res.json({
            success: true,
            message: "Shipment and payout amount confirmed. Payout becomes ready after the buyer also confirms receipt."
        });
    } catch (error) {
        console.error("CONFIRM SELLER PAYOUT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not confirm the shipment and payout amount."
        });
    }
};

// ========================================
// ADMIN - SELLER PAYOUT QUEUE
// ========================================

exports.getReadySellerPayouts = async (_req, res) => {
    try {
        const orders = await Order.find({
            paymentStatus: "paid",
            "refundRequest.status": { $nin: ["requested", "refunded"] },
            sellerSettlements: {
                $elemMatch: {
                    deliveryStatus: "Delivered",
                    payoutStatus: "ready",
                    receiptConfirmedAt: { $ne: null },
                    sellerConfirmedAt: { $ne: null }
                }
            }
        })
            .populate({
                path: "sellerSettlements.seller",
                select: "name email"
            })
            .sort({ updatedAt: -1 });

        const payouts = orders.flatMap(order =>
            (order.sellerSettlements || [])
                .filter(settlement =>
                    settlement.payoutStatus === "ready" &&
                    settlement.deliveryStatus === "Delivered" &&
                    settlement.receiptConfirmedAt &&
                    settlement.sellerConfirmedAt &&
                    settlement.seller
                )
                .map(settlement => ({
                    orderId: order._id,
                    orderNumber: String(order._id).slice(-8),
                    fulfillmentId: settlement._id,
                    amount: settlement.amount,
                    transactionId: order.transactionId,
                    seller: {
                        id: settlement.seller._id,
                        name: settlement.seller.name,
                        email: settlement.seller.email,
                        payoutMethod: settlement.sellerPayoutMethod || "",
                        payoutAccount: settlement.sellerPayoutAccount || ""
                    },
                    receiptConfirmedAt: settlement.receiptConfirmedAt,
                    sellerConfirmedAt: settlement.sellerConfirmedAt
                }))
        );

        return res.json({ success: true, payouts });
    } catch (error) {
        console.error("GET READY SELLER PAYOUTS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load seller payouts."
        });
    }
};

exports.markSellerPayoutPaid = async (req, res) => {
    const payoutMethod = String(req.body?.payoutMethod || "").trim();
    const payoutReference = String(req.body?.payoutReference || "").trim();

    if (!payoutMethod || !payoutReference) {
        return res.status(400).json({
            success: false,
            message: "Payout method and transfer reference are required."
        });
    }

    if (payoutMethod.length > 40 || payoutReference.length > 120) {
        return res.status(400).json({
            success: false,
            message: "Payout details are too long."
        });
    }

    if (
        !mongoose.Types.ObjectId.isValid(req.params.id) ||
        !mongoose.Types.ObjectId.isValid(req.body.fulfillmentId)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid order or shipment ID."
        });
    }

    try {
        const order = await Order.findOne({
            _id: req.params.id,
            paymentStatus: "paid",
            "refundRequest.status": { $nin: ["requested", "refunded"] },
            sellerSettlements: {
                $elemMatch: {
                    _id: req.body.fulfillmentId,
                    deliveryStatus: "Delivered",
                    payoutStatus: "ready",
                    receiptConfirmedAt: { $ne: null },
                    sellerConfirmedAt: { $ne: null }
                }
            }
        }).populate({
            path: "sellerSettlements.seller",
            select: "name email"
        });

        const settlement = order?.sellerSettlements?.find(
            entry => String(entry._id) === String(req.body.fulfillmentId)
        );

        if (!settlement) {
            return res.status(409).json({
                success: false,
                message: "This payout is not ready or has already been processed."
            });
        }

        if (
            !settlement.sellerPayoutMethod ||
            !settlement.sellerPayoutAccount
        ) {
            return res.status(400).json({
                success: false,
                message: "The seller's confirmed payout details are missing."
            });
        }

        const result = await Order.updateOne(
            {
                _id: req.params.id,
                paymentStatus: "paid",
                "refundRequest.status": { $nin: ["requested", "refunded"] },
                sellerSettlements: {
                    $elemMatch: {
                        _id: req.body.fulfillmentId,
                        deliveryStatus: "Delivered",
                        payoutStatus: "ready",
                        receiptConfirmedAt: { $ne: null },
                        sellerConfirmedAt: { $ne: null }
                    }
                }
            },
            {
                $set: {
                    "sellerSettlements.$[settlement].payoutStatus": "paid",
                    "sellerSettlements.$[settlement].payoutMethod": payoutMethod,
                    "sellerSettlements.$[settlement].payoutReference": payoutReference,
                    "sellerSettlements.$[settlement].payoutPaidAt": new Date(),
                    "sellerSettlements.$[settlement].payoutPaidBy": req.user.id
                }
            },
            {
                arrayFilters: [{
                    "settlement._id": req.body.fulfillmentId,
                    "settlement.deliveryStatus": "Delivered",
                    "settlement.payoutStatus": "ready",
                    "settlement.receiptConfirmedAt": { $ne: null },
                    "settlement.sellerConfirmedAt": { $ne: null }
                }]
            }
        );

        if (result.modifiedCount !== 1) {
            return res.status(409).json({
                success: false,
                message: "This payout is not ready or has already been processed."
            });
        }

        return res.json({
            success: true,
            message: "Seller payout recorded as paid."
        });
    } catch (error) {
        console.error("MARK SELLER PAYOUT PAID ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not record seller payout."
        });
    }
};

// ========================================
// CUSTOMER - REQUEST A FULL ORDER REFUND
// ========================================

exports.requestOrderRefund = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid order ID."
        });
    }

    const reason = typeof req.body?.reason === "string"
        ? req.body.reason.trim()
        : "";
    if (reason.length < 10 || reason.length > 1000) {
        return res.status(400).json({
            success: false,
            message: "Explain the refund request in 10 to 1000 characters."
        });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.id,
                paymentStatus: "paid",
                status: { $ne: "Cancelled" },
                "refundRequest.status": { $nin: ["requested", "refunded"] },
                sellerSettlements: {
                    $not: {
                        $elemMatch: { payoutStatus: "paid" }
                    }
                }
            },
            {
                $set: {
                    "refundRequest.status": "requested",
                    "refundRequest.reason": reason,
                    "refundRequest.requestedAt": new Date(),
                    "refundRequest.adminNote": "",
                    "refundRequest.reviewedAt": null,
                    "refundRequest.reviewedBy": null,
                    "refundRequest.refundMethod": "",
                    "refundRequest.refundReference": "",
                    "refundRequest.refundedAt": null
                }
            },
            { new: true }
        );

        if (!order) {
            return res.status(409).json({
                success: false,
                message: "This paid order cannot be refunded in the Shop: it may be cancelled, already under review/refunded, unpaid, or its seller payout has already been sent."
            });
        }

        return res.json({
            success: true,
            message: "Your full-order refund request was sent to Shop administrators. The refund is not automatic.",
            order: getCustomerOrder(order)
        });
    } catch (error) {
        console.error("REQUEST ORDER REFUND ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not submit the refund request."
        });
    }
};

// ========================================
// ADMIN - REFUND REQUEST QUEUE
// ========================================

exports.getRequestedOrderRefunds = async (_req, res) => {
    try {
        const orders = await Order.find({
            paymentStatus: "paid",
            "refundRequest.status": "requested",
            sellerSettlements: {
                $not: {
                    $elemMatch: { payoutStatus: "paid" }
                }
            }
        })
            .populate("user", "name email")
            .sort({ "refundRequest.requestedAt": 1 });

        return res.json({
            success: true,
            refunds: orders
        });
    } catch (error) {
        console.error("GET ORDER REFUNDS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load refund requests."
        });
    }
};

exports.rejectOrderRefund = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid order ID."
        });
    }

    const adminNote = typeof req.body?.adminNote === "string"
        ? req.body.adminNote.trim()
        : "";
    if (adminNote.length < 3 || adminNote.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Provide a review note between 3 and 500 characters."
        });
    }

    try {
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                paymentStatus: "paid",
                "refundRequest.status": "requested",
                sellerSettlements: {
                    $not: {
                        $elemMatch: { payoutStatus: "paid" }
                    }
                }
            },
            {
                $set: {
                    "refundRequest.status": "rejected",
                    "refundRequest.adminNote": adminNote,
                    "refundRequest.reviewedAt": new Date(),
                    "refundRequest.reviewedBy": req.user.id
                }
            },
            { new: true }
        );

        if (!order) {
            return res.status(409).json({
                success: false,
                message: "This refund request is no longer pending or the seller payout has already been sent."
            });
        }

        return res.json({
            success: true,
            message: "Refund request rejected with a review note."
        });
    } catch (error) {
        console.error("REJECT ORDER REFUND ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not reject the refund request."
        });
    }
};

exports.recordOrderRefund = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid order ID."
        });
    }

    const refundMethod = typeof req.body?.refundMethod === "string"
        ? req.body.refundMethod.trim()
        : "";
    const refundReference = typeof req.body?.refundReference === "string"
        ? req.body.refundReference.trim()
        : "";
    const adminNote = typeof req.body?.adminNote === "string"
        ? req.body.adminNote.trim()
        : "";
    if (
        !refundMethod ||
        refundMethod.length > 40 ||
        !refundReference ||
        refundReference.length > 120 ||
        adminNote.length > 500
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid refund method and transfer reference. The review note must be at most 500 characters."
        });
    }

    try {
        const refundedAt = new Date();
        const result = await Order.updateOne(
            {
                _id: req.params.id,
                paymentStatus: "paid",
                "refundRequest.status": "requested",
                sellerSettlements: {
                    $not: {
                        $elemMatch: { payoutStatus: "paid" }
                    }
                }
            },
            {
                $set: {
                    "refundRequest.status": "refunded",
                    "refundRequest.adminNote": adminNote,
                    "refundRequest.reviewedAt": refundedAt,
                    "refundRequest.reviewedBy": req.user.id,
                    "refundRequest.refundMethod": refundMethod,
                    "refundRequest.refundReference": refundReference,
                    "refundRequest.refundedAt": refundedAt,
                    "sellerSettlements.$[settlement].payoutStatus": "cancelled"
                }
            },
            {
                arrayFilters: [{
                    "settlement.payoutStatus": { $ne: "paid" }
                }]
            }
        );

        if (result.modifiedCount !== 1) {
            return res.status(409).json({
                success: false,
                message: "This refund is no longer pending or a seller payout has already been sent."
            });
        }

        return res.json({
            success: true,
            message: "Manual refund recorded. The order's unpaid seller payouts were cancelled."
        });
    } catch (error) {
        console.error("RECORD ORDER REFUND ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not record the refund."
        });
    }
};


// ========================================
// ADMIN - GET ALL ORDERS
// ========================================

exports.getAllOrders = async (req, res) => {
    try {

        const orders = await Order.find()
            .populate("user", "name email")
            .populate(
                "items.product",
                "name price image seller"
            )
            .sort({
                createdAt: -1
            });

        res.json(orders);

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
};


// ========================================
// ADMIN - UPDATE ORDER STATUS
// ========================================

exports.updateOrderStatus = async (
    req,
    res
) => {

    try {

        const {
            status
        } = req.body;

        const allowedStatuses = [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid order status"
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        if (["requested", "refunded"].includes(order.refundRequest?.status)) {
            return res.status(409).json({
                message: "Order status cannot change while a refund request is pending or after a refund is completed."
            });
        }

        if (order.paymentStatus === "paid" && status === "Cancelled") {
            return res.status(400).json({
                message: "Paid orders must use the Shop refund request and review process."
            });
        }

        if (
            (order.sellerSettlements || []).some(settlement =>
                (settlement.receiptConfirmedAt || settlement.sellerConfirmedAt) &&
                status !== "Delivered"
            )
        ) {
            return res.status(400).json({
                message: "An order cannot be changed after either party confirms the delivered shipment."
            });
        }

        order.status = status;
        for (const settlement of order.sellerSettlements || []) {
            settlement.deliveryStatus = status;
            if (status === "Cancelled" && settlement.payoutStatus !== "paid") {
                settlement.payoutStatus = "cancelled";
            }
        }
        await order.save();

        res.json({
            message:
                "Order status updated successfully",
            order
        });

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
};
