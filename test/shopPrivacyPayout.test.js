const assert = require("node:assert/strict");
const test = require("node:test");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const marketplaceSettings = require("../services/marketplaceSettings");
const orderController = require("../controllers/orderController");
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

test("orders initialize separate held-payout records for each seller", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    const originalCreate = Order.create;
    const products = new Map([
        ["product-a", {
            _id: "product-a",
            name: "A",
            price: 50,
            stock: 5,
            seller: "seller-a",
            save: async () => {}
        }],
        ["product-b", {
            _id: "product-b",
            name: "B",
            price: 30,
            stock: 5,
            seller: "seller-b",
            save: async () => {}
        }]
    ]);
    let createdOrder;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = async id => products.get(id);
    Order.create = async data => {
        createdOrder = data;
        return data;
    };

    try {
        const response = makeResponse();
        await orderController.createOrder(
            {
                body: {
                    items: [
                        { product: "product-a", quantity: 2 },
                        { product: "product-b", quantity: 1 }
                    ],
                    shippingAddress: {
                        name: "Recipient",
                        phone: "01700000000",
                        address: "Delivery road",
                        email: "private@example.com"
                    }
                },
                user: { id: "buyer" }
            },
            response
        );

        assert.equal(createdOrder.totalPrice, 130);
        assert.deepEqual(createdOrder.shippingAddress, {
            name: "Recipient",
            phone: "01700000000",
            address: "Delivery road",
            city: "",
            postalCode: ""
        });
        assert.equal("email" in createdOrder.shippingAddress, false);
        assert.deepEqual(
            createdOrder.sellerSettlements.map(({ seller, amount, payoutStatus }) => ({
                seller,
                amount,
                payoutStatus
            })),
            [
                { seller: "seller-a", amount: 100, payoutStatus: "awaiting_payment" },
                { seller: "seller-b", amount: 30, payoutStatus: "awaiting_payment" }
            ]
        );
        assert.equal(response.statusCode, 201);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.findById = originalFindById;
        Order.create = originalCreate;
    }
});

test("customer order responses do not expose seller account IDs", async () => {
    const originalFind = Order.find;
    const order = {
        sellerSettlements: [{
            _id: "fulfillment-a",
            seller: "seller-private-id",
            amount: 100,
            deliveryStatus: "Delivered",
            payoutStatus: "held",
            receiptConfirmedAt: null
        }],
        toObject() {
            return {
                _id: "order-a",
                sellerSettlements: this.sellerSettlements
            };
        }
    };
    Order.find = () => ({
        populate() {
            return this;
        },
        sort: async () => [order]
    });

    try {
        const response = makeResponse();
        await orderController.getMyOrders(
            { user: { id: "buyer" } },
            response
        );

        assert.deepEqual(response.body[0].sellerSettlements, [{
            _id: "fulfillment-a",
            amount: 100,
            deliveryStatus: "Delivered",
            receiptConfirmedAt: null,
            payoutStatus: "held"
        }]);
        assert.equal(JSON.stringify(response.body).includes("seller-private-id"), false);
    } finally {
        Order.find = originalFind;
    }
});

test("only the order owner can confirm receipt after paid delivery", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    let filter;
    let update;
    Order.findOneAndUpdate = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { _id: "order-a" };
    };

    try {
        const response = makeResponse();
        await orderController.confirmOrderReceipt(
            {
                params: {
                    id: "507f1f77bcf86cd799439011",
                    fulfillmentId: "507f1f77bcf86cd799439012"
                },
                user: { id: "buyer" }
            },
            response
        );

        assert.equal(filter.user, "buyer");
        assert.equal(filter.paymentStatus, "paid");
        assert.deepEqual(filter.sellerSettlements.$elemMatch, {
            _id: "507f1f77bcf86cd799439012",
            deliveryStatus: "Delivered",
            payoutStatus: "held",
            receiptConfirmedAt: null
        });
        assert.equal(
            update.$set["sellerSettlements.$.payoutStatus"],
            "ready"
        );
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("seller order responses omit buyer profile data and seller IDs", async () => {
    const originalProductFind = Product.find;
    const originalOrderFind = Order.find;
    Product.find = () => ({
        select: async () => [{ _id: "product-a" }]
    });
    Order.find = () => ({
        populate() {
            return this;
        },
        sort: async () => [{
            _id: "order-a",
            user: { name: "Private Buyer", email: "buyer@example.com" },
            items: [{
                price: 50,
                quantity: 1,
                toObject: () => ({
                    price: 50,
                    quantity: 1,
                    product: {
                        _id: "product-a",
                        name: "A",
                        price: 50,
                        image: "a.jpg",
                        seller: "seller-a"
                    }
                }),
                product: {
                    _id: "product-a",
                    name: "A",
                    price: 50,
                    image: "a.jpg",
                    seller: "seller-a"
                }
            }],
            sellerSettlements: [{
                _id: "fulfillment-a",
                seller: "seller-a",
                amount: 50,
                deliveryStatus: "Pending",
                payoutStatus: "held",
                receiptConfirmedAt: null
            }],
            paymentMethod: "sslcommerz",
            paymentStatus: "paid",
            shippingAddress: { name: "Recipient", address: "Delivery road" },
            createdAt: new Date()
        }]
    });

    try {
        const response = makeResponse();
        await orderController.getSellerOrders(
            { user: { id: "seller-a" } },
            response
        );

        assert.equal(response.body.length, 1);
        assert.equal("user" in response.body[0], false);
        assert.equal("seller" in response.body[0].items[0].product, false);
        assert.equal(response.body[0].shippingAddress.name, "Recipient");
    } finally {
        Product.find = originalProductFind;
        Order.find = originalOrderFind;
    }
});

test("public product details exclude seller identity", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    let selectedFields;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = () => ({
        select: async fields => {
            selectedFields = fields;
            return { _id: "product-a", name: "A" };
        }
    });

    try {
        const response = makeResponse();
        await productController.getProduct(
            { params: { id: "product-a" } },
            response
        );

        assert.equal(selectedFields, "-seller");
        assert.equal("seller" in response.body, false);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.findById = originalFindById;
    }
});

