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
                    message: `Product not found`
                });

            }

            const quantity =
                Number(item.quantity) || 1;

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

            const itemTotal =
                product.price * quantity;

            totalPrice += itemTotal;

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

            shippingAddress:
                shippingAddress || {},

            paymentMethod:
                paymentMethod || "cod"

        });

        res.status(201).json({

            message: "Order created successfully",

            order

        });

    } catch (err) {

        console.error("Create order error:", err);

        res.status(500).json({
            message: err.message
        });

    }

};


// ========================================
// GET MY ORDERS
// ========================================

exports.getMyOrders = async (req, res) => {

    try {

        const orders = await Order.find({
            user: req.user.id
        })
            .populate(
                "items.product",
                "name image price"
            )
            .sort({
                createdAt: -1
            });

        res.status(200).json(orders);

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

        const order = await Order.findById(
            req.params.id
        )
            .populate(
                "user",
                "name email"
            )
            .populate(
                "items.product",
                "name image price"
            );

        if (!order) {

            return res.status(404).json({
                message: "Order not found"
            });

        }

        if (
            order.user._id.toString() !==
                req.user.id.toString() &&
            req.user.role !== "admin"
        ) {

            return res.status(403).json({
                message: "Not authorized to view this order"
            });

        }

        res.status(200).json(order);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};


// ========================================
// CANCEL MY ORDER
// ========================================

exports.cancelOrder = async (req, res) => {

    try {

        const order = await Order.findById(
            req.params.id
        );

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
                message:
                    "This order cannot be cancelled"
            });

        }

        order.status = "Cancelled";

        await order.save();

        res.status(200).json({

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
// ADMIN - GET ALL ORDERS
// ========================================

exports.getAllOrders = async (req, res) => {

    try {

        const orders = await Order.find()
            .populate(
                "user",
                "name email"
            )
            .populate(
                "items.product",
                "name price image"
            )
            .sort({
                createdAt: -1
            });

        res.status(200).json(orders);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};


// ========================================
// ADMIN - UPDATE ORDER STATUS
// ========================================

exports.updateOrderStatus = async (req, res) => {

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

                {
                    status
                },

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

        res.status(200).json({

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
