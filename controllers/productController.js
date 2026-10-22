const Product = require("../models/Product");
const ProductReview = require("../models/ProductReview");
const Order = require("../models/Order");
const marketplaceSettings = require("../services/marketplaceSettings");
const { notifyShopUsers } = require("../services/shopNotifications");

const DEFAULT_PRODUCT_PAGE_SIZE = 12;
const MAX_PRODUCT_PAGE_SIZE = 48;
const DEFAULT_REVIEW_PAGE_SIZE = 10;
const MAX_REVIEW_PAGE_SIZE = 30;

const escapeRegExp = value =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==============================
// Get All Products
// ==============================
exports.getProducts = async (req, res) => {

    try {
        const settings =
            await marketplaceSettings.getMarketplaceSettings();

        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: "The Shop is temporarily closed."
            });
        }

        const rawPage = req.query.page === undefined ? "1" : String(req.query.page);
        const rawLimit = req.query.limit === undefined
            ? String(DEFAULT_PRODUCT_PAGE_SIZE)
            : String(req.query.limit);
        const page = Number(rawPage);
        const limit = Number(rawLimit);
        const keyword = String(req.query.keyword || req.query.search || "").trim();
        const category = String(req.query.category || "").trim();
        const sortOption = String(req.query.sort || "newest");
        const sortOptions = {
            newest: { createdAt: -1, _id: -1 },
            stock: { stock: -1, createdAt: -1, _id: -1 },
            "price-low": { price: 1, _id: 1 },
            "price-high": { price: -1, _id: -1 }
        };

        if (
            !Number.isSafeInteger(page) ||
            page < 1 ||
            !Number.isSafeInteger(limit) ||
            limit < 1 ||
            limit > MAX_PRODUCT_PAGE_SIZE ||
            keyword.length > 100 ||
            category.length > 80 ||
            !sortOptions[sortOption]
        ) {
            return res.status(400).json({
                success: false,
                message: "Product browse filters or pagination are invalid."
            });
        }

        const availabilityFilters = {
            approvalStatus: { $nin: ["pending", "rejected"] },
            ...(settings.requireProductApproval
                ? { isApproved: { $ne: false } }
                : {})
        };
        const filters = {
            ...availabilityFilters,
            ...(keyword
                ? {
                    $or: [
                        { name: { $regex: escapeRegExp(keyword), $options: "i" } },
                        { description: { $regex: escapeRegExp(keyword), $options: "i" } },
                        { category: { $regex: escapeRegExp(keyword), $options: "i" } }
                    ]
                }
                : {}),
            ...(category ? { category } : {})
        };

        const skip = (page - 1) * limit;
        const [products, totalItems, categories] = await Promise.all([
            Product.find(filters)
                .select("-seller")
                .sort(sortOptions[sortOption])
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filters),
            Product.distinct("category", availabilityFilters)
        ]);

        res.json({
            success: true,
            products,
            categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)),
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.max(Math.ceil(totalItems / limit), 1)
            }
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

exports.getMyProducts = async (req, res) => {
    try {
        const products = await Product.find({
            seller: req.user.id
        })
            .sort({ createdAt: -1 })
            .lean();

        res.json(products);
    } catch (err) {
        console.error("GET SELLER PRODUCTS ERROR:", err);
        res.status(500).json({
            message: "Could not load your products."
        });
    }
};

// ==============================
// Get Single Product
// ==============================
exports.getProduct = async (req, res) => {

    try {
        const settings =
            await marketplaceSettings.getMarketplaceSettings();

        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: "The Shop is temporarily closed."
            });
        }

        const product = await Product.findById(req.params.id)
            .select("-seller");

        if (!product) {

            return res.status(404).json({
                message: "Product not found"
            });

        }

        if (
            ["pending", "rejected"].includes(product.approvalStatus) ||
            (
                settings.requireProductApproval &&
                product.isApproved === false
            )
        ) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json(product);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

