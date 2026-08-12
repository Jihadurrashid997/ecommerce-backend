const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

// ========================================
// ADMIN ANALYTICS
// GET /api/admin/analytics
// ========================================

exports.getAnalytics = async (req, res) => {
    try {

        const totalUsers =
            await User.countDocuments();

        const totalProducts =
            await Product.countDocuments();

        const totalOrders =
            await Order.countDocuments();


        // Paid orders

        const paidOrders =
            await Order.find({
                paymentStatus: "paid"
            });


        const totalRevenue =
            paidOrders.reduce(
                (total, order) =>
                    total +
                    Number(order.totalPrice || 0),
                0
            );


        // Order statistics

        const pendingOrders =
            await Order.countDocuments({
                status: "Pending"
            });


        const processingOrders =
            await Order.countDocuments({
                status: "Processing"
            });


        const shippedOrders =
            await Order.countDocuments({
                status: "Shipped"
            });


        const deliveredOrders =
            await Order.countDocuments({
                status: "Delivered"
            });


        const cancelledOrders =
            await Order.countDocuments({
                status: "Cancelled"
            });


        // Payment statistics

        const paidCount =
            await Order.countDocuments({
                paymentStatus: "paid"
            });


        const pendingPaymentCount =
            await Order.countDocuments({
                paymentStatus: "pending"
            });


        const failedPaymentCount =
            await Order.countDocuments({
                paymentStatus: "failed"
            });


        const cancelledPaymentCount =
            await Order.countDocuments({
                paymentStatus: "cancelled"
            });


        res.status(200).json({

            success: true,

            analytics: {

                totalUsers,

                totalProducts,

                totalOrders,

                totalRevenue,

                orders: {

                    pending:
                        pendingOrders,

                    processing:
                        processingOrders,

                    shipped:
                        shippedOrders,

                    delivered:
                        deliveredOrders,

                    cancelled:
                        cancelledOrders

                },

                payments: {

                    paid:
                        paidCount,

                    pending:
                        pendingPaymentCount,

                    failed:
                        failedPaymentCount,

                    cancelled:
                        cancelledPaymentCount

                }

            }

        });


    } catch (err) {

        console.error(
            "Admin analytics error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Failed to load analytics."

        });

    }
};
