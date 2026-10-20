const Product = require("../models/Product");
const marketplaceSettings = require("../services/marketplaceSettings");
const { notifyShopUsers } = require("../services/shopNotifications");

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

        const keyword = req.query.keyword
            ? {
                name: {
                    $regex: req.query.keyword,
                    $options: "i"
                }
            }
            : {};

        const category = req.query.category
            ? {
                category: req.query.category
            }
            : {};

        const filters = {
            ...keyword,
            ...category,
            ...(settings.requireProductApproval
                ? { isApproved: { $ne: false } }
                : {})
        };

        const products = await Product.find(filters)
            .select("-seller");

        res.json(products);

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
            settings.requireProductApproval &&
            product.isApproved === false
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
            isApproved: !settings.requireProductApproval

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

        if (
            req.user.role !== "admin" &&
            settings.requireProductApproval
        ) {
            updatedData.isApproved = false;
        }

        if (req.file) {

            updatedData.image = `/uploads/${req.file.filename}`;

        }

        Object.assign(product, updatedData);

        await product.save();

        if (
            req.user.role !== "admin" &&
            settings.requireProductApproval &&
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
