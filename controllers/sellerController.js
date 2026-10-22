const Product = require('../models/Product');
const User = require('../models/User');
const marketplaceSettings = require('../services/marketplaceSettings');
const { notifyShopUsers } = require("../services/shopNotifications");
const { parseProductVariants } = require("../services/productVariants");
const { notifyShopAdmins } = require("../services/shopNotifications");

exports.getSellerApplication = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("+sellerApplication")
            .lean();
        if (!user) {
            return res.status(404).json({ message: "Account not found." });
        }

        const application = user.sellerApplication || {};
        return res.json({
            status: application.status || "not_submitted",
            displayName: application.displayName || "",
            contact: application.contact || "",
            businessName: application.businessName || "",
            address: application.address || "",
            submittedAt: application.submittedAt || null,
            reviewedAt: application.reviewedAt || null,
            reviewNote: application.reviewNote || ""
        });
    } catch (error) {
        console.error("GET SELLER APPLICATION ERROR:", error);
        return res.status(500).json({
            message: "Could not load your seller application."
        });
    }
};

exports.submitSellerApplication = async (req, res) => {
    const displayName = String(req.body?.displayName || "").trim();
    const contact = String(req.body?.contact || "").trim();
    const businessName = String(req.body?.businessName || "").trim();
    const address = String(req.body?.address || "").trim();

    if (
        displayName.length < 2 ||
        displayName.length > 80 ||
        contact.length < 5 ||
        contact.length > 40 ||
        businessName.length > 100 ||
        address.length > 200 ||
        req.body?.termsAccepted !== true
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a seller display name and contact, keep optional details within their limits, and accept the seller terms."
        });
    }

    try {
        const user = await User.findById(req.user.id)
            .select("+sellerApplication");
        if (!user) {
            return res.status(404).json({ message: "Account not found." });
        }
        if (user.role === "seller") {
            return res.status(409).json({
                message: "This account already has seller access."
            });
        }

        const currentStatus = user.sellerApplication?.status || "not_submitted";
        if (["pending_review", "suspended"].includes(currentStatus)) {
            return res.status(409).json({
                message: currentStatus === "pending_review"
                    ? "Your seller application is already under review."
                    : "This account cannot submit a seller application."
            });
        }

        const submittedAt = new Date();
        user.sellerApplication = {
            status: "pending_review",
            displayName,
            contact,
            businessName,
            address,
            termsAcceptedAt: submittedAt,
            submittedAt,
            reviewedAt: null,
            reviewedBy: null,
            reviewNote: ""
        };
        await user.save();

        const eventKey = `${user._id}:seller-application:${submittedAt.getTime()}`;
        await notifyShopUsers({
            recipients: [user._id],
            eventKey,
            type: "seller_application",
            title: "Seller application submitted",
            message: "Your seller application is awaiting Shop administrator review. / আপনার seller আবেদনটি Shop administrator-এর পর্যালোচনার অপেক্ষায় আছে।",
            href: "/shop/seller/apply"
        });
        await notifyShopAdmins({
            eventKey,
            type: "seller_application",
            title: "Seller application needs review",
            message: "A new seller application is awaiting review in Shop controls. / Shop controls-এ নতুন seller আবেদন পর্যালোচনার অপেক্ষায় আছে।",
            href: "/admin/control"
        });

        return res.status(202).json({
            success: true,
            status: "pending_review",
            message: "Your seller application was submitted for review."
        });
    } catch (error) {
        console.error("SUBMIT SELLER APPLICATION ERROR:", error);
        return res.status(500).json({
            message: "Could not submit your seller application."
        });
    }
};

exports.getPayoutDetails = async (req, res) => {
    try {
        const seller = await User.findById(req.user.id)
            .select("+payoutMethod +payoutAccount");

        if (!seller) {
            return res.status(404).json({ message: "Seller not found." });
        }

        return res.json({
            payoutMethod: seller.payoutMethod || "",
            payoutAccount: seller.payoutAccount || ""
        });
    } catch (error) {
        console.error("GET SELLER PAYOUT DETAILS ERROR:", error);
        return res.status(500).json({
            message: "Could not load payout details."
        });
    }
};

