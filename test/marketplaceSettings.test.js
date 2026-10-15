const assert = require("node:assert/strict");
const test = require("node:test");
const MarketplaceSettings = require("../models/MarketplaceSettings");
const Product = require("../models/Product");
const marketplaceSettings = require("../services/marketplaceSettings");
const adminController = require("../controllers/adminController");
const productController = require("../controllers/productController");
const orderController = require("../controllers/orderController");

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

test("marketplace settings default to open with product approval disabled", () => {
    const settings = new MarketplaceSettings();

    assert.equal(settings.marketplaceEnabled, true);
    assert.equal(settings.requireProductApproval, false);
});

test("admin settings update persists valid boolean fields", async () => {
    const originalFindOneAndUpdate = MarketplaceSettings.findOneAndUpdate;
    let filter;
    let update;
    let options;

    MarketplaceSettings.findOneAndUpdate = (nextFilter, nextUpdate, nextOptions) => {
        filter = nextFilter;
        update = nextUpdate;
        options = nextOptions;
        return {
            lean: async () => ({
                _id: "global",
                marketplaceEnabled: false,
                requireProductApproval: false
            })
        };
    };

    try {
        const response = makeResponse();
        await adminController.updateMarketplaceSettings(
            { body: { marketplaceEnabled: false } },
            response
        );

        assert.deepEqual(filter, { _id: "global" });
        assert.deepEqual(update, { $set: { marketplaceEnabled: false } });
        assert.equal(options.upsert, true);
        assert.equal(response.body.settings.marketplaceEnabled, false);
    } finally {
        MarketplaceSettings.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("admin settings reject non-boolean values", async () => {
    const response = makeResponse();
    await adminController.updateMarketplaceSettings(
        { body: { marketplaceEnabled: "false" } },
        response
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /true or false/);
});

test("product browse filters pending listings when approval is required", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFind = Product.find;
    let filter;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: true
    });
    Product.find = query => {
        filter = query;
        return {
            select: async () => []
        };
    };

    try {
        const response = makeResponse();
        await productController.getProducts(
            { query: {} },
            response
        );

        assert.deepEqual(filter, {
            isApproved: { $ne: false }
        });
        assert.deepEqual(response.body, []);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.find = originalFind;
    }
});

test("new products start pending when admin approval is enabled", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalCreate = Product.create;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: true
    });
    Product.create = async product => product;

    try {
        const response = makeResponse();
        await productController.createProduct(
            {
                body: {
                    name: "Handmade item",
                    description: "A product",
                    price: 20,
                    category: "Crafts",
                    stock: 1
                },
                user: { id: "507f1f77bcf86cd799439011" }
            },
            response
        );

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.isApproved, false);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.create = originalCreate;
    }
});

test("disabled Shop blocks product browsing and new orders", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFind = Product.find;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: false,
        requireProductApproval: false
    });
    Product.find = () => {
        throw new Error("Closed Shop must not query the product catalog.");
    };

    try {
        const browseResponse = makeResponse();
        await productController.getProducts(
            { query: {} },
            browseResponse
        );
        assert.equal(browseResponse.statusCode, 503);

        const orderResponse = makeResponse();
        await orderController.createOrder(
            { body: {}, user: { id: "507f1f77bcf86cd799439011" } },
            orderResponse
        );
        assert.equal(orderResponse.statusCode, 503);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.find = originalFind;
    }
});
