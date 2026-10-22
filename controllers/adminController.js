const User =
    require("../models/User");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");

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
            const products = await Product.find({
                isApproved: false,
                approvalStatus: { $nin: ["rejected"] }
            })
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

exports.getSellerApplications = async (_req, res) => {
    try {
        const applicants = await User.find({
            "sellerApplication.status": "pending_review"
        })
            .select("name email createdAt +sellerApplication")
            .sort({ "sellerApplication.submittedAt": 1 })
            .lean();

        return res.json({
            success: true,
            applications: applicants.map(user => ({
                userId: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                ...user.sellerApplication
            }))
        });
    } catch (error) {
        console.error("GET SELLER APPLICATIONS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not load seller applications."
        });
    }
};

exports.reviewSellerApplication = async (req, res) => {
    const { userId } = req.params;
    const status = req.body?.status;
    const reviewNote = typeof req.body?.reviewNote === "string"
        ? req.body.reviewNote.trim()
        : "";

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid applicant."
        });
    }
    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Choose approved or rejected."
        });
    }
    if (reviewNote.length > 500 || (status === "rejected" && reviewNote.length < 3)) {
        return res.status(400).json({
            success: false,
            message: "A rejection note is required and must be at most 500 characters."
        });
    }

    try {
        const reviewedAt = new Date();
        const applicant = await User.findOneAndUpdate(
            {
                _id: userId,
                "sellerApplication.status": "pending_review"
            },
            {
                $set: {
                    role: status === "approved" ? "seller" : "customer",
                    "sellerApplication.status": status,
                    "sellerApplication.reviewedAt": reviewedAt,
                    "sellerApplication.reviewedBy": req.user.id,
                    "sellerApplication.reviewNote": reviewNote
                }
            },
            { new: true, runValidators: true }
        ).select("name +sellerApplication");

        if (!applicant) {
            return res.status(409).json({
                success: false,
                message: "This application is no longer pending."
            });
        }

        auth.invalidate(userId);
        await notifyShopUsers({
            recipients: [applicant._id],
            eventKey: `${applicant._id}:seller-application-${status}:${reviewedAt.getTime()}`,
            type: "seller_application_decision",
            title: status === "approved"
                ? "Seller application approved"
                : "Seller application update",
            message: status === "approved"
                ? "Your seller application was approved. Seller tools are now available. / আপনার seller আবেদন অনুমোদিত হয়েছে; এখন seller tools ব্যবহার করতে পারবেন।"
                : `Your seller application was not approved. ${reviewNote} / আপনার seller আবেদনটি অনুমোদিত হয়নি।`,
            href: "/shop/seller/apply"
        });

        return res.json({
            success: true,
            status,
            role: applicant.role
        });
    } catch (error) {
        console.error("REVIEW SELLER APPLICATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not review this seller application."
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
                product.approvalStatus = "approved";
                product.approvalReviewNote = "";

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

exports.rejectProduct = async (req, res) => {
    const reviewNote = typeof req.body?.reviewNote === "string"
        ? req.body.reviewNote.trim()
        : "";
    if (reviewNote.length < 3 || reviewNote.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Provide a product review note between 3 and 500 characters."
        });
    }

    try {
        const product = await Product.findOneAndUpdate(
            {
                _id: req.params.productId,
                isApproved: false,
                approvalStatus: { $ne: "rejected" }
            },
            {
                $set: {
                    approvalStatus: "rejected",
                    approvalReviewNote: reviewNote
                }
            },
            { new: true, runValidators: true }
        );
        if (!product) {
            return res.status(409).json({
                success: false,
                message: "This product is no longer awaiting approval."
            });
        }

        await notifyShopUsers({
            recipients: [product.seller],
            eventKey: `${product._id}:product-rejected:${product.updatedAt?.getTime?.() || Date.now()}`,
            type: "product_rejected",
            title: "Shop product needs changes",
            message: `${product.name} was not approved. Review the administrator note in My products. / ${product.name} অনুমোদিত হয়নি; My products-এ অ্যাডমিনের নোট দেখে সংশোধন করুন।`,
            href: "/shop/seller/products",
            productId: product._id
        });
        return res.json({
            success: true,
            message: "Product rejected with a seller-facing review note."
        });
    } catch (error) {
        console.error("REJECT PRODUCT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not reject this product."
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