exports.getProductReviews = async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || DEFAULT_REVIEW_PAGE_SIZE);
    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > MAX_REVIEW_PAGE_SIZE
    ) {
        return res.status(400).json({
            success: false,
            message: "Review pagination is invalid."
        });
    }

    try {
        const product = await Product.findById(req.params.id)
            .select("_id approvalStatus isApproved");
        if (
            !product ||
            ["pending", "rejected"].includes(product.approvalStatus) ||
            product.isApproved === false
        ) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const [reviews, totalItems, summary] = await Promise.all([
            ProductReview.find({ product: product._id })
                .select("rating comment createdAt buyer")
                .populate("buyer", "name")
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ProductReview.countDocuments({ product: product._id }),
            ProductReview.aggregate([
                { $match: { product: product._id } },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: "$rating" },
                        reviewCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            reviews,
            summary: {
                averageRating: summary[0]?.averageRating || 0,
                reviewCount: summary[0]?.reviewCount || 0
            },
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.max(Math.ceil(totalItems / limit), 1)
            }
        });
    } catch (error) {
        console.error("GET PRODUCT REVIEWS ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Could not load product reviews."
        });
    }
};

exports.createProductReview = async (req, res) => {
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === "string"
        ? req.body.comment.trim()
        : "";
    if (
        !Number.isSafeInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        comment.length < 3 ||
        comment.length > 1000
    ) {
        return res.status(400).json({
            success: false,
            message: "Choose a 1–5 star rating and write a review between 3 and 1000 characters."
        });
    }

    try {
        const settings = await marketplaceSettings.getMarketplaceSettings();
        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: "The Shop is temporarily closed."
            });
        }

        const product = await Product.findById(req.params.id)
            .select("seller approvalStatus isApproved");
        if (
            !product ||
            ["pending", "rejected"].includes(product.approvalStatus) ||
            (settings.requireProductApproval && product.isApproved === false)
        ) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }
        if (String(product.seller) === String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: "Sellers cannot review their own products."
            });
        }

        const order = await Order.findOne({
            user: req.user.id,
            paymentStatus: "paid",
            "items.product": product._id,
            sellerSettlements: {
                $elemMatch: {
                    seller: product.seller,
                    deliveryStatus: "Delivered",
                    receiptConfirmedAt: { $ne: null }
                }
            }
        }).select("_id");
        if (!order) {
            return res.status(403).json({
                success: false,
                message: "A review is available after you receive this product from a paid order."
            });
        }

        const review = await ProductReview.create({
            product: product._id,
            order: order._id,
            buyer: req.user.id,
            rating,
            comment
        });
        return res.status(201).json({
            success: true,
            message: "Verified purchase review submitted.",
            review
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product from that order."
            });
        }
        console.error("CREATE PRODUCT REVIEW ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not submit product review."
        });
    }
};

// ==============================
// Create Product
// ==============================
exports.createProduct = async (req, res) => {

    try {
        const settings =
            await marketplaceSettings.getMarketplaceSettings();

        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: "The Shop is temporarily closed."
            });
        }

        const name = String(req.body.name || "").trim();
        const description = String(req.body.description || "").trim();
        const category = String(req.body.category || "").trim();
        const price = Number(req.body.price);
        const stock = req.body.stock === undefined
            ? 1
            : Number(req.body.stock);

        if (
            !name ||
            !description ||
            !category ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isSafeInteger(stock) ||
            stock < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a product name, description, category, positive price, and whole-number stock of zero or more."
            });
        }

        const product = await Product.create({
            name,
            description,
            price,
            category,

            image: req.file
                ? `/uploads/${req.file.filename}`
                : req.body.image || "",

            stock,

            seller: req.user.id,
            isApproved: !settings.requireProductApproval,
            approvalStatus: settings.requireProductApproval
                ? "pending"
                : "approved"

        });

        if (!product.isApproved) {
            await notifyShopUsers({
                recipients: [product.seller],
                eventKey: `${product._id}:product-review`,
                type: "product_review",
                title: "Shop product awaiting review",
                message: `${product.name} was submitted and will appear in the Shop after administrator approval. / ${product.name} জমা হয়েছে; অ্যাডমিন অনুমোদনের পর Shop-এ দেখা যাবে।`,
                href: "/shop/seller/products",
                productId: product._id
            });
        }

        res.status(201).json(product);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

