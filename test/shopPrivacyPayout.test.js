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
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalCreate = Order.create;
    const productIds = {
        "product-a": "507f1f77bcf86cd799439011",
        "product-b": "507f1f77bcf86cd799439012"
    };
    const products = new Map([
        [productIds["product-a"], {
            _id: productIds["product-a"],
            name: "A",
            price: 50,
            stock: 5,
            seller: "507f1f77bcf86cd799439013"
        }],
        [productIds["product-b"], {
            _id: productIds["product-b"],
            name: "B",
            price: 30,
            stock: 5,
            seller: "507f1f77bcf86cd799439014"
        }]
    ]);
    let createdOrder;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = async id => products.get(id);
    Product.findOneAndUpdate = async (filter, update) => {
        const product = products.get(String(filter._id));
        if (!product || product.stock < filter.stock.$gte) return null;
        product.stock += update.$inc.stock;
        return product;
    };
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
                        { product: productIds["product-a"], quantity: 2 },
                        { product: productIds["product-b"], quantity: 1 }
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
                {
                    seller: "507f1f77bcf86cd799439013",
                    amount: 100,
                    payoutStatus: "awaiting_payment"
                },
                {
                    seller: "507f1f77bcf86cd799439014",
                    amount: 30,
                    payoutStatus: "awaiting_payment"
                }
            ]
        );
        assert.equal(products.get(productIds["product-a"]).stock, 3);
        assert.equal(products.get(productIds["product-b"]).stock, 4);
        assert.equal(createdOrder.paymentMethod, "sslcommerz");
        assert.equal(
            response.body.order.sellerSettlements.some(settlement => "seller" in settlement),
            false
        );
        assert.equal(response.statusCode, 201);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.findById = originalFindById;
        Product.findOneAndUpdate = originalFindOneAndUpdate;
        Order.create = originalCreate;
    }
});

test("order creation reserves duplicate product quantities atomically", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalCreate = Order.create;
    const productId = "507f1f77bcf86cd799439015";
    const product = {
        _id: productId,
        name: "Limited item",
        price: 20,
        stock: 3,
        seller: "507f1f77bcf86cd799439016"
    };
    let reservedQuantity = 0;
    let createdOrder;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = async () => ({ ...product });
    Product.findOneAndUpdate = async (filter, update) => {
        reservedQuantity = -update.$inc.stock;
        product.stock -= reservedQuantity;
        return { ...product };
    };
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
                        { product: productId, quantity: 1 },
                        { product: productId, quantity: 2 }
                    ],
                    shippingAddress: {
                        name: "Recipient",
                        phone: "01700000000",
                        address: "Delivery road"
                    },
                    paymentMethod: "sslcommerz"
                },
                user: { id: "507f1f77bcf86cd799439017" }
            },
            response
        );

        assert.equal(reservedQuantity, 3);
        assert.equal(product.stock, 0);
        assert.equal(createdOrder.items.length, 1);
        assert.equal(createdOrder.items[0].quantity, 3);
        assert.equal(createdOrder.totalPrice, 60);
        assert.equal(response.statusCode, 201);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.findById = originalFindById;
        Product.findOneAndUpdate = originalFindOneAndUpdate;
        Order.create = originalCreate;
    }
});

