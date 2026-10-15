const assert = require("node:assert/strict");
const test = require("node:test");
const Product = require("../models/Product");
const productController = require("../controllers/productController");

const SELLER_ID = "507f1f77bcf86cd799439011";

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

test("seller product list is scoped to the authenticated seller", async () => {
    const originalFind = Product.find;
    const products = [{ _id: "owned-product" }];
    let filter;
    let sort;

    Product.find = query => {
        filter = query;
        return {
            sort: value => {
                sort = value;
                return {
                    lean: async () => products
                };
            }
        };
    };

    try {
        const response = makeResponse();
        await productController.getMyProducts(
            { user: { id: SELLER_ID } },
            response
        );

        assert.deepEqual(filter, { seller: SELLER_ID });
        assert.deepEqual(sort, { createdAt: -1 });
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, products);
    } finally {
        Product.find = originalFind;
    }
});
