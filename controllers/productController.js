const Product = require("../models/Product");

// ==============================
// Get All Products
// ==============================
exports.getProducts = async (req, res) => {

    try {

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

        const products = await Product.find({
            ...keyword,
            ...category
        }).populate("seller", "name email");

        res.json(products);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

// ==============================
// Get Single Product
// ==============================
exports.getProduct = async (req, res) => {

    try {

        const product = await Product.findById(req.params.id)
            .populate("seller", "name email");

        if (!product) {

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

        const product = await Product.create({

            name: req.body.name,

            description: req.body.description,

            price: req.body.price,

            category: req.body.category,

            image: req.file
                ? `/uploads/${req.file.filename}`
                : req.body.image || "",

            stock: req.body.stock,

            seller: req.user.id

        });

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

        const updatedData = {

            ...req.body

        };

        if (req.file) {

            updatedData.image = `/uploads/${req.file.filename}`;

        }

        const product = await Product.findByIdAndUpdate(

            req.params.id,

            updatedData,

            {
                new: true,
                runValidators: true
            }

        );

        if (!product) {

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
