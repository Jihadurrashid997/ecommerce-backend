const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
    getProducts,
    getMyProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const auth = require("../middleware/auth");

// Public Routes
router.get("/", getProducts);
router.get("/mine", auth(["seller"]), getMyProducts);
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
