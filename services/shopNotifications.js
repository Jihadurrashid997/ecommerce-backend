const ShopNotification = require("../models/ShopNotification");
const User = require("../models/User");

const preferenceForType = type => {
    if ([
        "order_placed",
        "payment_received",
        "payment_failed",
        "payment_cancelled",
        "order_cancelled",
        "shipment_update",
        "buyer_confirmation",
        "seller_confirmation"
    ].includes(type)) {
        return "orders";
    }

    if ([
        "payout_ready",
        "payout_processed",
        "refund_submitted",
        "refund_decision",
        "refund_completed"
    ].includes(type)) {
        return "refundsAndPayouts";
    }

    return "products";
};

const notifyShopUsers = async ({
    recipients,
    eventKey,
    type,
    title,
    message,
    href,
    orderId = null,
    productId = null
}) => {
    const uniqueRecipients = [
        ...new Set((recipients || [])
            .filter(Boolean)
            .map(recipient => String(recipient)))
    ];

    if (!uniqueRecipients.length) {
        return;
    }

    const createdAt = new Date();
    try {
        const preference = preferenceForType(type);
        const eligibleUsers = await User.find({
            _id: { $in: uniqueRecipients },
            [`shopNotificationPreferences.${preference}`]: { $ne: false }
        }).select("_id").lean();

        if (!eligibleUsers.length) {
            return;
        }

        await ShopNotification.bulkWrite(
            eligibleUsers.map(user => ({
                updateOne: {
                    filter: { recipient: user._id, eventKey },
                    update: {
                        $setOnInsert: {
                            recipient: user._id,
                            eventKey,
                            type,
                            title,
                            message,
                            href,
                            orderId,
                            productId,
                            readAt: null,
                            createdAt
                        }
                    },
                    upsert: true
                }
            })),
            { ordered: false }
        );
    } catch (error) {
        console.error("SHOP NOTIFICATION WRITE ERROR:", error);
    }
};

const notifyShopAdmins = async notification => {
    try {
        const admins = await User.find({ role: "admin" })
            .select("_id")
            .lean();
        await notifyShopUsers({
            ...notification,
            recipients: admins.map(admin => admin._id)
        });
    } catch (error) {
        console.error("SHOP ADMIN NOTIFICATION LOOKUP ERROR:", error);
    }
};

module.exports = {
    notifyShopUsers,
    notifyShopAdmins
};
