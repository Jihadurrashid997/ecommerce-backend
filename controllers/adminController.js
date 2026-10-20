const User =
    require("../models/User");

const Product =
    require("../models/Product");

const Order =
    require("../models/Order");

const MarketplaceSettings =
    require("../models/MarketplaceSettings");

const {
    getMarketplaceSettings
} = require("../services/marketplaceSettings");
const { notifyShopUsers } = require("../services/shopNotifications");


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
                refundedPayments,
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
                    paymentStatus: "refunded"
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

                        refunded:
                            refundedPayments,

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
        const updates = {};

        for (const field of ["marketplaceEnabled", "requireProductApproval"]) {
            if (!Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
                continue;
            }

            if (typeof req.body[field] !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: `${field} must be true or false.`
                });
            }

            updates[field] = req.body[field];
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({
                success: false,
                message: "Choose at least one marketplace setting to update."
            });
        }

        try {
            const settings = await MarketplaceSettings.findOneAndUpdate(
                { _id: "global" },
                { $set: updates },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            ).lean();

            return res.json({
                success: true,
                settings
            });
        } catch (error) {
            console.error("UPDATE MARKETPLACE SETTINGS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Could not update marketplace settings."
            });
        }

    };

exports.getMarketplaceSettings =
    async (_req, res) => {
        try {
            const settings = await getMarketplaceSettings();
            return res.json({
                success: true,
                settings
            });
        } catch (error) {
            console.error("GET MARKETPLACE SETTINGS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Could not load marketplace settings."
            });
        }
    };

exports.getPendingProducts =
    async (_req, res) => {
        try {
            const products = await Product.find({ isApproved: false })
                .populate("seller", "name")
                .sort({ createdAt: -1 })
                .lean();

            return res.json({
                success: true,
                products
            });
        } catch (error) {
            console.error("GET PENDING PRODUCTS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Could not load pending products."
            });
        }
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

            await notifyShopUsers({
                recipients: [product.seller],
                eventKey: `${product._id}:product-approved`,
                type: "product_approved",
                title: "Shop product approved",
                message: `${product.name} is approved and can now appear in the Shop. / ${product.name} অনুমোদিত হয়েছে এবং এখন Shop-এ দেখা যাবে।`,
                href: "/shop/seller/products",
                productId: product._id
            });


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
