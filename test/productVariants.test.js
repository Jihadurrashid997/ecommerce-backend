const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { parseProductVariants } = require("../services/productVariants");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const orderController = require("../controllers/orderController");
const productController = require("../controllers/productController");
const marketplaceSettings = require("../services/marketplaceSettings");

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("product variants normalize SKUs and aggregate display price and stock", () => {
    const variants = parseProductVariants(JSON.stringify([
        { name: "Small / Black", sku: "small-black", price: "450", stock: "2" },
        { name: "Large / Black", sku: "large-black", price: 500, stock: 3 }
    ]));

    assert.deepEqual(variants.variants.map(variant => variant.sku), [
        "SMALL-BLACK",
        "LARGE-BLACK"
    ]);
    assert.equal(variants.displayPrice, 450);
    assert.equal(variants.totalStock, 5);
});

test("product variants reject duplicate SKU, fractional stock, and malformed input", () => {
    assert.match(
        parseProductVariants([
            { name: "A", sku: "same", price: 10, stock: 1 },
            { name: "B", sku: "SAME", price: 12, stock: 1 }
        ]).error,
        /unique SKU/i
    );
    assert.match(
        parseProductVariants([
            { name: "A", sku: "A-1", price: 10, stock: 1.5 }
        ]).error,
        /whole-number stock/i
    );
    assert.match(parseProductVariants("{bad").error, /valid JSON/i);
});

test("admin inventory reconciliation reports aggregate and variant stock mismatches", async () => {
    const originalProductFind = Product.find;
    Product.find = () => ({
        select() { return this; },
        lean: async () => [
            {
                _id: "product-good",
                name: "Consistent",
                stock: 3,
                variants: [{ stock: 1 }, { stock: 2 }]
            },
            {
                _id: "product-bad",
                name: "Inconsistent",
                stock: 8,
                variants: [{ stock: 3 }, { stock: 2 }]
            }
        ]
    });

    try {
        const response = makeResponse();
        await productController.getInventoryReconciliation({}, response);
        assert.deepEqual(response.body, {
            success: true,
            checkedProducts: 2,
            mismatchCount: 1,
            mismatches: [{
                productId: "product-bad",
                name: "Inconsistent",
                productStock: 8,
                variantStock: 5
            }]
        });
    } finally {
        Product.find = originalProductFind;
    }
});

test("variant checkout snapshots selected SKU and reserves only selected stock", async () => {
    const originalSettings = marketplaceSettings.getMarketplaceSettings;
    const originalProductFindById = Product.findById;
    const originalProductFindOneAndUpdate = Product.findOneAndUpdate;
    const originalOrderFindOne = Order.findOne;
    const originalOrderCreate = Order.create;
    const originalUserFind = User.find;
    const productId = "507f1f77bcf86cd799439011";
    const variantId = "507f1f77bcf86cd799439012";
    const product = {
        _id: productId,
        name: "Shirt",
        price: 450,
        stock: 5,
        seller: "507f1f77bcf86cd799439013",
        approvalStatus: "approved",
        variants: [{
            _id: new mongoose.Types.ObjectId(variantId),
            name: "Large / Black",
            sku: "SHIRT-L-BLK",
            price: 500,
            stock: 3
        }]
    };
    product._id = productId;
    let savedOrder;
    let stockFilter;
    let stockUpdate;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = async () => product;
    Product.findOneAndUpdate = async (filter, update) => {
        stockFilter = filter;
        stockUpdate = update;
        product.stock += update.$inc.stock;
        product.variants[0].stock += update.$inc["variants.$.stock"];
        return product;
    };
    Order.findOne = () => ({ select: async () => null });
    Order.create = async order => {
        order._id = "507f1f77bcf86cd799439015";
        savedOrder = order;
        return order;
    };
    User.find = () => ({
        select() { return this; },
        lean: async () => []
    });

    try {
        const response = makeResponse();
        await orderController.createOrder({
            body: {
                items: [{ product: productId, variantId, quantity: 2 }],
                shippingAddress: {
                    name: "Buyer",
                    phone: "01700000000",
                    address: "Road"
                }
            },
            headers: { "idempotency-key": "variant-order-01" },
            user: { id: "507f1f77bcf86cd799439014" }
        }, response);

        assert.equal(response.statusCode, 201);
        assert.deepEqual(stockFilter.variants.$elemMatch, {
            _id: variantId,
            stock: { $gte: 2 },
            price: 500
        });
        assert.deepEqual(stockUpdate.$inc, {
            stock: -2,
            "variants.$.stock": -2
        });
        assert.equal(product.variants[0].stock, 1);
        assert.equal(savedOrder.totalPrice, 1000);
        assert.deepEqual({
            variantId: String(savedOrder.items[0].variantId),
            variantName: savedOrder.items[0].variantName,
            sku: savedOrder.items[0].sku,
            price: savedOrder.items[0].price
        }, {
            variantId,
            variantName: "Large / Black",
            sku: "SHIRT-L-BLK",
            price: 500
        });
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalSettings;
        Product.findById = originalProductFindById;
        Product.findOneAndUpdate = originalProductFindOneAndUpdate;
        Order.findOne = originalOrderFindOne;
        Order.create = originalOrderCreate;
        User.find = originalUserFind;
    }
});

test("variant stock release restores both variant and aggregate stock", async () => {
    const originalStartSession = mongoose.startSession;
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    const originalProductUpdateOne = Product.updateOne;
    const originalUserFind = User.find;
    const productId = "507f1f77bcf86cd799439011";
    const variantId = "507f1f77bcf86cd799439012";
    let updateCall;
    mongoose.startSession = async () => ({
        withTransaction: async callback => callback(),
        endSession: async () => {}
    });
    Order.findOneAndUpdate = async () => ({
        _id: "order-a",
        user: "buyer-a",
        items: [{
            product: productId,
            variantId,
            quantity: 2,
            stockReserved: true
        }]
    });
    Product.updateOne = async (filter, update) => {
        updateCall = { filter, update };
        return { modifiedCount: 1 };
    };
    User.find = () => ({
        select() { return this; },
        lean: async () => []
    });

    try {
        const response = makeResponse();
        await orderController.cancelOrder({
            params: { id: "507f1f77bcf86cd799439015" },
            user: { id: "buyer-a" }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.deepEqual(updateCall.filter, {
            _id: productId,
            "variants._id": variantId
        });
        assert.deepEqual(updateCall.update, {
            $inc: {
                stock: 2,
                "variants.$.stock": 2
            }
        });
    } finally {
        mongoose.startSession = originalStartSession;
        Order.findOneAndUpdate = originalFindOneAndUpdate;
        Product.updateOne = originalProductUpdateOne;
        User.find = originalUserFind;
    }
});
