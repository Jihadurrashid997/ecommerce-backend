const assert = require("node:assert/strict");
const test = require("node:test");
const ShopNotification = require("../models/ShopNotification");
const Order = require("../models/Order");
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
    let operations;
    let options;
    ShopNotification.bulkWrite = async (nextOperations, nextOptions) => {
        operations = nextOperations;
        options = nextOptions;
    };

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
    SSLCommerzPayment.prototype.validate = async () => ({
        status: "VALID"
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
        SSLCommerzPayment.prototype.validate = originalValidate;
    }
});