// ==============================
// Update Product
// ==============================
exports.updateProduct = async (req, res) => {

    try {
        const settings =
            await marketplaceSettings.getMarketplaceSettings();

        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: "The Shop is temporarily closed."
            });
        }

        const product = await Product.findById(req.params.id);

        if (!product) {

            return res.status(404).json({
                message: "Product not found"
            });

        }

        // OWNERSHIP CHECK:
        // Only the seller who owns this product (or an admin)
        // may update it. Without this check, any logged-in
        // seller could edit ANY other seller's product just by
        // knowing its id.
        if (
            req.user.role !== "admin" &&
            (
                !product.seller ||
                product.seller.toString() !== req.user.id.toString()
            )
        ) {

            return res.status(403).json({
                message: "Not authorized to update this product"
            });

        }

        const updatedData = {};
        const textFields = ["name", "description", "category"];
        for (const field of textFields) {
            if (req.body[field] !== undefined) {
                const value = String(req.body[field]).trim();
                if (!value) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} cannot be empty.`
                    });
                }
                updatedData[field] = value;
            }
        }

        if (req.body.price !== undefined) {
            const price = Number(req.body.price);
            if (!Number.isFinite(price) || price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Product price must be greater than zero."
                });
            }
            updatedData.price = price;
        }

        if (req.body.stock !== undefined) {
            const stock = Number(req.body.stock);
            if (!Number.isSafeInteger(stock) || stock < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Product stock must be a whole number of zero or more."
                });
            }
            updatedData.stock = stock;
        }

        if (req.body.image !== undefined && !req.file) {
            updatedData.image = String(req.body.image).trim();
        }

        const requiresReview =
            req.user.role !== "admin" &&
            (
                settings.requireProductApproval ||
                product.approvalStatus === "rejected"
            );
        if (requiresReview) {
            updatedData.isApproved = false;
            updatedData.approvalStatus = "pending";
            updatedData.approvalReviewNote = "";
        }

        if (req.file) {

            updatedData.image = `/uploads/${req.file.filename}`;

        }

        Object.assign(product, updatedData);

        await product.save();

        if (
            requiresReview &&
            product.isApproved === false
        ) {
            await notifyShopUsers({
                recipients: [product.seller],
                eventKey: `${product._id}:product-review:${product.updatedAt?.getTime?.() || Date.now()}`,
                type: "product_review",
                title: "Edited Shop product awaiting review",
                message: `${product.name} was updated and is hidden until administrator approval. / ${product.name} আপডেট হয়েছে; অ্যাডমিন অনুমোদন না দেওয়া পর্যন্ত Shop-এ দেখা যাবে না।`,
                href: "/shop/seller/products",
                productId: product._id
            });
        }

        res.json(product);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

// ==============================
// Delete Product
// ==============================
exports.deleteProduct = async (req, res) => {

    try {

        const product = await Product.findById(req.params.id);

        if (!product) {

            return res.status(404).json({
                message: "Product not found"
            });

        }

        // OWNERSHIP CHECK:
        // Only the seller who owns this product (or an admin)
        // may delete it. Without this check, any logged-in
        // seller could delete ANY other seller's product just by
        // knowing its id.
        if (
            req.user.role !== "admin" &&
            (
                !product.seller ||
                product.seller.toString() !== req.user.id.toString()
            )
        ) {

            return res.status(403).json({
                message: "Not authorized to delete this product"
            });

        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            message: "Product deleted successfully"
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};
