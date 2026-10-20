const ShopNotification = require("../models/ShopNotification");
const User = require("../models/User");

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
        await ShopNotification.bulkWrite(
            uniqueRecipients.map(recipient => ({
                updateOne: {
                    filter: { recipient, eventKey },
                    update: {
                        $setOnInsert: {
                            recipient,
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
