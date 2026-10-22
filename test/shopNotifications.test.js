const assert = require("node:assert/strict");
const test = require("node:test");
const ShopNotification = require("../models/ShopNotification");
const Order = require("../models/Order");
const User = require("../models/User");
const notificationController = require("../controllers/shopNotificationController");
const paymentController = require("../controllers/paymentController");
const { notifyShopUsers } = require("../services/shopNotifications");
const SSLCommerzPayment = require("sslcommerz-lts");

const originalPaymentEnvironment = {
    mode: process.env.SSLCOMMERZ_MODE,
    sandboxStoreId: process.env.SSLCOMMERZ_SANDBOX_STORE_ID,
    sandboxStorePassword: process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD,
    serverUrl: process.env.SERVER_URL,
    clientUrl: process.env.CLIENT_URL
};
process.env.SSLCOMMERZ_MODE = "sandbox";
process.env.SSLCOMMERZ_SANDBOX_STORE_ID = "sandbox-store";
process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD = "sandbox-password";
process.env.SERVER_URL = "https://api.example.test";
process.env.CLIENT_URL = "https://client.example.test";

test.after(() => {
    if (originalPaymentEnvironment.mode === undefined) delete process.env.SSLCOMMERZ_MODE;
    else process.env.SSLCOMMERZ_MODE = originalPaymentEnvironment.mode;
    if (originalPaymentEnvironment.sandboxStoreId === undefined) delete process.env.SSLCOMMERZ_SANDBOX_STORE_ID;
    else process.env.SSLCOMMERZ_SANDBOX_STORE_ID = originalPaymentEnvironment.sandboxStoreId;
    if (originalPaymentEnvironment.sandboxStorePassword === undefined) delete process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD;
    else process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD = originalPaymentEnvironment.sandboxStorePassword;
    if (originalPaymentEnvironment.serverUrl === undefined) delete process.env.SERVER_URL;
    else process.env.SERVER_URL = originalPaymentEnvironment.serverUrl;
    if (originalPaymentEnvironment.clientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = originalPaymentEnvironment.clientUrl;
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
    Order.findOne = () => ({
        select: async () => order,
        then: (resolve, reject) => Promise.resolve(order).then(resolve, reject)
    });
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
    SSLCommerzPayment.prototype.validate = async data => {
        assert.deepEqual(data, { val_id: "VALIDATION-ID" });
        return {
        status: "VALID",
        tran_id: "TXN-PAID",
        val_id: "VALIDATION-ID",
        amount: "50",
        currency: "BDT",
        currency_type: "BDT"
        };
    };

    try {
        const response = makeResponse();
        await paymentController.paymentIPN(
            {
                body: {
                    tran_id: "TXN-PAID",
                    status: "VALID",
                    amount: "50",
                    currency: "BDT",
                    currency_type: "BDT",
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

test("SSLCommerz validation rejects mismatched provider transaction details", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const originalValidate = SSLCommerzPayment.prototype.validate;
    const order = {
        _id: "507f1f77bcf86cd799439013",
        user: "507f1f77bcf86cd799439011",
        totalPrice: 50,
        paymentStatus: "pending",
        sellerSettlements: []
    };
    const updates = [];
    Order.findOne = () => ({
        select: async () => order,
        then: (resolve, reject) => Promise.resolve(order).then(resolve, reject)
    });

    Order.updateOne = async (filter, update) => {
        updates.push({ filter, update });
        return { modifiedCount: 0 };
    };
    SSLCommerzPayment.prototype.validate = async () => ({
        status: "VALID",
        tran_id: "TXN-OTHER",
        val_id: "VALIDATION-ID",
        amount: "50",
        currency: "BDT",
        currency_type: "BDT"
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
                    currency_type: "BDT",
                    val_id: "VALIDATION-ID"
                }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /do not match/i);
        assert.equal(
            updates.some(({ update }) => update.$set?.paymentStatus === "paid"),
            false
        );
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        SSLCommerzPayment.prototype.validate = originalValidate;
    }
});

test("SSLCommerz IPN rejects mismatched amount, currency, validation ID, and order transaction", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const originalValidate = SSLCommerzPayment.prototype.validate;
    const order = {
        _id: "507f1f77bcf86cd799439013",
        user: "507f1f77bcf86cd799439011",
        totalPrice: 50,
        paymentStatus: "pending",
        sellerSettlements: []
    };
    let updateCount = 0;
    let validation = {};
    Order.findOne = async () => order;
    Order.updateOne = async () => {
        updateCount += 1;
        return { modifiedCount: 1 };
    };
    SSLCommerzPayment.prototype.validate = async () => validation;

    const invalidCases = [
        { name: "IPN amount", body: { amount: "50.01" } },
        { name: "IPN currency", body: { currency: "USD" } },
        { name: "IPN currency type", body: { currency_type: "USD" } },
        { name: "validated amount", validation: { amount: "49.99" } },
        { name: "validated currency", validation: { currency: "USD" } },
        { name: "validated currency type", validation: { currency_type: "USD" } },
        { name: "validation ID", validation: { val_id: "OTHER-VALIDATION-ID" } },
        { name: "provider transaction ID", validation: { tran_id: "TXN-OTHER" } }
    ];

    try {
        for (const invalidCase of invalidCases) {
            validation = {
                status: "VALID",
                tran_id: "TXN-PAID",
                val_id: "VALIDATION-ID",
                amount: "50.00",
                currency: "BDT",
                currency_type: "BDT",
                ...invalidCase.validation
            };
            const response = makeResponse();
            await paymentController.paymentIPN(
                {
                    body: {
                        tran_id: "TXN-PAID",
                        status: "VALID",
                        amount: "50.00",
                        currency: "BDT",
                        currency_type: "BDT",
                        val_id: "VALIDATION-ID",
                        ...invalidCase.body
                    }
                },
                response
            );

            assert.equal(response.statusCode, 400, invalidCase.name);
            assert.equal(updateCount, 0, invalidCase.name);
        }
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        SSLCommerzPayment.prototype.validate = originalValidate;
    }
});

test("expired order cannot be paid or marked paid by a late provider callback", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const originalValidate = SSLCommerzPayment.prototype.validate;
    const order = {
        _id: "507f1f77bcf86cd799439013",
        user: "507f1f77bcf86cd799439011",
        totalPrice: 50,
        status: "Pending",
        paymentStatus: "pending",
        reservationExpiresAt: new Date("2026-10-22T13:30:00.000Z"),
        sellerSettlements: []
    };
    let paymentUpdateCalled = false;
    Order.findOne = () => ({
        select: async () => order,
        then: (resolve, reject) => Promise.resolve(order).then(resolve, reject)
    });
    Order.updateOne = async () => {
        paymentUpdateCalled = true;
        return { modifiedCount: 1 };
    };
    SSLCommerzPayment.prototype.validate = async () => ({
        status: "VALID",
        tran_id: "TXN-PAID",
        val_id: "VALIDATION-ID",
        amount: "50",
        currency: "BDT",
        currency_type: "BDT"
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
                    currency_type: "BDT",
                    val_id: "VALIDATION-ID"
                }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /reservation expired/i);
        assert.equal(paymentUpdateCalled, false);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        SSLCommerzPayment.prototype.validate = originalValidate;
    }
});

test("duplicate valid SSLCommerz IPN does not process payment or notify twice", async () => {
    const originalFindOne = Order.findOne;
    const originalFindById = Order.findById;
    const originalUpdateOne = Order.updateOne;
    const originalValidate = SSLCommerzPayment.prototype.validate;
    const originalBulkWrite = ShopNotification.bulkWrite;
    const order = {
        _id: "507f1f77bcf86cd799439013",
        user: "507f1f77bcf86cd799439011",
        totalPrice: 50,
        paymentStatus: "pending",
        sellerSettlements: []
    };
    let paymentUpdates = 0;
    let notificationWrites = 0;
    Order.findOne = async () => order;
    Order.findById = () => ({
        select: async () => ({ paymentStatus: "paid" })
    });
    Order.updateOne = async () => {
        paymentUpdates += 1;
        return { modifiedCount: 0 };
    };
    ShopNotification.bulkWrite = async () => {
        notificationWrites += 1;
    };
    SSLCommerzPayment.prototype.validate = async () => ({
        status: "VALID",
        tran_id: "TXN-PAID",
        val_id: "VALIDATION-ID",
        amount: "50",
        currency: "BDT",
        currency_type: "BDT"
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
                    currency_type: "BDT",
                    val_id: "VALIDATION-ID"
                }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.match(response.body.message, /already verified/i);
        assert.equal(paymentUpdates, 1);
        assert.equal(notificationWrites, 0);
    } finally {
        Order.findOne = originalFindOne;
        Order.findById = originalFindById;
        Order.updateOne = originalUpdateOne;
        ShopNotification.bulkWrite = originalBulkWrite;
        SSLCommerzPayment.prototype.validate = originalValidate;
    }
});

test("concurrent payment initialization permits only one attempt for the same pending order", async () => {
    const paymentControllerPath = require.resolve("../controllers/paymentController");
    const originalController = require.cache[paymentControllerPath];
    const originalStoreId = process.env.SSLCOMMERZ_SANDBOX_STORE_ID;
    const originalStorePassword = process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD;
    const originalMode = process.env.SSLCOMMERZ_MODE;
    const originalServerUrl = process.env.SERVER_URL;
    const originalClientUrl = process.env.CLIENT_URL;
    const originalFindById = Order.findById;
    const originalUpdateOne = Order.updateOne;
    const originalInit = SSLCommerzPayment.prototype.init;
    const orderId = "507f1f77bcf86cd799439013";
    const buyerId = "507f1f77bcf86cd799439011";
    const order = {
        _id: orderId,
        user: buyerId,
        totalPrice: 50,
        status: "Pending",
        paymentStatus: "pending",
        transactionId: "",
        sellerSettlements: []
    };
    const filters = [];
    let gatewayInitializations = 0;
    process.env.SSLCOMMERZ_MODE = "sandbox";
    process.env.SSLCOMMERZ_SANDBOX_STORE_ID = "test-store";
    process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD = "test-password";
    delete require.cache[paymentControllerPath];
    const configuredPaymentController = require("../controllers/paymentController");
    Order.findById = async () => ({ ...order });
    Order.updateOne = async filter => {
        filters.push(filter);
        return { modifiedCount: filters.length === 1 ? 1 : 0 };
    };
    let initData;
    SSLCommerzPayment.prototype.init = async function(data) {
        initData = data;
        assert.equal(this.baseURL, "https://sandbox.sslcommerz.com");
        assert.equal(this.store_id, "test-store");
        assert.equal(this.store_passwd, "test-password");
        gatewayInitializations += 1;
        return {
            GatewayPageURL:
                "https://sandbox.sslcommerz.com/gwprocess/v4/test"
        };
    };

    const request = {
        body: {
            orderId,
            totalAmount: 50,
            name: "Buyer",
            email: "buyer@example.com",
            phone: "01700000000",
            address: "Dhaka"
        },
        user: { id: buyerId }
    };

    try {
        const firstResponse = makeResponse();
        const secondResponse = makeResponse();
        await configuredPaymentController.initPayment(request, firstResponse);
        await configuredPaymentController.initPayment(request, secondResponse);

        assert.equal(firstResponse.statusCode, 200);
        assert.equal(secondResponse.statusCode, 409);
        assert.equal(gatewayInitializations, 1);
        assert.equal(filters.length, 2);
        assert.equal(initData.success_url, "https://api.example.test/api/payment/success");
        assert.equal(initData.fail_url, "https://api.example.test/api/payment/fail");
        assert.equal(initData.cancel_url, "https://api.example.test/api/payment/cancel");
        assert.equal(initData.ipn_url, "https://api.example.test/api/payment/ipn");
        assert.equal("store_id" in initData, false);
        assert.equal("store_passwd" in initData, false);
        assert.equal(JSON.stringify(firstResponse.body).includes("test-password"), false);
        assert.equal(JSON.stringify(firstResponse.body).includes("test-store"), false);
        assert.ok(filters.every(filter =>
            filter.paymentStatus === "pending" && filter.transactionId === ""
        ));
    } finally {
        Order.findById = originalFindById;
        Order.updateOne = originalUpdateOne;
        SSLCommerzPayment.prototype.init = originalInit;
        if (originalStoreId === undefined) delete process.env.SSLCOMMERZ_SANDBOX_STORE_ID;
        else process.env.SSLCOMMERZ_SANDBOX_STORE_ID = originalStoreId;
        if (originalStorePassword === undefined) delete process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD;
        else process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD = originalStorePassword;
        if (originalMode === undefined) delete process.env.SSLCOMMERZ_MODE;
        else process.env.SSLCOMMERZ_MODE = originalMode;
        if (originalServerUrl === undefined) delete process.env.SERVER_URL;
        else process.env.SERVER_URL = originalServerUrl;
        if (originalClientUrl === undefined) delete process.env.CLIENT_URL;
        else process.env.CLIENT_URL = originalClientUrl;
        delete require.cache[paymentControllerPath];
        if (originalController) require.cache[paymentControllerPath] = originalController;
    }
});
