const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ShopNotification = require("../models/ShopNotification");
const User = require("../models/User");
const {
    expireUnpaidReservations,
    getExpiredOrderFilter,
    RESERVATION_MINUTES
} = require("../services/orderReservationCleanup");

test("unpaid order cleanup atomically cancels expired reservations and restores finite stock", async () => {
    const originals = {
        startSession: mongoose.startSession,
        findOneAndUpdate: Order.findOneAndUpdate,
        updateOne: Product.updateOne,
        bulkWrite: ShopNotification.bulkWrite,
        find: User.find
    };
    const now = new Date("2026-10-22T14:00:00.000Z");
    const order = {
        _id: "507f1f77bcf86cd799439011",
        user: "507f1f77bcf86cd799439012",
        status: "Pending",
        paymentStatus: "cancelled",
        items: [
            {
                product: "507f1f77bcf86cd799439013",
                quantity: 3,
                stockReserved: true
            },
            {
                product: "507f1f77bcf86cd799439014",
                quantity: 2,
                stockReserved: false
            }
        ]
    };
    const stockUpdates = [];
    const notificationOperations = [];
    let updateFilter;
    let update;
    let options;
    let ended = false;
    let reservationClaimed = false;
    mongoose.startSession = async () => ({
        withTransaction: async callback => callback(),
        endSession: async () => { ended = true; }
    });
    Order.findOneAndUpdate = async (filter, nextUpdate, nextOptions) => {
        updateFilter = filter;
        update = nextUpdate;
        options = nextOptions;
        if (reservationClaimed) return null;
        reservationClaimed = true;
        return order;
    };
    Product.updateOne = async (filter, stockUpdate, updateOptions) => {
        stockUpdates.push({ filter, stockUpdate, updateOptions });
    };
    User.find = () => ({
        select() {
            return this;
        },
        lean: async () => [{ _id: order.user }]
    });
    ShopNotification.bulkWrite = async operations => {
        notificationOperations.push(...operations);
    };

    try {
        assert.equal(await expireUnpaidReservations({ now }), 1);
        assert.equal(updateFilter.status.$ne, "Cancelled");
        assert.deepEqual(updateFilter.paymentStatus.$in, [
            "pending",
            "failed",
            "cancelled"
        ]);
        assert.equal(update.$set.reservationReleasedAt, now);
        assert.equal(update.$set.status, "Cancelled");
        assert.equal(update.$set.paymentStatus, "cancelled");
        assert.equal(update.$push.statusHistory.actorRole, "system");
        assert.equal(update.$push.statusHistory.actor, null);
        assert.equal(options.session !== undefined, true);
        assert.equal(stockUpdates.length, 1);
        assert.deepEqual(stockUpdates[0].filter, {
            _id: "507f1f77bcf86cd799439013"
        });
        assert.deepEqual(stockUpdates[0].stockUpdate, {
            $inc: { stock: 3 }
        });
        assert.ok(stockUpdates[0].updateOptions.session);
        assert.equal(ended, true);
        assert.equal(notificationOperations.length, 1);
        assert.equal(
            notificationOperations[0].updateOne.filter.eventKey,
            `${order._id}:reservation-expired`
        );
    } finally {
        mongoose.startSession = originals.startSession;
        Order.findOneAndUpdate = originals.findOneAndUpdate;
        Product.updateOne = originals.updateOne;
        ShopNotification.bulkWrite = originals.bulkWrite;
        User.find = originals.find;
    }
});

test("expired reservation selector includes legacy unpaid orders using the 30-minute cutoff", () => {
    const now = new Date("2026-10-22T14:00:00.000Z");
    const filter = getExpiredOrderFilter(now);

    assert.equal(RESERVATION_MINUTES, 30);
    assert.deepEqual(filter.$or[0], {
        reservationExpiresAt: { $lte: now }
    });
    assert.deepEqual(filter.$or[1], {
        reservationExpiresAt: { $exists: false },
        createdAt: { $lte: new Date("2026-10-22T13:30:00.000Z") }
    });
});

test("unpaid order cleanup leaves stock untouched when no reservation is eligible", async () => {
    const originalStartSession = mongoose.startSession;
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    const originalUpdateOne = Product.updateOne;
    let stockUpdateCalled = false;
    let sessionEnded = false;
    mongoose.startSession = async () => ({
        withTransaction: async callback => callback(),
        endSession: async () => { sessionEnded = true; }
    });
    Order.findOneAndUpdate = async () => null;
    Product.updateOne = async () => { stockUpdateCalled = true; };

    try {
        assert.equal(await expireUnpaidReservations(), 0);
        assert.equal(stockUpdateCalled, false);
        assert.equal(sessionEnded, true);
    } finally {
        mongoose.startSession = originalStartSession;
        Order.findOneAndUpdate = originalFindOneAndUpdate;
        Product.updateOne = originalUpdateOne;
    }
});
