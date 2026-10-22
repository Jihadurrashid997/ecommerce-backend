const assert = require("node:assert/strict");
const test = require("node:test");
const ShopNotification = require("../models/ShopNotification");
const Order = require("../models/Order");
const User = require("../models/User");
const notificationController = require("../controllers/shopNotificationController");
const paymentController = require("../controllers/paymentController");
const { notifyShopUsers } = require("../services/shopNotifications");
const SSLCommerzPayment = require("sslcommerz-lts");

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

test("Shop notification writes deduplicate recipients and insert each event once", async () => {
    const originalBulkWrite = ShopNotification.bulkWrite;
    const originalUserFind = User.find;
    let operations;
    let options;
    ShopNotification.bulkWrite = async (nextOperations, nextOptions) => {
        operations = nextOperations;
        options = nextOptions;
    };
    User.find = filter => ({
        select() {
            return this;
        },
        lean: async () => filter._id.$in.map(_id => ({ _id }))
    });

    try {
        await notifyShopUsers({
            recipients: [
                "507f1f77bcf86cd799439011",
                "507f1f77bcf86cd799439011",
                "507f1f77bcf86cd799439012"
            ],
            eventKey: "order:payment-received",
            type: "payment_received",
            title: "Payment confirmed",
            message: "The Shop payment was confirmed.",
            href: "/shop/orders",
            orderId: "507f1f77bcf86cd799439013"
        });

        assert.equal(operations.length, 2);
        assert.deepEqual(options, { ordered: false });
        assert.deepEqual(operations[0].updateOne.filter, {
            recipient: "507f1f77bcf86cd799439011",
            eventKey: "order:payment-received"
        });
        assert.equal(
            operations[0].updateOne.update.$setOnInsert.type,
            "payment_received"
        );
        assert.equal(
            operations[0].updateOne.update.$setOnInsert.href,
            "/shop/orders"
        );
        assert.equal(operations[0].updateOne.upsert, true);
    } finally {
        ShopNotification.bulkWrite = originalBulkWrite;
        User.find = originalUserFind;
    }
});

test("Shop notification writes apply category preferences per recipient", async () => {
    const originalBulkWrite = ShopNotification.bulkWrite;
    const originalUserFind = User.find;
    let filter;
    let operations = [];
    User.find = nextFilter => {
        filter = nextFilter;
        return {
            select() {
                return this;
            },
            lean: async () => [{ _id: "507f1f77bcf86cd799439011" }]
        };
    };
    ShopNotification.bulkWrite = async nextOperations => {
        operations = nextOperations;
    };

    try {
        await notifyShopUsers({
            recipients: [
                "507f1f77bcf86cd799439011",
                "507f1f77bcf86cd799439012"
            ],
            eventKey: "order:shipment-update",
            type: "shipment_update",
            title: "Shipment update",
            message: "Your order shipped.",
            href: "/shop/orders"
        });

        assert.deepEqual(filter, {
            _id: {
                $in: [
                    "507f1f77bcf86cd799439011",
                    "507f1f77bcf86cd799439012"
                ]
            },
            "shopNotificationPreferences.orders": { $ne: false }
        });
        assert.equal(operations.length, 1);
        assert.equal(
            operations[0].updateOne.filter.recipient,
            "507f1f77bcf86cd799439011"
        );
    } finally {
        ShopNotification.bulkWrite = originalBulkWrite;
        User.find = originalUserFind;
    }
});

