const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const auth = require("../middleware/auth");

// Public Routes
router.get("/", getProducts);
router.get("/:id", getProduct);

// Seller/Admin Routes
router.post(
    "/",
    auth(["seller","admin"]),
    upload.single("image"),
    createProduct
);
router.put("/:id", auth(["seller", "admin"]), updateProduct);
router.delete("/:id", auth(["seller", "admin"]), deleteProduct);

module.exports = router;