test("partial inventory reservation is rolled back when another product sells out", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalUpdateOne = Product.updateOne;
    const originalCreate = Order.create;
    const firstId = "507f1f77bcf86cd799439022";
    const secondId = "507f1f77bcf86cd799439023";
    const products = new Map([
        [firstId, {
            _id: firstId,
            name: "In-stock",
            price: 20,
            stock: 4,
            seller: "507f1f77bcf86cd799439024"
        }],
        [secondId, {
            _id: secondId,
            name: "Sold-out",
            price: 30,
            stock: 1,
            seller: "507f1f77bcf86cd799439025"
        }]
    ]);
    let createdOrder = false;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = async id => ({
        ...products.get(id),
        ...(id === secondId ? { stock: 2 } : {})
    });
    Product.findOneAndUpdate = async (filter, update) => {
        const product = products.get(String(filter._id));
        if (product.stock < filter.stock.$gte) return null;
        product.stock += update.$inc.stock;
        return product;
    };
    Product.updateOne = async (filter, update) => {
        products.get(String(filter._id)).stock += update.$inc.stock;
    };
    Order.create = async () => {
        createdOrder = true;
    };

    try {
        const response = makeResponse();
        await orderController.createOrder(
            {
                body: {
                    items: [
                        { product: firstId, quantity: 2 },
                        { product: secondId, quantity: 2 }
                    ],
                    shippingAddress: {
                        name: "Recipient",
                        phone: "01700000000",
                        address: "Delivery road"
                    }
                },
                user: { id: "507f1f77bcf86cd799439026" }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.equal(products.get(firstId).stock, 4);
        assert.equal(products.get(secondId).stock, 1);
        assert.equal(createdOrder, false);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.findById = originalFindById;
        Product.findOneAndUpdate = originalFindOneAndUpdate;
        Product.updateOne = originalUpdateOne;
        Order.create = originalCreate;
    }
});

test("order creation rejects invalid quantities before reserving stock", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    let productLookupCalled = false;
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Product.findById = async () => {
        productLookupCalled = true;
        return null;
    };

    try {
        const response = makeResponse();
        await orderController.createOrder(
            {
                body: {
                    items: [{
                        product: "507f1f77bcf86cd799439018",
                        quantity: 1.5
                    }],
                    shippingAddress: {
                        name: "Recipient",
                        phone: "01700000000",
                        address: "Delivery road"
                    }
                },
                user: { id: "507f1f77bcf86cd799439017" }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(productLookupCalled, false);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Product.findById = originalFindById;
    }
});

test("unpaid order cancellation is atomic and restores reserved inventory", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    const originalFindByIdAndUpdate = Product.findByIdAndUpdate;
    let filter;
    let update;
    let options;
    const restoredItems = [];
    Order.findOneAndUpdate = async (nextFilter, nextUpdate, nextOptions) => {
        filter = nextFilter;
        update = nextUpdate;
        options = nextOptions;
        return {
            items: [{
                product: "507f1f77bcf86cd799439019",
                quantity: 2
            }]
        };
    };
    Product.findByIdAndUpdate = async (id, change) => {
        restoredItems.push({ id, change });
    };

    try {
        const response = makeResponse();
        await orderController.cancelOrder(
            {
                params: { id: "507f1f77bcf86cd799439020" },
                user: { id: "507f1f77bcf86cd799439021" }
            },
            response
        );

        assert.equal(filter.user, "507f1f77bcf86cd799439021");
        assert.equal(filter.paymentStatus.$ne, "paid");
        assert.deepEqual(filter.status.$nin, [
            "Cancelled",
            "Shipped",
            "Delivered"
        ]);
        assert.equal(update.$set.status, "Cancelled");
        assert.deepEqual(options.arrayFilters, [{
            "settlement.payoutStatus": { $ne: "paid" }
        }]);
        assert.deepEqual(restoredItems, [{
            id: "507f1f77bcf86cd799439019",
            change: { $inc: { stock: 2 } }
        }]);
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
        Product.findByIdAndUpdate = originalFindByIdAndUpdate;
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
            receiptConfirmedAt: null,
            sellerConfirmedAt: null,
            sellerPayoutAccount: "private-account"
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
            sellerConfirmedAt: null,
            payoutStatus: "held"
        }]);
        assert.equal(JSON.stringify(response.body).includes("seller-private-id"), false);
        assert.equal(JSON.stringify(response.body).includes("private-account"), false);
    } finally {
        Order.find = originalFind;
    }
});

test("only the order owner can confirm receipt after paid delivery", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    const originalUpdateOne = Order.updateOne;
    let filter;
    let update;
    let readinessFilter;
    Order.findOneAndUpdate = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { _id: "order-a" };
    };
    Order.updateOne = async nextFilter => {
        readinessFilter = nextFilter;
        return { modifiedCount: 0 };
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
            update.$set["sellerSettlements.$.receiptConfirmedAt"] instanceof Date,
            true
        );
        assert.equal("sellerSettlements.$.payoutStatus" in update.$set, false);
        assert.deepEqual(readinessFilter.sellerSettlements.$elemMatch, {
            _id: "507f1f77bcf86cd799439012",
            deliveryStatus: "Delivered",
            payoutStatus: "held",
            receiptConfirmedAt: { $ne: null },
            sellerConfirmedAt: { $ne: null }
        });
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
        Order.updateOne = originalUpdateOne;
    }
});