test("Shop notification preferences validate, persist, and default to enabled", async () => {
    const originalFindById = User.findById;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;
    const recipientId = "507f1f77bcf86cd799439011";
    let update;
    User.findById = id => {
        assert.equal(id, recipientId);
        return {
        select() {
            return this;
        },
        lean: async () => ({
            shopNotificationPreferences: { orders: false }
        })
        };
    };
    User.findByIdAndUpdate = (id, changes) => {
        assert.equal(id, recipientId);
        update = changes;
        return {
            select() {
                return this;
            },
            lean: async () => ({
                shopNotificationPreferences: {
                    orders: false,
                    refundsAndPayouts: true,
                    products: false
                }
            })
        };
    };

    try {
        const getResponse = makeResponse();
        await notificationController.getShopNotificationPreferences(
            { user: { id: recipientId } },
            getResponse
        );
        assert.deepEqual(getResponse.body.preferences, {
            orders: false,
            refundsAndPayouts: true,
            products: true
        });

        const updateResponse = makeResponse();
        await notificationController.updateShopNotificationPreferences(
            {
                user: { id: recipientId },
                body: { preferences: { products: false } }
            },
            updateResponse
        );
        assert.deepEqual(update.$set, {
            "shopNotificationPreferences.products": false
        });
        assert.equal(updateResponse.body.preferences.products, false);

        const invalidResponse = makeResponse();
        await notificationController.updateShopNotificationPreferences(
            {
                user: { id: recipientId },
                body: { preferences: { messenger: false } }
            },
            invalidResponse
        );
        assert.equal(invalidResponse.statusCode, 400);
    } finally {
        User.findById = originalFindById;
        User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
});

test("Shop notification feed scopes results and unread totals to the signed-in user", async () => {
    const originalFind = ShopNotification.find;
    const originalCountDocuments = ShopNotification.countDocuments;
    const recipientId = "507f1f77bcf86cd799439011";
    const cursorId = "507f1f77bcf86cd799439012";
    const cursorDate = new Date("2026-06-20T12:00:00.000Z");
    const notificationDate = new Date("2026-06-20T11:00:00.000Z");
    const notification = {
        _id: "507f1f77bcf86cd799439013",
        recipient: recipientId,
        createdAt: notificationDate,
        readAt: null
    };
    let feedFilter;
    let countFilters = [];
    ShopNotification.find = filter => {
        feedFilter = filter;
        return {
            sort() {
                return this;
            },
            limit() {
                return this;
            },
            lean: async () => [notification]
        };
    };
    ShopNotification.countDocuments = async filter => {
        countFilters.push(filter);
        return filter.readAt === null ? 1 : 1;
    };

    try {
        const response = makeResponse();
        await notificationController.getShopNotifications(
            {
                user: { id: recipientId },
                query: {
                    limit: "10",
                    before: `${cursorDate.toISOString()}_${cursorId}`
                }
            },
            response
        );

        assert.deepEqual(feedFilter, {
            recipient: recipientId,
            $or: [
                { createdAt: { $lt: cursorDate } },
                { createdAt: cursorDate, _id: { $lt: cursorId } }
            ]
        });
        assert.deepEqual(countFilters, [
            { recipient: recipientId, readAt: null },
            feedFilter
        ]);
        assert.equal(response.body.unreadCount, 1);
        assert.deepEqual(response.body.notifications, [notification]);
    } finally {
        ShopNotification.find = originalFind;
        ShopNotification.countDocuments = originalCountDocuments;
    }
});

test("Shop unread-count endpoint queries only the signed-in user's unread items", async () => {
    const originalCountDocuments = ShopNotification.countDocuments;
    const recipientId = "507f1f77bcf86cd799439011";
    let filter;
    ShopNotification.countDocuments = async nextFilter => {
        filter = nextFilter;
        return 4;
    };

    try {
        const response = makeResponse();
        await notificationController.getShopNotificationUnreadCount(
            { user: { id: recipientId } },
            response
        );

        assert.deepEqual(filter, {
            recipient: recipientId,
            readAt: null
        });
        assert.deepEqual(response.body, {
            success: true,
            unreadCount: 4
        });
    } finally {
        ShopNotification.countDocuments = originalCountDocuments;
    }
});

test("marking a Shop notification read cannot update another user's notification", async () => {
    const originalFindOneAndUpdate = ShopNotification.findOneAndUpdate;
    const recipientId = "507f1f77bcf86cd799439011";
    const notificationId = "507f1f77bcf86cd799439012";
    let filter;
    ShopNotification.findOneAndUpdate = (nextFilter, update, options) => {
        filter = nextFilter;
        assert.deepEqual(Object.keys(update.$set), ["readAt"]);
        assert.equal(options.new, true);
        return {
            lean: async () => null
        };
    };

    try {
        const response = makeResponse();
        await notificationController.markShopNotificationRead(
            {
                params: { id: notificationId },
                user: { id: recipientId }
            },
            response
        );

        assert.deepEqual(filter, {
            _id: notificationId,
            recipient: recipientId
        });
        assert.equal(response.statusCode, 404);
    } finally {
        ShopNotification.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test("verified Shop payment notifies buyer and sellers without sharing buyer identity", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const originalBulkWrite = ShopNotification.bulkWrite;
    const originalUserFind = User.find;
    const originalValidate = SSLCommerzPayment.prototype.validate;
    const buyerId = "507f1f77bcf86cd799439011";
    const sellerId = "507f1f77bcf86cd799439012";
    const order = {
        _id: "507f1f77bcf86cd799439013",
        user: buyerId,
        totalPrice: 50,
        sellerSettlements: [{ seller: sellerId }]
    };
    let operations = [];
    Order.findOne = async () => order;
    Order.updateOne = async () => ({ modifiedCount: 1 });
    ShopNotification.bulkWrite = async nextOperations => {
        operations = [...operations, ...nextOperations];
    };
    User.find = filter => ({
        select() {
            return this;
        },
        lean: async () => filter._id.$in.map(_id => ({ _id }))
    });
    SSLCommerzPayment.prototype.validate = async () => ({
        status: "VALID",
        tran_id: "TXN-PAID",
        amount: "50",
        currency: "BDT"
    });

    try {
        const response = makeResponse();
        await paymentController.paymentIPN(
            {
                body: {
                    tran_id: "TXN-PAID",
                    status: "VALID",
                    amount: "50",
                    currency: "BDT",
                    val_id: "VALIDATION-ID"
                }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(
            operations.map(operation => operation.updateOne.filter.recipient),
            [buyerId, sellerId]
        );
        assert.ok(operations.every(operation =>
            operation.updateOne.update.$setOnInsert.type === "payment_received"
        ));
        assert.match(
            operations[1].updateOne.update.$setOnInsert.message,
            /identity remains private/
        );
        assert.equal(
            operations[1].updateOne.update.$setOnInsert.message.includes(buyerId),
            false
        );
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        ShopNotification.bulkWrite = originalBulkWrite;
        User.find = originalUserFind;
        SSLCommerzPayment.prototype.validate = originalValidate;
    }
});
