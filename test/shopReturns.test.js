const assert = require("node:assert/strict");
const test = require("node:test");
const Order = require("../models/Order");
const User = require("../models/User");
const ShopNotification = require("../models/ShopNotification");
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

const ids = {
    order: "507f1f77bcf86cd799439011",
    fulfillment: "507f1f77bcf86cd799439012",
    buyer: "507f1f77bcf86cd799439013",
    seller: "507f1f77bcf86cd799439014",
    admin: "507f1f77bcf86cd799439015"
};

const stubNotifications = () => {
    const originalBulkWrite = ShopNotification.bulkWrite;
    const originalUserFind = User.find;
    ShopNotification.bulkWrite = async () => ({});
    User.find = () => ({
        select() {
            return this;
        },
        lean: async () => []
    });
    return () => {
        ShopNotification.bulkWrite = originalBulkWrite;
        User.find = originalUserFind;
    };
};

const makeOrderQuery = value => ({
    select: async () => value
});

test("buyer return request is accepted for an eligible delivered shipment and blocks payout", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const restoreNotifications = stubNotifications();
    const settlement = {
        _id: ids.fulfillment,
        seller: ids.seller,
        deliveryStatus: "Delivered",
        deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        payoutStatus: "ready",
        deliveryDispute: { status: "none" },
        returnRequest: { status: "none" }
    };
    let updateFilter;
    let update;
    let options;
    Order.findOne = () => makeOrderQuery({ sellerSettlements: [settlement] });
    Order.updateOne = async (filter, nextUpdate, nextOptions) => {
        updateFilter = filter;
        update = nextUpdate;
        options = nextOptions;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.requestShipmentReturn(
            {
                params: { id: ids.order, fulfillmentId: ids.fulfillment },
                body: { reason: "The item arrived damaged and cannot be used." },
                user: { id: ids.buyer }
            },
            response
        );

        assert.equal(response.statusCode, 201);
        assert.equal(
            update.$set["sellerSettlements.$[settlement].returnRequest.status"],
            "requested"
        );
        assert.equal(
            updateFilter.sellerSettlements.$elemMatch.deliveryStatus,
            "Delivered"
        );
        assert.deepEqual(options.arrayFilters[0]["settlement.returnRequest.status"], {
            $in: ["none", "rejected", null]
        });
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        restoreNotifications();
    }
});

test("buyer cannot request a return more than 14 days after delivery", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    let updateCalled = false;
    Order.findOne = () => makeOrderQuery({
        sellerSettlements: [{
            _id: ids.fulfillment,
            deliveryStatus: "Delivered",
            deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            payoutStatus: "held",
            deliveryDispute: { status: "none" },
            returnRequest: { status: "none" }
        }]
    });
    Order.updateOne = async () => {
        updateCalled = true;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.requestShipmentReturn(
            {
                params: { id: ids.order, fulfillmentId: ids.fulfillment },
                body: { reason: "The item arrived damaged and cannot be used." },
                user: { id: ids.buyer }
            },
            response
        );

        assert.equal(response.statusCode, 409);
        assert.match(response.body.message, /within 14 days/i);
        assert.equal(updateCalled, false);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
    }
});

test("return tracking rejects non-HTTPS URLs before database writes", async () => {
    const originalUpdateOne = Order.updateOne;
    let updateCalled = false;
    Order.updateOne = async () => {
        updateCalled = true;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.submitReturnShipping(
            {
                params: { id: ids.order, fulfillmentId: ids.fulfillment },
                body: {
                    courierName: "Courier",
                    trackingNumber: "TRACK-1234",
                    trackingUrl: "http://courier.example/track"
                },
                user: { id: ids.buyer }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /HTTPS/i);
        assert.equal(updateCalled, false);
    } finally {
        Order.updateOne = originalUpdateOne;
    }
});

test("admin review requires an active request and records the decision", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const restoreNotifications = stubNotifications();
    let update;
    let filter;
    Order.findOne = () => makeOrderQuery({
        user: ids.buyer,
        sellerSettlements: [{
            _id: ids.fulfillment,
            seller: ids.seller,
            returnRequest: { status: "requested" }
        }]
    });
    Order.updateOne = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.reviewShipmentReturn(
            {
                params: { id: ids.order },
                body: {
                    fulfillmentId: ids.fulfillment,
                    decision: "approve",
                    adminNote: "Return approved; please submit courier tracking."
                },
                user: { id: ids.admin }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(
            filter.sellerSettlements.$elemMatch["returnRequest.status"],
            "requested"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].returnRequest.status"],
            "approved"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].returnRequest.reviewedBy"],
            ids.admin
        );
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        restoreNotifications();
    }
});

test("admin can confirm receipt only after the buyer has submitted return tracking", async () => {
    const originalUpdateOne = Order.updateOne;
    let filter;
    let update;
    Order.updateOne = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.confirmShipmentReturnReceived(
            {
                params: { id: ids.order },
                body: { fulfillmentId: ids.fulfillment },
                user: { id: ids.admin }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(
            filter.sellerSettlements.$elemMatch["returnRequest.status"],
            "shipped"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].returnRequest.status"],
            "received"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].returnRequest.receivedBy"],
            ids.admin
        );
    } finally {
        Order.updateOne = originalUpdateOne;
    }
});

test("admin records a shipment refund only after receipt and cancels that seller payout", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const restoreNotifications = stubNotifications();
    let updateCalls = 0;
    let refundUpdate;
    Order.findOne = () => makeOrderQuery({
        user: ids.buyer,
        sellerSettlements: [{
            _id: ids.fulfillment,
            seller: ids.seller,
            amount: 100,
            returnRequest: { status: "received" }
        }]
    });
    Order.updateOne = async (_filter, update) => {
        updateCalls += 1;
        if (updateCalls === 1) {
            refundUpdate = update;
            return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
    };

    try {
        const response = makeResponse();
        await orderController.recordShipmentReturnRefund(
            {
                params: { id: ids.order },
                body: {
                    fulfillmentId: ids.fulfillment,
                    refundMethod: "Manual transfer",
                    refundReference: "BANK-REF-001"
                },
                user: { id: ids.admin }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(updateCalls, 2);
        assert.equal(
            refundUpdate.$set["sellerSettlements.$[settlement].returnRequest.status"],
            "refunded"
        );
        assert.equal(
            refundUpdate.$set["sellerSettlements.$[settlement].payoutStatus"],
            "cancelled"
        );
        assert.equal(
            refundUpdate.$inc.refundedAmount,
            100
        );
        assert.equal("paymentStatus" in refundUpdate.$set, false);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        restoreNotifications();
    }
});