test("seller must confirm their own paid delivered shipment before payout readiness", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    const originalUpdateOne = Order.updateOne;
    const originalUserFindById = User.findById;
    let filter;
    let update;
    let readinessFilter;
    User.findById = () => ({
        select: async () => ({
            payoutMethod: "bKash",
            payoutAccount: "01700000000"
        })
    });
    Order.findOneAndUpdate = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { _id: "order-a" };
    };
    Order.updateOne = async nextFilter => {
        readinessFilter = nextFilter;
        return { modifiedCount: 0 };
    };

    try {
        const response = makeResponse();
        await orderController.confirmSellerPayout(
            {
                params: {
                    id: "507f1f77bcf86cd799439011",
                    fulfillmentId: "507f1f77bcf86cd799439012"
                },
                body: {
                    payoutMethod: "bKash",
                    payoutAccount: "01700000000"
                },
                user: { id: "seller-a" }
            },
            response
        );

        assert.deepEqual(filter.sellerSettlements.$elemMatch, {
            _id: "507f1f77bcf86cd799439012",
            seller: "seller-a",
            deliveryStatus: "Delivered",
            payoutStatus: "held",
            sellerConfirmedAt: null
        });
        assert.equal(
            update.$set["sellerSettlements.$.sellerConfirmedAt"] instanceof Date,
            true
        );
        assert.equal(
            update.$set["sellerSettlements.$.sellerPayoutMethod"],
            "bKash"
        );
        assert.equal(
            update.$set["sellerSettlements.$.sellerPayoutAccount"],
            "01700000000"
        );
        assert.equal(
            readinessFilter.sellerSettlements.$elemMatch.receiptConfirmedAt.$ne,
            null
        );
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
        Order.updateOne = originalUpdateOne;
        User.findById = originalUserFindById;
    }
});