exports.updatePayoutDetails = async (req, res) => {
    const payoutMethod = String(req.body?.payoutMethod || "").trim();
    const payoutAccount = String(req.body?.payoutAccount || "").trim();

    if (
        payoutMethod.length < 2 ||
        payoutMethod.length > 40 ||
        payoutAccount.length < 4 ||
        payoutAccount.length > 120
    ) {
        return res.status(400).json({
            message: "Enter a valid payout method and account/number."
        });
    }

    try {
        const seller = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { payoutMethod, payoutAccount } },
            { new: true, runValidators: true }
        ).select("+payoutMethod +payoutAccount");

        if (!seller) {
            return res.status(404).json({ message: "Seller not found." });
        }

        return res.json({
            success: true,
            payoutMethod: seller.payoutMethod,
            payoutAccount: seller.payoutAccount
        });
    } catch (error) {
        console.error("UPDATE SELLER PAYOUT DETAILS ERROR:", error);
        return res.status(500).json({
            message: "Could not save payout details."
        });
    }
};

exports.uploadProduct = async (req, res) => {
    try {
        const settings = await marketplaceSettings.getMarketplaceSettings();
        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: 'The Shop is temporarily closed.'
            });
        }

        const name = String(req.body.name || "").trim();
        const description = String(req.body.description || "").trim();
        const category = String(req.body.category || "").trim();
        const price = Number(req.body.price);
        const stock = req.body.stock === undefined
            ? 1
            : Number(req.body.stock);
        const parsedVariants = req.body.variants === undefined
            ? null
            : parseProductVariants(req.body.variants);
        if (parsedVariants?.error) {
            return res.status(400).json({
                success: false,
                message: parsedVariants.error
            });
        }

        if (
            !name ||
            !description ||
            !category ||
            (!parsedVariants && (
                !Number.isFinite(price) ||
                price <= 0 ||
                !Number.isSafeInteger(stock) ||
                stock < 0
            ))
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a product name, description, category, positive price, and whole-number stock of zero or more."
            });
        }

        // মাল্টার থেকে আসা ছবিগুলো ধরার লজিক
        let imagePaths = [];
        
        // যদি ছবি রিকোয়েস্টে থাকে, তবে সেগুলোর পাথ বা নাম বের করে অ্যারেতে রাখবো
        if (req.files && req.files.length > 0) {
            imagePaths = req.files.map(file =>
                file.filename ? `/uploads/${file.filename}` : file.path
            );
        } else if (req.file) {
            imagePaths.push(
                req.file.filename
                    ? `/uploads/${req.file.filename}`
                    : req.file.path
            );
        }

        const newProduct = new Product({
            name,
            description,
            price: parsedVariants?.displayPrice ?? price,
            category,
            stock: parsedVariants?.totalStock ?? stock,
            variants: parsedVariants?.variants || [],
            image: imagePaths[0] || req.body.image || "",
            seller: req.user.id,
            isApproved: !settings.requireProductApproval,
            approvalStatus: settings.requireProductApproval
                ? "pending"
                : "approved"
        });

        await newProduct.save();

        if (!newProduct.isApproved) {
            await notifyShopUsers({
                recipients: [newProduct.seller],
                eventKey: `${newProduct._id}:product-review`,
                type: "product_review",
                title: "Shop product awaiting review",
                message: `${newProduct.name} was submitted and will appear in the Shop after administrator approval. / ${newProduct.name} জমা হয়েছে; অ্যাডমিন অনুমোদনের পর Shop-এ দেখা যাবে।`,
                href: "/shop/seller/products",
                productId: newProduct._id
            });
        }

        res.status(201).json({
            message: 'Product uploaded successfully with Image! 📸', // মেসেজ আপডেট করে দিলাম
            product: newProduct
        });
    } catch (error) {
        console.error('Error uploading product:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
// ১. সব প্রোডাক্ট তুলে আনার ফাংশন
exports.getProducts = async (req, res) => {
    try {
        const settings = await marketplaceSettings.getMarketplaceSettings();
        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: 'The Shop is temporarily closed.'
            });
        }

        const products = await Product.find(
            {
                approvalStatus: { $nin: ["pending", "rejected"] },
                ...(settings.requireProductApproval
                    ? { isApproved: { $ne: false } }
                    : {})
            }
        ).select("-seller");
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ২. আইডি দিয়ে নির্দিষ্ট একটা প্রোডাক্ট দেখার ফাংশন
exports.getProductById = async (req, res) => {
    try {
        const settings = await marketplaceSettings.getMarketplaceSettings();
        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: 'The Shop is temporarily closed.'
            });
        }

        const product = await Product.findById(req.params.id).select("-seller");
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        if (
            ["pending", "rejected"].includes(product.approvalStatus) ||
            (settings.requireProductApproval && product.isApproved === false)
        ) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
