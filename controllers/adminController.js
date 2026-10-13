const User =
    require("../models/User");

const Product =
    require("../models/Product");

const Order =
    require("../models/Order");


// ======================================================
// ADMIN ANALYTICS
// ======================================================

exports.getAnalytics =
    async (req, res) => {

        try {

            const [

                totalUsers,
                totalProducts,
                totalOrders,

                pendingOrders,
                processingOrders,
                shippedOrders,
                deliveredOrders,
                cancelledOrders,

                paidPayments,
                pendingPayments,
                failedPayments,
                cancelledPayments

            ] = await Promise.all([

                User.countDocuments(),

                Product.countDocuments(),

                Order.countDocuments(),


                Order.countDocuments({
                    status: {
                        $regex: /^pending$/i
                    }
                }),

                Order.countDocuments({
                    status: {
                        $regex: /^processing$/i
                    }
                }),

                Order.countDocuments({
                    status: {
                        $regex: /^shipped$/i
                    }
                }),

                Order.countDocuments({
                    status: {
                        $regex: /^delivered$/i
                    }
                }),

                Order.countDocuments({
                    status: {
                        $regex: /^cancelled$/i
                    }
                }),


                Order.countDocuments({
                    paymentStatus: "paid"
                }),

                Order.countDocuments({
                    paymentStatus: "pending"
                }),

                Order.countDocuments({
                    paymentStatus: "failed"
                }),

                Order.countDocuments({
                    paymentStatus: "cancelled"
                })

            ]);


            const revenueResult =
                await Order.aggregate([

                    {
                        $match: {
                            paymentStatus: "paid"
                        }
                    },

                    {
                        $group: {

                            _id: null,

                            total: {
                                $sum: {
                                    $toDouble:
                                        "$totalPrice"
                                }
                            }

                        }

                    }

                ]);


            const totalRevenue =
                Number(
                    revenueResult[0]?.total ||
                    0
                );


            const sellers =
                await User.countDocuments({
                    role: "seller"
                });


            const customers =
                await User.countDocuments({
                    role: "customer"
                });


            const admins =
                await User.countDocuments({
                    role: "admin"
                });


            res.json({

                success: true,

                analytics: {

                    totalUsers,

                    totalProducts,

                    totalOrders,

                    totalRevenue,

                    users: {

                        total:
                            totalUsers,

                        sellers,

                        customers,

                        admins

                    },

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
                            paidPayments,

                        pending:
                            pendingPayments,

                        failed:
                            failedPayments,

                        cancelled:
                            cancelledPayments

                    }

                }

            });

        } catch (err) {

            console.error(
                "ADMIN ANALYTICS ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load admin analytics."

            });

        }

    };


// ======================================================
// MARKETPLACE SETTINGS
// ======================================================

exports.updateMarketplaceSettings =
    async (req, res) => {

        res.json({

            success: true,

            message:
                "Marketplace settings endpoint is ready."

        });

    };


// ======================================================
// APPROVE PRODUCT
// ======================================================

exports.approveProduct =
    async (req, res) => {

        try {

            const product =
                await Product.findById(
                    req.params.productId
                );

            if (!product) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Product not found."

                });

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    product.toObject(),
                    "isApproved"
                )
            ) {

                product.isApproved = true;

            }


            if (
                Object.prototype.hasOwnProperty.call(
                    product.toObject(),
                    "status"
                )
            ) {

                product.status =
                    "approved";

            }


            await product.save();


            res.json({

                success: true,

                message:
                    "Product approved successfully.",

                product

            });

        } catch (err) {

            console.error(
                "APPROVE PRODUCT ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to approve product."

            });

        }

    };


// ======================================================
// GET ALL USERS - ADMIN
// ======================================================

exports.getAllRegisteredUsers =
    async (req, res) => {

        try {

            const users =
                await User.find()
                    .select(
                        "-password"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .lean();

            res.json({

                success: true,

                users

            });

        } catch (err) {

            console.error(
                "ADMIN USERS ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load users."

            });

        }

    };


// ======================================================
// DASHBOARD SUMMARY
// ======================================================

exports.getDashboardSummary =
    async (req, res) => {

        try {

            const [

                users,
                products,
                orders,
                sellers

            ] = await Promise.all([

                User.countDocuments(),

                Product.countDocuments(),

                Order.countDocuments(),

                User.countDocuments({
                    role: "seller"
                })

            ]);


            res.json({

                success: true,

                summary: {

                    users,

                    products,

                    orders,

                    sellers

                }

            });

        } catch (err) {

            console.error(
                "DASHBOARD SUMMARY ERROR:",
                err
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load dashboard."

            });

        }

    };
