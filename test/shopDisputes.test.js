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

const validIds = {
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

test("buyer can atomically open a delivery dispute within 14 days and payout remains blocked", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const restoreNotifications = stubNotifications();
    const deliveredAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    let lookupFilter;
    let updateFilter;
    let update;
    let options;
    Order.findOne = filter => {
        lookupFilter = filter;
        return {
            select: async () => ({
                sellerSettlements: [{
                    _id: validIds.fulfillment,
                    seller: validIds.seller,
                    deliveryStatus: "Delivered",
                    deliveredAt,
                    payoutStatus: "ready",
                    deliveryDispute: { status: "none" }
                }]
            })
        };
    };
    Order.updateOne = async (filter, nextUpdate, nextOptions) => {
        updateFilter = filter;
        update = nextUpdate;
        options = nextOptions;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.openDeliveryDispute(
            {
                params: {
                    id: validIds.order,
                    fulfillmentId: validIds.fulfillment
                },
                body: { reason: "The package arrived damaged and one item is missing." },
                user: { id: validIds.buyer }
            },
            response
        );

        assert.equal(lookupFilter.user, validIds.buyer);
        assert.equal(lookupFilter.paymentStatus, "paid");
        assert.deepEqual(
            lookupFilter.sellerSettlements.$elemMatch.payoutStatus,
            { $in: ["held", "ready"] }
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].deliveryDispute.status"],
            "open"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].deliveryDispute.openedBy"],
            validIds.buyer
        );
        assert.equal(
            updateFilter.sellerSettlements.$elemMatch.deliveryStatus,
            "Delivered"
        );
        assert.deepEqual(options.arrayFilters[0]["settlement.payoutStatus"], {
            $in: ["held", "ready"]
        });
        assert.equal(response.statusCode, 201);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        restoreNotifications();
    }
});

test("buyer cannot open a delivery dispute more than 14 days after delivery", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    let updateCalled = false;
    Order.findOne = () => ({
        select: async () => ({
            sellerSettlements: [{
                _id: validIds.fulfillment,
                seller: validIds.seller,
                deliveryStatus: "Delivered",
                deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
                payoutStatus: "held",
                deliveryDispute: { status: "none" }
            }]
        })
    });
    Order.updateOne = async () => {
        updateCalled = true;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.openDeliveryDispute(
            {
                params: {
                    id: validIds.order,
                    fulfillmentId: validIds.fulfillment
                },
                body: { reason: "The package arrived damaged." },
                user: { id: validIds.buyer }
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

test("seller dispute reply is scoped to that seller and saved once", async () => {
    const originalUpdateOne = Order.updateOne;
    const originalFindById = Order.findById;
    const restoreNotifications = stubNotifications();
    let filter;
    let update;
    Order.findById = () => ({
        select: async () => ({ user: validIds.buyer })
    });
    Order.updateOne = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.respondToDeliveryDispute(
            {
                params: {
                    id: validIds.order,
                    fulfillmentId: validIds.fulfillment
                },
                body: { sellerReply: "I am contacting the courier and will review the photos." },
                user: { id: validIds.seller }
            },
            response
        );

        assert.equal(filter.sellerSettlements.$elemMatch.seller, validIds.seller);
        assert.equal(
            filter.sellerSettlements.$elemMatch["deliveryDispute.status"],
            "open"
        );
        assert.equal(
            update.$set["sellerSettlements.$[settlement].deliveryDispute.sellerReply"],
            "I am contacting the courier and will review the photos."
        );
        assert.equal(
            filter.sellerSettlements.$elemMatch["deliveryDispute.sellerReplyAt"],
            null
        );
        assert.equal(response.statusCode, 200);
    } finally {
        Order.updateOne = originalUpdateOne;
        Order.findById = originalFindById;
        restoreNotifications();
    }
});

test("admin can refer a delivery dispute to manual full-order refund review without issuing a refund", async () => {
    const originalFindOne = Order.findOne;
    const originalUpdateOne = Order.updateOne;
    const restoreNotifications = stubNotifications();
    let filter;
    let update;
    const order = {
        user: validIds.buyer,
        refundRequest: { status: "none" },
        sellerSettlements: [{
            _id: validIds.fulfillment,
            seller: validIds.seller,
            payoutStatus: "ready",
            deliveryDispute: {
                status: "open",
                reason: "The delivered package was missing a product."
            }
        }]
    };
    Order.findOne = () => ({
        select: async () => order
    });
    Order.updateOne = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { modifiedCount: 1 };
    };

    try {
        const response = makeResponse();
        await orderController.resolveDeliveryDispute(
            {
                params: { id: validIds.order },
                body: {
                    fulfillmentId: validIds.fulfillment,
                    resolution: "refer_to_refund",
                    resolutionNote: "Route the full order to manual refund review."
                },
                user: { id: validIds.admin }
            },
            response
        );

        assert.equal(
            update.$set["sellerSettlements.$[settlement].deliveryDispute.status"],
            "referred_to_refund"
        );
        assert.equal(update.$set["refundRequest.status"], "requested");
        assert.match(update.$set["refundRequest.reason"], /missing a product/);
        assert.equal("paymentStatus" in (update.$set || {}), false);
        assert.equal(
            filter["refundRequest.status"].$nin.includes("requested"),
            true
        );
        assert.equal(response.statusCode, 200);
        assert.match(response.body.message, /no refund was issued/i);
    } finally {
        Order.findOne = originalFindOne;
        Order.updateOne = originalUpdateOne;
        restoreNotifications();
    }
});

test("invalid delivery dispute details are rejected before database writes", async () => {
    const originalFindOne = Order.findOne;
    let databaseCalled = false;
    Order.findOne = () => {
        databaseCalled = true;
        throw new Error("Invalid dispute must not query the database.");
    };

    try {
        const response = makeResponse();
        await orderController.openDeliveryDispute(
            {
                params: {
                    id: validIds.order,
                    fulfillmentId: validIds.fulfillment
                },
                body: { reason: "Bad" },
                user: { id: validIds.buyer }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(databaseCalled, false);
    } finally {
        Order.findOne = originalFindOne;
    }
});
