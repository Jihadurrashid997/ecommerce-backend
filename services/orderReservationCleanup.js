const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { notifyShopUsers } = require("./shopNotifications");

const RESERVATION_MINUTES = 30;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 50;

const getExpiredOrderFilter = now => ({
    status: { $ne: "Cancelled" },
    paymentStatus: { $in: ["pending", "failed", "cancelled"] },
    reservationReleasedAt: null,
    $or: [
        { reservationExpiresAt: { $lte: now } },
        {
            reservationExpiresAt: { $exists: false },
            createdAt: { $lte: new Date(now.getTime() - RESERVATION_MINUTES * 60 * 1000) }
        }
    ]
});

const expireUnpaidReservations = async ({ now = new Date() } = {}) => {
    let expiredCount = 0;

    while (expiredCount < BATCH_SIZE) {
        const session = await mongoose.startSession();
        let expiredOrder;

        try {
            await session.withTransaction(async () => {
                expiredOrder = await Order.findOneAndUpdate(
                    getExpiredOrderFilter(now),
                    {
                        $set: {
                            status: "Cancelled",
                            paymentStatus: "cancelled",
                            reservationReleasedAt: now,
                            "sellerSettlements.$[settlement].deliveryStatus": "Cancelled",
                            "sellerSettlements.$[settlement].payoutStatus": "cancelled"
                        },
                        $push: {
                            statusHistory: {
                                fromStatus: "Pending",
                                toStatus: "Cancelled",
                                actor: null,
                                actorRole: "system",
                                note: "Unpaid order reservation expired.",
                                source: "system",
                                occurredAt: now
                            }
                        }
                    },
                    {
                        new: true,
                        session,
                        sort: { reservationExpiresAt: 1, createdAt: 1 },
                        arrayFilters: [{
                            "settlement.payoutStatus": { $ne: "paid" }
                        }]
                    }
                );

                if (!expiredOrder) return;

                for (const item of expiredOrder.items) {
                    if (item.stockReserved !== false) {
                        await Product.updateOne(
                            { _id: item.product },
                            { $inc: { stock: item.quantity } },
                            { session }
                        );
                    }
                }
            });
        } finally {
            await session.endSession();
        }

        if (!expiredOrder) break;

        expiredCount += 1;
        await notifyShopUsers({
            recipients: [expiredOrder.user],
            eventKey: `${expiredOrder._id}:reservation-expired`,
            type: "order_cancelled",
            title: "Unpaid Shop order expired",
            message: `Order #${String(expiredOrder._id).slice(-8)} expired after 30 minutes without verified payment; reserved stock was released. / ৩০ মিনিটের মধ্যে পেমেন্ট নিশ্চিত না হওয়ায় অর্ডারটির মেয়াদ শেষ হয়েছে এবং স্টক ছেড়ে দেওয়া হয়েছে।`,
            href: "/shop/orders",
            orderId: expiredOrder._id
        });
    }

    return expiredCount;
};

const startOrderReservationCleanup = () => {
    const cleanup = () => {
        void expireUnpaidReservations().catch(error => {
            console.error("Scheduled Shop reservation cleanup error:", error);
        });
    };

    cleanup();
    const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
    timer.unref();
    return timer;
};

module.exports = {
    BATCH_SIZE,
    RESERVATION_MINUTES,
    expireUnpaidReservations,
    getExpiredOrderFilter,
    startOrderReservationCleanup
};
