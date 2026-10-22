const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const ShopNotification = require("../models/ShopNotification");
const marketplaceSettings = require("../services/marketplaceSettings");
const orderController = require("../controllers/orderController");
const productController = require("../controllers/productController");
const paymentController = require("../controllers/paymentController");

ShopNotification.bulkWrite = async () => ({});
User.find = () => ({
    select() {
        return this;
    },
    lean: async () => []
});

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
    const originalFindOne = Order.findOne;
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
    Order.findOne = () => ({
        select: async () => null
    });
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
                user: { id: "buyer" },
                headers: { "idempotency-key": "checkout-order-01" }
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
        assert.equal(createdOrder.statusHistory[0].toStatus, "Pending");
        assert.equal(createdOrder.statusHistory[0].actorRole, "buyer");
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
        Order.findOne = originalFindOne;
    }
});

test("duplicate checkout idempotency key returns the existing order without reserving stock", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindOne = Order.findOne;
    const originalProductFindById = Product.findById;
    const userId = "507f1f77bcf86cd799439017";
    const productId = "507f1f77bcf86cd799439015";
    const request = {
        items: [{ product: productId, quantity: 1 }],
        shippingAddress: {
            name: "Recipient",
            phone: "01700000000",
            address: "Delivery road"
        }
    };
    const checkoutRequestHash = crypto
        .createHash("sha256")
        .update(JSON.stringify({
            items: [[productId, 1]],
            shippingAddress: {
                name: "Recipient",
                phone: "01700000000",
                address: "Delivery road",
                city: "",
                postalCode: ""
            },
            paymentMethod: "sslcommerz"
        }))
        .digest("hex");
    const existingOrder = {
        _id: "507f1f77bcf86cd799439019",
        checkoutRequestHash,
        sellerSettlements: [],
        refundRequest: { status: "none" },
        toObject() {
            return {
                _id: this._id,
                sellerSettlements: this.sellerSettlements,
                refundRequest: this.refundRequest
            };
        }
    };
    marketplaceSettings.getMarketplaceSettings = async () => ({
        marketplaceEnabled: true,
        requireProductApproval: false
    });
    Order.findOne = filter => {
        assert.deepEqual(filter, {
            user: userId,
            checkoutIdempotencyKey: "checkout-retry-01"
        });
        return {
            select: async () => existingOrder
        };
    };
    Product.findById = async () => {
        throw new Error("Replayed checkout must not reserve inventory.");
    };

    try {
        const response = makeResponse();
        await orderController.createOrder(
            {
                body: request,
                user: { id: userId },
                headers: { "idempotency-key": "checkout-retry-01" }
            },
            response
        );
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.order._id, existingOrder._id);

        const mismatchResponse = makeResponse();
        await orderController.createOrder(
            {
                body: {
                    ...request,
                    items: [{ product: productId, quantity: 2 }]
                },
                user: { id: userId },
                headers: { "idempotency-key": "checkout-retry-01" }
            },
            mismatchResponse
        );
        assert.equal(mismatchResponse.statusCode, 409);
    } finally {
        marketplaceSettings.getMarketplaceSettings = originalGetSettings;
        Order.findOne = originalFindOne;
        Product.findById = originalProductFindById;
    }
});

test("order creation reserves duplicate product quantities atomically", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalCreate = Order.create;
    const originalFindOne = Order.findOne;
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
    Order.findOne = () => ({
        select: async () => null
    });
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
                user: { id: "507f1f77bcf86cd799439017" },
                headers: { "idempotency-key": "checkout-order-02" }
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
        Order.findOne = originalFindOne;
    }
});

