const Order = require("../models/Order");
const Product = require("../models/Product");

// ========================================
// CREATE ORDER
// ========================================

exports.createOrder = async (req, res) => {
    try {
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

        for (const item of items) {
            const product = await Product.findById(
                item.product || item._id
            );

            if (!product) {
                return res.status(404).json({
                    message: "Product not found"
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
            shippingAddress: shippingAddress || {},
            paymentMethod: paymentMethod || "cod"
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

        res.json(orders);

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
            .populate("user", "name email")
            .populate("items.product", "name image price seller");

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        if (
            order.user._id.toString() !== req.user.id.toString() &&
            req.user.role !== "admin" &&
            req.user.role !== "seller"
        ) {
            return res.status(403).json({
                message: "Not authorized"
            });
        }

        res.json(order);

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

        order.status = "Cancelled";

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
            "items.product": {
                $in: productIds
            }
        })
            .populate("user", "name email")
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

            return {
                _id: order._id,
                user: order.user,
                items: sellerItems,
                totalPrice: sellerItems.reduce(
                    (total, item) =>
                        total +
                        item.price * item.quantity,
                    0
                ),
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                status: order.status,
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

        order.status = status;

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

        const order =
            await Order.findByIdAndUpdate(
                req.params.id,
                { status },
                {
                    new: true,
                    runValidators: true
                }
            );

        if (!order) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

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