// ৩. প্রোডাক্ট আপডেট করার ফাংশন (সেফ ভার্সন)
exports.updateProduct = async (req, res) => {
    try {
        const settings = await marketplaceSettings.getMarketplaceSettings();
        if (!settings.marketplaceEnabled) {
            return res.status(503).json({
                success: false,
                message: 'The Shop is temporarily closed.'
            });
        }

        const { name, description, price, category, stock } = req.body;
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // সেফ চেক: যদি প্রোডাক্টে সেলার আইডি থাকে এবং সেটি যদি বর্তমান ইউজারের সাথে না মিলে
        if (!product.seller || product.seller.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized to update this product' });
        }

        const requiresReview =
            settings.requireProductApproval ||
            product.approvalStatus === "rejected";
        if (
            requiresReview
        ) {
            product.isApproved = false;
            product.approvalStatus = "pending";
            product.approvalReviewNote = "";
        }

        if (name !== undefined) {
            if (!String(name).trim()) {
                return res.status(400).json({
                    message: "Product name cannot be empty."
                });
            }
            product.name = String(name).trim();
        }
        if (description !== undefined) {
            if (!String(description).trim()) {
                return res.status(400).json({
                    message: "Product description cannot be empty."
                });
            }
            product.description = String(description).trim();
        }
        if (category !== undefined) {
            if (!String(category).trim()) {
                return res.status(400).json({
                    message: "Product category cannot be empty."
                });
            }
            product.category = String(category).trim();
        }
        if (price !== undefined) {
            if (product.variants?.length && req.body.variants === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Update price through the product variants list."
                });
            }
            const parsedPrice = Number(price);
            if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                return res.status(400).json({
                    message: "Product price must be greater than zero."
                });
            }
            product.price = parsedPrice;
        }
        if (stock !== undefined) {
            if (product.variants?.length && req.body.variants === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Update stock through the product variants list."
                });
            }
            const parsedStock = Number(stock);
            if (!Number.isSafeInteger(parsedStock) || parsedStock < 0) {
                return res.status(400).json({
                    message: "Product stock must be a whole number of zero or more."
                });
            }
            product.stock = parsedStock;
        }
        if (req.body.variants !== undefined) {
            const parsedVariants = parseProductVariants(req.body.variants);
            if (parsedVariants.error) {
                return res.status(400).json({
                    success: false,
                    message: parsedVariants.error
                });
            }
            product.variants = parsedVariants.variants;
            product.stock = parsedVariants.totalStock;
            product.price = parsedVariants.displayPrice;
        }

        if (req.files && req.files.length > 0) {
            product.image = req.files[0].filename
                ? `/uploads/${req.files[0].filename}`
                : req.files[0].path;
        }

        await product.save();

        if (requiresReview && product.isApproved === false) {
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

        res.status(200).json({ message: 'Product updated successfully! 🔄', product });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ৪. প্রোডাক্ট ডিলিট করার ফাংশন (সেফ ভার্সন)
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // সেফ চেক: যদি সেলার আইডি থাকে এবং সেটি যদি বর্তমান ইউজারের সাথে না মিলে
        if (product.seller && product.seller.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized to delete this product' });
        }

        await product.deleteOne();
        res.status(200).json({ message: 'Product deleted successfully! 🗑️' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};