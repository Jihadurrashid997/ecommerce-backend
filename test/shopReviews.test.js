const assert = require("node:assert/strict");
const test = require("node:test");
const Product = require("../models/Product");
const ProductReview = require("../models/ProductReview");
const Order = require("../models/Order");
const marketplaceSettings = require("../services/marketplaceSettings");
const productController = require("../controllers/productController");

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

test("review listing paginates and returns an aggregate rating", async () => {
    const originalSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    const originalReviewFind = ProductReview.find;
    const originalCountDocuments = ProductReview.countDocuments;
    const originalAggregate = ProductReview.aggregate;
    let skip;
    let limit;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: true
    });
    Product.findById = () => ({
        select: async () => ({
            _id: "product-a",
            approvalStatus: "approved",
            isApproved: true
        })
    });
    ProductReview.find = () => ({
        select() { return this; },
        populate() { return this; },
        sort() { return this; },
        skip(value) { skip = value; return this; },
        limit(value) { limit = value; return this; },
        lean: async () => [{ _id: "review-a", rating: 5 }]
    });
    ProductReview.countDocuments = async () => 22;
    ProductReview.aggregate = async () => [{
        averageRating: 4.5,
        reviewCount: 22
    }];

    try {
        const response = makeResponse();
        await productController.getProductReviews({
            params: { id: "product-a" },
            query: { page: "2", limit: "10" }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(skip, 10);
        assert.equal(limit, 10);
        assert.deepEqual(response.body.summary, {
            averageRating: 4.5,
            reviewCount: 22
        });
        assert.deepEqual(response.body.pagination, {
            page: 2,
            limit: 10,
            totalItems: 22,
            totalPages: 3
        });
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalSettings;
        Product.findById = originalFindById;
        ProductReview.find = originalReviewFind;
        ProductReview.countDocuments = originalCountDocuments;
        ProductReview.aggregate = originalAggregate;
    }
});

test("only a buyer with a delivered paid order can create a product review", async () => {
    const originalSettings = marketplaceSettings.getMarketplaceSettings;
    const originalProductFindById = Product.findById;
    const originalOrderFindOne = Order.findOne;
    const originalReviewCreate = ProductReview.create;
    let purchaseFilter;
    let createdReview;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: true
    });
    Product.findById = () => ({
        select: async () => ({
            _id: "product-a",
            seller: "seller-a",
            approvalStatus: "approved",
            isApproved: true
        })
    });
    Order.findOne = filter => {
        purchaseFilter = filter;
        return {
            select: async () => ({ _id: "order-a" })
        };
    };
    ProductReview.create = async review => {
        createdReview = review;
        return { _id: "review-a", ...review };
    };

    try {
        const response = makeResponse();
        await productController.createProductReview({
            params: { id: "product-a" },
            user: { id: "buyer-a" },
            body: { rating: 4, comment: "Exactly as described." }
        }, response);

        assert.equal(response.statusCode, 201);
        assert.equal(createdReview.product, "product-a");
        assert.equal(createdReview.order, "order-a");
        assert.equal(createdReview.buyer, "buyer-a");
        assert.equal(createdReview.rating, 4);
        assert.deepEqual(purchaseFilter.sellerSettlements.$elemMatch, {
            seller: "seller-a",
            deliveryStatus: "Delivered",
            receiptConfirmedAt: { $ne: null }
        });
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalSettings;
        Product.findById = originalProductFindById;
        Order.findOne = originalOrderFindOne;
        ProductReview.create = originalReviewCreate;
    }
});

test("product review rejects an unverified purchase and invalid input", async () => {
    const originalSettings = marketplaceSettings.getMarketplaceSettings;
    const originalProductFindById = Product.findById;
    const originalOrderFindOne = Order.findOne;
    let orderLookupCount = 0;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = () => ({
        select: async () => ({
            _id: "product-a",
            seller: "seller-a",
            approvalStatus: "approved",
            isApproved: true
        })
    });
    Order.findOne = () => {
        orderLookupCount += 1;
        return { select: async () => null };
    };

    try {
        const invalidResponse = makeResponse();
        await productController.createProductReview({
            params: { id: "product-a" },
            user: { id: "buyer-a" },
            body: { rating: 9, comment: "No" }
        }, invalidResponse);
        assert.equal(invalidResponse.statusCode, 400);
        assert.equal(orderLookupCount, 0);

        const unverifiedResponse = makeResponse();
        await productController.createProductReview({
            params: { id: "product-a" },
            user: { id: "buyer-a" },
            body: { rating: 5, comment: "Good item" }
        }, unverifiedResponse);
        assert.equal(unverifiedResponse.statusCode, 403);
        assert.equal(orderLookupCount, 1);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalSettings;
        Product.findById = originalProductFindById;
        Order.findOne = originalOrderFindOne;
    }
});