test("seller order responses omit buyer profile data and seller IDs", async () => {
    const originalProductFind = Product.find;
    const originalOrderFind = Order.find;
    const originalUserFindById = User.findById;
    User.findById = () => ({
        select: async () => ({
            payoutMethod: "bKash",
            payoutAccount: "01700000000"
        })
    });
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
                receiptConfirmedAt: null,
                sellerConfirmedAt: null,
                sellerPayoutMethod: "",
                sellerPayoutAccount: ""
            }],
            paymentMethod: "sslcommerz",
            paymentStatus: "paid",
            refundRequest: {
                status: "requested",
                reason: "private buyer explanation"
            },
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
        assert.equal(response.body[0].payout.sellerConfirmedAt, null);
        assert.equal(response.body[0].payout.payoutAccount, "01700000000");
        assert.equal(response.body[0].refundStatus, "requested");
        assert.equal("refundRequest" in response.body[0], false);
        assert.equal(JSON.stringify(response.body).includes("private buyer explanation"), false);
    } finally {
        Product.find = originalProductFind;
        Order.find = originalOrderFind;
        User.findById = originalUserFindById;
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

test("admin payout queue requires both buyer and seller confirmations", async () => {
    const originalFind = Order.find;
    let filter;
    const confirmedAt = new Date();
    const seller = {
        _id: "seller-a",
        name: "Seller",
        email: "seller@example.com"
    };
    Order.find = nextFilter => {
        filter = nextFilter;
        return {
            populate() {
                return this;
            },
            sort: async () => [{
                _id: "507f1f77bcf86cd799439011",
                sellerSettlements: [
                    {
                        _id: "fulfillment-ready",
                        seller,
                        amount: 50,
                        deliveryStatus: "Delivered",
                        payoutStatus: "ready",
                        receiptConfirmedAt: confirmedAt,
                        sellerConfirmedAt: confirmedAt,
                        sellerPayoutMethod: "bKash",
                        sellerPayoutAccount: "01700000000"
                    },
                    {
                        _id: "fulfillment-waiting",
                        seller,
                        amount: 30,
                        deliveryStatus: "Delivered",
                        payoutStatus: "ready",
                        receiptConfirmedAt: confirmedAt,
                        sellerConfirmedAt: null
                    }
                ]
            }]
        };
    };

    try {
        const response = makeResponse();
        await orderController.getReadySellerPayouts({}, response);

        assert.deepEqual(filter.sellerSettlements.$elemMatch, {
            deliveryStatus: "Delivered",
            payoutStatus: "ready",
            receiptConfirmedAt: { $ne: null },
            sellerConfirmedAt: { $ne: null }
        });
        assert.deepEqual(filter["refundRequest.status"].$nin, [
            "requested",
            "refunded"
        ]);
        assert.equal(response.body.payouts.length, 1);
        assert.equal(response.body.payouts[0].fulfillmentId, "fulfillment-ready");
    } finally {
        Order.find = originalFind;
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
                    _id: "seller-a",
                    name: "Seller"
                },
                sellerPayoutMethod: "bKash",
                sellerPayoutAccount: "01700000000"
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
            updateFilter.sellerSettlements.$elemMatch.sellerConfirmedAt.$ne,
            null
        );
        assert.deepEqual(updateFilter["refundRequest.status"].$nin, [
            "requested",
            "refunded"
        ]);
        assert.equal(
            update.$set["sellerSettlements.$[settlement].payoutStatus"],
            "paid"
        );
        assert.deepEqual(options.arrayFilters, [{
            "settlement._id": "507f1f77bcf86cd799439012",
            "settlement.deliveryStatus": "Delivered",
            "settlement.payoutStatus": "ready",
            "settlement.receiptConfirmedAt": { $ne: null },
            "settlement.sellerConfirmedAt": { $ne: null }
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
        assert.match(response.body.message, /refund request and review process/i);
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
        assert.equal(order.sellerSettlements[0].sellerConfirmedAt, null);
});

test("customer refund requests are paid-order only and hide reviewer identity", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    let filter;
    let update;
    const orderId = "507f1f77bcf86cd799439030";
    Order.findOneAndUpdate = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return {
            _id: orderId,
            refundRequest: {
                status: "requested",
                reason: "The package arrived damaged.",
                reviewedBy: "private-admin-id"
            },
            sellerSettlements: [{
                _id: "fulfillment-a",
                seller: "private-seller-id",
                payoutStatus: "ready"
            }]
        };
    };

    try {
        const response = makeResponse();
        await orderController.requestOrderRefund(
            {
                params: { id: orderId },
                body: { reason: "  The package arrived damaged.  " },
                user: { id: "507f1f77bcf86cd799439031" }
            },
            response
        );

        assert.equal(filter.user, "507f1f77bcf86cd799439031");
        assert.equal(filter.paymentStatus, "paid");
        assert.deepEqual(filter["refundRequest.status"].$nin, ["requested", "refunded"]);
        assert.deepEqual(filter.sellerSettlements.$not.$elemMatch, {
            payoutStatus: "paid"
        });
        assert.equal(update.$set["refundRequest.reason"], "The package arrived damaged.");
        assert.equal(response.body.order.refundRequest.status, "requested");
        assert.equal("reviewedBy" in response.body.order.refundRequest, false);
        assert.equal(JSON.stringify(response.body).includes("private-seller-id"), false);
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("customer cannot request a refund for an unpaid order or an invalid reason", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    let updateCalled = false;
    Order.findOneAndUpdate = async () => {
        updateCalled = true;
        return null;
    };

    try {
        const response = makeResponse();
        await orderController.requestOrderRefund(
            {
                params: { id: "507f1f77bcf86cd799439032" },
                body: { reason: "Too short" },
                user: { id: "507f1f77bcf86cd799439031" }
            },
            response
        );

        assert.equal(updateCalled, false);
        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /10 to 1000 characters/);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("admin refund completion requires a pending request and cancels unpaid seller payouts", async () => {
    const originalUpdateOne = Order.updateOne;
    let filter;
    let update;
    let options;
    Order.updateOne = async (nextFilter, nextUpdate, nextOptions) => {
        filter = nextFilter;
        update = nextUpdate;
        options = nextOptions;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.recordOrderRefund(
            {
                params: { id: "507f1f77bcf86cd799439033" },
                body: {
                    refundMethod: "SSLCommerz dashboard",
                    refundReference: "REF-1098",
                    adminNote: "Refund issued."
                },
                user: { id: "admin-id" }
            },
            response
        );

        assert.equal(filter.paymentStatus, "paid");
        assert.equal(filter["refundRequest.status"], "requested");
        assert.deepEqual(filter.sellerSettlements.$not.$elemMatch, {
            payoutStatus: "paid"
        });
        assert.equal(update.$set["refundRequest.status"], "refunded");
        assert.equal(update.$set["refundRequest.refundReference"], "REF-1098");
        assert.equal(update.$set["sellerSettlements.$[settlement].payoutStatus"], "cancelled");
        assert.deepEqual(options.arrayFilters, [{
            "settlement.payoutStatus": { $ne: "paid" }
        }]);
        assert.equal(response.statusCode, 200);
    } finally {
        Order.updateOne = originalUpdateOne;
    }
});

test("admin must provide a note when rejecting a refund request", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    let update;
    Order.findOneAndUpdate = async (_filter, nextUpdate) => {
        update = nextUpdate;
        return { _id: "507f1f77bcf86cd799439034" };
    };

    try {
        const response = makeResponse();
        await orderController.rejectOrderRefund(
            {
                params: { id: "507f1f77bcf86cd799439034" },
                body: { adminNote: "The order is outside the Shop's refund terms." },
                user: { id: "admin-id" }
            },
            response
        );

        assert.equal(update.$set["refundRequest.status"], "rejected");
        assert.equal(
            update.$set["refundRequest.adminNote"],
            "The order is outside the Shop's refund terms."
        );
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("orders initialize the refund request workflow as inactive", () => {
    const order = new Order({
        user: "507f1f77bcf86cd799439011",
        items: [{
            product: "507f1f77bcf86cd799439012",
            name: "Product",
            price: 40,
            quantity: 1
        }],
        totalPrice: 40
    });

    assert.equal(order.refundRequest.status, "none");
    assert.equal(order.refundRequest.refundedAt, null);
});
