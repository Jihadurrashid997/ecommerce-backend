const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const marketplaceSettings = require("../services/marketplaceSettings");

const getCustomerOrder = order => {
    const result = order.toObject();
    result.sellerSettlements = (result.sellerSettlements || []).map(
        settlement => ({
            _id: settlement._id,
            amount: settlement.amount,
            deliveryStatus: settlement.deliveryStatus,
            receiptConfirmedAt: settlement.receiptConfirmedAt,
            payoutStatus: settlement.payoutStatus
        })
    );
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

        let totalPrice = 0;
        const orderItems = [];
        const sellerAmounts = new Map();

        for (const item of items) {
            const product = await Product.findById(
                item.product || item._id
            );

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

            const quantity = Number(item.quantity) || 1;

            if (quantity < 1) {
                return res.status(400).json({
                    message: "Invalid quantity"
                });
            }

            if (
                product.stock !== undefined &&
                product.stock < quantity
            ) {
                return res.status(400).json({
                    message: `${product.name} is out of stock`
                });
            }

            totalPrice += product.price * quantity;
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

            // Reduce stock now that this item has been
            // confirmed available and added to the order.
            // Without this the stock check above is useless:
            // the same "in stock" quantity would keep passing
            // for every future order, allowing overselling.
            if (product.stock !== undefined) {

                product.stock -= quantity;

                await product.save();

            }
        }

        const order = await Order.create({
            user: req.user.id,
            items: orderItems,
            totalPrice,
            shippingAddress: {
                name: String(shippingAddress?.name || "").trim(),
                phone: String(shippingAddress?.phone || "").trim(),
                address: String(shippingAddress?.address || "").trim(),
                city: String(shippingAddress?.city || "").trim(),
                postalCode: String(shippingAddress?.postalCode || "").trim()
            },
            paymentMethod: paymentMethod || "cod",
            sellerSettlements: Array.from(sellerAmounts, ([seller, amount]) => ({
                seller,
                amount,
                payoutStatus: "awaiting_payment"
            }))
        });

        res.status(201).json({
            message: "Order created successfully",
            order
        });

    } catch (err) {
        console.error(err);

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
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        if (
            order.user.toString() !==
            req.user.id.toString()
        ) {
            return res.status(403).json({
                message: "Not authorized"
            });
        }

        if (
            order.status === "Shipped" ||
            order.status === "Delivered"
        ) {
            return res.status(400).json({
                message: "This order cannot be cancelled"
            });
        }

        if (order.paymentStatus === "paid") {
            return res.status(400).json({
                message: "Paid orders cannot be cancelled online. Contact Shop support to request a refund."
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

        order.status = "Cancelled";
        for (const settlement of order.sellerSettlements || []) {
            settlement.deliveryStatus = "Cancelled";
            settlement.payoutStatus = "cancelled";
        }

        await order.save();

        res.json({
            message: "Order cancelled successfully",
            order
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
                status: settlement?.deliveryStatus || order.status,
                payout: settlement
                    ? {
                          id: settlement._id,
                          amount: settlement.amount,
                          status: settlement.payoutStatus,
                          receiptConfirmedAt: settlement.receiptConfirmedAt
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

        if (order.paymentStatus === "paid" && status === "Cancelled") {
            return res.status(400).json({
                message: "Paid orders must be cancelled by an administrator so the refund can be reviewed."
            });
        }

        if (settlement) {
            if (
                settlement.receiptConfirmedAt &&
                status !== "Delivered"
            ) {
                return res.status(400).json({
                    message: "Delivery cannot be changed after the customer confirms receipt."
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
                    "sellerSettlements.$.receiptConfirmedAt": new Date(),
                    "sellerSettlements.$.payoutStatus": "ready"
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

        return res.json({
            success: true,
            message: "Receipt confirmed. Seller payout is ready for admin processing."
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
// ADMIN - SELLER PAYOUT QUEUE
// ========================================

exports.getReadySellerPayouts = async (_req, res) => {
    try {
        const orders = await Order.find({
            paymentStatus: "paid",
            sellerSettlements: {
                $elemMatch: {
                    deliveryStatus: "Delivered",
                    payoutStatus: "ready",
                    receiptConfirmedAt: { $ne: null }
                }
            }
        })
            .populate({
                path: "sellerSettlements.seller",
                select: "name email +payoutMethod +payoutAccount"
            })
            .sort({ updatedAt: -1 });

        const payouts = orders.flatMap(order =>
            (order.sellerSettlements || [])
                .filter(settlement =>
                    settlement.payoutStatus === "ready" &&
                    settlement.deliveryStatus === "Delivered" &&
                    settlement.receiptConfirmedAt &&
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
                        payoutMethod: settlement.seller.payoutMethod || "",
                        payoutAccount: settlement.seller.payoutAccount || ""
                    },
                    receiptConfirmedAt: settlement.receiptConfirmedAt
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
            sellerSettlements: {
                $elemMatch: {
                    _id: req.body.fulfillmentId,
                    deliveryStatus: "Delivered",
                    payoutStatus: "ready",
                    receiptConfirmedAt: { $ne: null }
                }
            }
        }).populate({
            path: "sellerSettlements.seller",
            select: "+payoutMethod +payoutAccount"
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
            !settlement.seller?.payoutMethod ||
            !settlement.seller?.payoutAccount
        ) {
            return res.status(400).json({
                success: false,
                message: "The seller must add private payout details before a payout can be recorded."
            });
        }

        const result = await Order.updateOne(
            {
                _id: req.params.id,
                paymentStatus: "paid",
                sellerSettlements: {
                    $elemMatch: {
                        _id: req.body.fulfillmentId,
                        deliveryStatus: "Delivered",
                        payoutStatus: "ready",
                        receiptConfirmedAt: { $ne: null }
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
                    "settlement.payoutStatus": "ready"
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

        if (order.paymentStatus === "paid" && status === "Cancelled") {
            return res.status(400).json({
                message: "Paid orders must go through the support refund process before cancellation."
            });
        }

        if (
            (order.sellerSettlements || []).some(settlement =>
                settlement.receiptConfirmedAt &&
                status !== "Delivered"
            )
        ) {
            return res.status(400).json({
                message: "An order cannot be changed after the customer confirms receipt."
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