test("seller payout cannot be recorded before receipt confirmation", async () => {
    const originalUpdateOne = Order.updateOne;
    const originalFindOne = Order.findOne;
    Order.updateOne = async () => ({ modifiedCount: 0 });
    Order.findOne = () => ({
        populate: async () => null
    });

    try {
        const response = makeResponse();
        await orderController.markSellerPayoutPaid(
            {
                params: {
                    id: "507f1f77bcf86cd799439011"
                },
                body: {
                    fulfillmentId: "507f1f77bcf86cd799439012",
                    payoutMethod: "Mobile wallet",
                    payoutReference: "TXN-123"
                },
                user: { id: "admin" }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /not ready|already been processed/i);
    } finally {
        Order.updateOne = originalUpdateOne;
        Order.findOne = originalFindOne;
    }
});

test("admin can record a seller payout only against a ready shipment", async () => {
    const originalUpdateOne = Order.updateOne;
    const originalFindOne = Order.findOne;
    let updateFilter;
    let update;
    let options;
    Order.findOne = () => ({
        populate: async () => ({
            sellerSettlements: [{
                _id: "507f1f77bcf86cd799439012",
                seller: {
                    payoutMethod: "bKash",
                    payoutAccount: "01700000000"
                }
            }]
        })
    });
    Order.updateOne = async (filter, nextUpdate, nextOptions) => {
        updateFilter = filter;
        update = nextUpdate;
        options = nextOptions;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.markSellerPayoutPaid(
            {
                params: {
                    id: "507f1f77bcf86cd799439011"
                },
                body: {
                    fulfillmentId: "507f1f77bcf86cd799439012",
                    payoutMethod: "bKash",
                    payoutReference: "TRX-987"
                },
                user: { id: "admin" }
            },
            response
        );

        assert.equal(updateFilter.paymentStatus, "paid");
        assert.equal(
            updateFilter.sellerSettlements.$elemMatch.payoutStatus,
            "ready"
        );
        assert.equal(
            updateFilter.sellerSettlements.$elemMatch.deliveryStatus,
            "Delivered"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].payoutStatus"],
            "paid"
        );
        assert.deepEqual(options.arrayFilters, [{
            "settlement._id": "507f1f77bcf86cd799439012",
            "settlement.deliveryStatus": "Delivered",
            "settlement.payoutStatus": "ready"
        }]);
        assert.equal(
            update.$set["sellerSettlements.$[settlement].payoutReference"],
            "TRX-987"
        );
        assert.equal(response.statusCode, 200);
    } finally {
        Order.updateOne = originalUpdateOne;
        Order.findOne = originalFindOne;
    }
});

test("admin cannot cancel a paid order without the refund process", async () => {
    const originalFindById = Order.findById;
    let saveCalled = false;
    Order.findById = async () => ({
        paymentStatus: "paid",
        sellerSettlements: [],
        save: async () => {
            saveCalled = true;
        }
    });

    try {
        const response = makeResponse();
        await orderController.updateOrderStatus(
            {
                params: { id: "order-a" },
                body: { status: "Cancelled" }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(saveCalled, false);
        assert.match(response.body.message, /refund process/i);
    } finally {
        Order.findById = originalFindById;
    }
});

test("seller payout details are private by default in the user schema", () => {
    const payoutMethod = User.schema.path("payoutMethod");
    const payoutAccount = User.schema.path("payoutAccount");

    assert.equal(payoutMethod.options.select, false);
    assert.equal(payoutAccount.options.select, false);
});

test("seller settlement records track receipt and payout audit data", () => {
    const order = new Order({
        user: "507f1f77bcf86cd799439011",
        items: [{
            product: "507f1f77bcf86cd799439012",
            name: "Product",
            price: 40,
            quantity: 1
        }],
        totalPrice: 40,
        sellerSettlements: [{
            seller: "507f1f77bcf86cd799439013",
            amount: 40
        }]
    });

    assert.equal(order.sellerSettlements[0].payoutStatus, "awaiting_payment");
    assert.equal(order.sellerSettlements[0].deliveryStatus, "Pending");
    assert.equal(order.sellerSettlements[0].receiptConfirmedAt, null);
});