test("partial inventory reservation is rolled back when another product sells out", async () => {
    const originalGetSettings = marketplaceSettings.getMarketplaceSettings;
    const originalFindById = Product.findById;
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalUpdateOne = Product.updateOne;
    const originalCreate = Order.create;
    const originalFindOne = Order.findOne;
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
    Order.findOne = () => ({
        select: async () => null
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
                user: { id: "507f1f77bcf86cd799439026" },
                headers: { "idempotency-key": "checkout-order-03" }
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
        Order.findOne = originalFindOne;
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
        assert.deepEqual(update.$push.statusHistory, {
            fromStatus: "Pending",
            toStatus: "Cancelled",
            actor: "507f1f77bcf86cd799439021",
            actorRole: "buyer",
            note: "Buyer cancelled the unpaid order.",
            source: "buyer"
        });
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
        statusHistory: [{
            fromStatus: "Pending",
            toStatus: "Processing",
            actor: "seller-private-id",
            actorRole: "seller",
            fulfillmentId: "fulfillment-a",
            source: "seller",
            occurredAt: new Date()
        }],
        toObject() {
            return {
                _id: "order-a",
                sellerSettlements: this.sellerSettlements,
                statusHistory: this.statusHistory
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
            courierName: "",
            trackingNumber: "",
            trackingUrl: "",
            deliveryEvidence: "",
            shipmentHistory: [],
            receiptConfirmedAt: null,
            sellerConfirmedAt: null,
            payoutStatus: "held"
        }]);
        assert.equal(JSON.stringify(response.body).includes("seller-private-id"), false);
        assert.equal(JSON.stringify(response.body).includes("private-account"), false);
        assert.equal("actor" in response.body[0].statusHistory[0], false);
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

test("seller shipment updates store per-seller tracking and manual delivery history", async () => {
    const originalFindById = Order.findById;
    const sellerId = "507f1f77bcf86cd799439041";
    const settlement = {
        _id: "507f1f77bcf86cd799439042",
        seller: sellerId,
        deliveryStatus: "Processing",
        shipmentHistory: [],
        courierName: "",
        trackingNumber: "",
        trackingUrl: "",
        deliveryEvidence: ""
    };
    const order = {
        _id: "507f1f77bcf86cd799439043",
        user: "507f1f77bcf86cd799439044",
        status: "Processing",
        paymentStatus: "paid",
        refundRequest: { status: "none" },
        statusHistory: [],
        items: [{ product: { seller: sellerId } }],
        sellerSettlements: [settlement],
        save: async () => {}
    };
    Order.findById = () => ({
        populate: async () => order
    });

    try {
        const response = makeResponse();
        await orderController.updateSellerOrderStatus(
            {
                params: { id: order._id },
                body: {
                    status: "Shipped",
                    courierName: "Example Courier",
                    trackingNumber: "TRACK-1024",
                    trackingUrl: "https://courier.example/track/TRACK-1024"
                },
                user: { id: sellerId }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(settlement.deliveryStatus, "Shipped");
        assert.equal(settlement.courierName, "Example Courier");
        assert.equal(settlement.trackingNumber, "TRACK-1024");
        assert.equal(settlement.shipmentHistory.length, 1);
        assert.equal(settlement.shipmentHistory[0].source, "manual");
        assert.equal(order.statusHistory.length, 1);
        assert.equal(order.statusHistory[0].fromStatus, "Processing");
        assert.equal(order.statusHistory[0].toStatus, "Shipped");
        assert.equal(order.statusHistory[0].actorRole, "seller");
        assert.equal(
            String(settlement.shipmentHistory[0].updatedBy),
            sellerId
        );
    } finally {
        Order.findById = originalFindById;
    }
});

test("seller cannot advance unpaid shipments, skip transitions, or cancel via shipment updates", async () => {
    const originalFindById = Order.findById;
    const sellerId = "507f1f77bcf86cd799439047";
    const order = {
        _id: "507f1f77bcf86cd799439048",
        status: "Pending",
        paymentStatus: "pending",
        refundRequest: { status: "none" },
        statusHistory: [],
        items: [{ product: { seller: sellerId } }],
        sellerSettlements: [{
            _id: "507f1f77bcf86cd799439050",
            seller: sellerId,
            deliveryStatus: "Pending",
            shipmentHistory: [],
            deliveryEvidence: ""
        }],
        save: async () => {
            order.saved = true;
        }
    };
    Order.findById = () => ({
        populate: async () => order
    });

    try {
        const unpaidResponse = makeResponse();
        await orderController.updateSellerOrderStatus(
            {
                params: { id: order._id },
                body: { status: "Processing" },
                user: { id: sellerId }
            },
            unpaidResponse
        );
        assert.equal(unpaidResponse.statusCode, 409);
        assert.equal(order.saved, undefined);

        order.paymentStatus = "paid";
        const skippedResponse = makeResponse();
        await orderController.updateSellerOrderStatus(
            {
                params: { id: order._id },
                body: {
                    status: "Delivered",
                    deliveryEvidence: "Left at the delivery address."
                },
                user: { id: sellerId }
            },
            skippedResponse
        );
        assert.equal(skippedResponse.statusCode, 409);
        assert.equal(order.saved, undefined);

        const cancelledResponse = makeResponse();
        await orderController.updateSellerOrderStatus(
            {
                params: { id: order._id },
                body: { status: "Cancelled" },
                user: { id: sellerId }
            },
            cancelledResponse
        );
        assert.equal(cancelledResponse.statusCode, 400);
        assert.equal(order.saved, undefined);
    } finally {
        Order.findById = originalFindById;
    }
});

test("admin order updates cannot skip shipment transitions and are auditable", async () => {
    const originalFindById = Order.findById;
    const order = {
        _id: "507f1f77bcf86cd799439051",
        status: "Pending",
        paymentStatus: "paid",
        refundRequest: { status: "none" },
        statusHistory: [],
        sellerSettlements: [{
            _id: "507f1f77bcf86cd799439052",
            seller: "507f1f77bcf86cd799439053",
            deliveryStatus: "Pending",
            shipmentHistory: [],
            deliveryEvidence: "",
            courierName: "",
            trackingNumber: "",
            trackingUrl: ""
        }],
        save: async () => {
            order.saved = true;
        }
    };
    Order.findById = async () => order;

    try {
        const skippedResponse = makeResponse();
        await orderController.updateOrderStatus(
            {
                params: { id: order._id },
                body: { status: "Shipped" },
                user: { id: "507f1f77bcf86cd799439054" }
            },
            skippedResponse
        );
        assert.equal(skippedResponse.statusCode, 409);
        assert.equal(order.saved, undefined);

        const validResponse = makeResponse();
        await orderController.updateOrderStatus(
            {
                params: { id: order._id },
                body: { status: "Processing" },
                user: { id: "507f1f77bcf86cd799439054" }
            },
            validResponse
        );
        assert.equal(validResponse.statusCode, 200);
        assert.equal(order.statusHistory.length, 1);
        assert.equal(order.statusHistory[0].actorRole, "admin");
        assert.equal(order.sellerSettlements[0].shipmentHistory[0].updatedBy, "507f1f77bcf86cd799439054");
    } finally {
        Order.findById = originalFindById;
    }
});

test("manual delivery cannot be marked complete without seller evidence", async () => {
    const originalFindById = Order.findById;
    const sellerId = "507f1f77bcf86cd799439045";
    const order = {
        _id: "507f1f77bcf86cd799439046",
        status: "Shipped",
        paymentStatus: "paid",
        refundRequest: { status: "none" },
        items: [{ product: { seller: sellerId } }],
        sellerSettlements: [{
            seller: sellerId,
            deliveryStatus: "Shipped",
            deliveryEvidence: "",
            shipmentHistory: []
        }],
        save: async () => {}
    };
    Order.findById = () => ({
        populate: async () => order
    });

    try {
        const response = makeResponse();
        await orderController.updateSellerOrderStatus(
            {
                params: { id: order._id },
                body: { status: "Delivered" },
                user: { id: sellerId }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /delivery note or evidence/i);
    } finally {
        Order.findById = originalFindById;
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
                        _id: "fulfillment-approved",
                        seller,
                        amount: 40,
                        deliveryStatus: "Delivered",
                        payoutStatus: "approved",
                        payoutApprovedAt: confirmedAt,
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
            payoutStatus: { $in: ["ready", "approved"] },
            receiptConfirmedAt: { $ne: null },
            sellerConfirmedAt: { $ne: null }
        });
        assert.deepEqual(filter["refundRequest.status"].$nin, [
            "requested",
            "refunded"
        ]);
        assert.equal(response.body.payouts.length, 2);
        assert.equal(response.body.payouts[0].fulfillmentId, "fulfillment-ready");
        assert.equal(response.body.payouts[1].payoutStatus, "approved");
    } finally {
        Order.find = originalFind;
    }
});

test("admin can record a seller payout only after approval", async () => {
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
            "approved"
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
            "settlement.payoutStatus": "approved",
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

test("duplicate manual payout recording is rejected atomically", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const originalBulkWrite = ShopNotification.bulkWrite;
    let updateCount = 0;
    Order.findOne = () => ({
        populate: async () => ({
            _id: "507f1f77bcf86cd799439011",
            user: "507f1f77bcf86cd799439015",
            sellerSettlements: [{
                _id: "507f1f77bcf86cd799439012",
                seller: {
                    _id: "507f1f77bcf86cd799439013",
                    name: "Seller"
                },
                sellerPayoutMethod: "bKash",
                sellerPayoutAccount: "01700000000"
            }]
        })
    });
    Order.updateOne = async filter => {
        updateCount += 1;
        assert.equal(
            filter.sellerSettlements.$elemMatch.payoutStatus,
            "approved"
        );
        return { modifiedCount: 0 };
    };
    ShopNotification.bulkWrite = async () => {
        assert.fail("Duplicate payout processing must not emit payout notifications.");
    };

    try {
        const response = makeResponse();
        await orderController.markSellerPayoutPaid(
            {
                params: { id: "507f1f77bcf86cd799439011" },
                body: {
                    fulfillmentId: "507f1f77bcf86cd799439012",
                    payoutMethod: "bKash",
                    payoutReference: "TRX-DUPLICATE"
                },
                user: { id: "507f1f77bcf86cd799439014" }
            },
            response
        );

        assert.equal(updateCount, 1);
        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /not ready|already been processed/i);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        ShopNotification.bulkWrite = originalBulkWrite;
    }
});

test("admin payout approval requires paid order, confirmations, and an active seller", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const originalUserFindOne = User.findOne;
    let findFilter;
    let updateFilter;
    let update;
    let options;
    Order.findOne = filter => {
        findFilter = filter;
        return {
            select: async () => ({
                sellerSettlements: [{
                    _id: "507f1f77bcf86cd799439012",
                    seller: "507f1f77bcf86cd799439013",
                    sellerPayoutMethod: "bKash",
                    sellerPayoutAccount: "01700000000"
                }]
            })
        };
    };
    User.findOne = filter => ({
        select: async () => {
            assert.deepEqual(filter, {
                _id: "507f1f77bcf86cd799439013",
                role: "seller",
                isSuspended: { $ne: true }
            });
            return { _id: filter._id };
        }
    });
    Order.updateOne = async (filter, nextUpdate, nextOptions) => {
        updateFilter = filter;
        update = nextUpdate;
        options = nextOptions;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.approveSellerPayout(
            {
                params: { id: "507f1f77bcf86cd799439011" },
                body: { fulfillmentId: "507f1f77bcf86cd799439012" },
                user: { id: "507f1f77bcf86cd799439014" }
            },
            response
        );

        assert.equal(findFilter.paymentStatus, "paid");
        assert.equal(findFilter.sellerSettlements.$elemMatch.payoutStatus, "ready");
        assert.deepEqual(findFilter["refundRequest.status"].$nin, [
            "requested",
            "refunded"
        ]);
        assert.equal(updateFilter.paymentStatus, "paid");
        assert.equal(
            update.$set["sellerSettlements.$[settlement].payoutStatus"],
            "approved"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].payoutApprovedBy"],
            "507f1f77bcf86cd799439014"
        );
        assert.equal(options.arrayFilters[0]["settlement.payoutStatus"], "ready");
        assert.equal(response.statusCode, 200);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        User.findOne = originalUserFindOne;
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
        assert.match(response.body.message, /generic status updates cannot cancel orders/i);
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
    const originalFindOne = Order.findOne;
    Order.findOne = () => ({
        select: async () => ({
            _id: "507f1f77bcf86cd799439033",
            user: "507f1f77bcf86cd799439031",
            sellerSettlements: [{
                seller: "507f1f77bcf86cd799439032"
            }],
            refundRequest: {
                requestedAt: new Date("2026-06-20T12:00:00.000Z")
            }
        })
    });
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
        assert.equal(update.$set.paymentStatus, "refunded");
        assert.equal(update.$set["refundRequest.status"], "refunded");
        assert.equal(update.$set["refundRequest.refundReference"], "REF-1098");
        assert.equal(update.$set["sellerSettlements.$[settlement].payoutStatus"], "cancelled");
        assert.deepEqual(options.arrayFilters, [{
            "settlement.payoutStatus": { $ne: "paid" }
        }]);
        assert.equal(response.statusCode, 200);
    } finally {
        Order.updateOne = originalUpdateOne;
        Order.findOne = originalFindOne;
    }
});

test("admin must provide a note when rejecting a refund request", async () => {
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    let update;
    Order.findOneAndUpdate = async (_filter, nextUpdate) => {
        update = nextUpdate;
    return {
        _id: "507f1f77bcf86cd799439034",
        refundRequest: {
            requestedAt: new Date("2026-06-20T12:00:00.000Z")
        }
    };
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

test("orders accept refunded payment status", () => {
    const order = new Order({
        user: "507f1f77bcf86cd799439011",
        items: [{
            product: "507f1f77bcf86cd799439012",
            name: "Product",
            price: 40,
            quantity: 1
        }],
        totalPrice: 40,
        paymentStatus: "refunded"
    });

    assert.equal(order.validateSync(), undefined);
});

test("a stale payment IPN cannot restore an order after a refund", async () => {
    const originalFindOne = Order.findOne;
    let updateCalled = false;
    Order.findOne = async () => ({
        paymentStatus: "refunded",
        refundRequest: { status: "refunded" },
        status: "Delivered"
    });
    const originalUpdateOne = Order.updateOne;
    Order.updateOne = async () => {
        updateCalled = true;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await paymentController.paymentIPN(
            {
                body: {
                    tran_id: "TXN-OLD",
                    status: "VALID",
                    amount: "40",
                    currency: "BDT",
                    val_id: "VALIDATION-ID"
                }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.equal(updateCalled, false);
        assert.match(response.body.message, /already been refunded/i);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
    }
});
