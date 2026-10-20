const mongoose = require("mongoose");

const ShopNotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        eventKey: {
            type: String,
            required: true,
            maxlength: 180
        },
        type: {
            type: String,
            enum: [
                "order_placed",
                "payment_received",
                "payment_failed",
                "payment_cancelled",
                "order_cancelled",
                "shipment_update",
                "buyer_confirmation",
                "seller_confirmation",
                "payout_ready",
                "payout_processed",
                "refund_submitted",
                "refund_decision",
                "refund_completed",
                "product_review",
                "product_approved"
            ],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500
        },
        href: {
            type: String,
            required: true,
            match: /^\//
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            default: null
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

ShopNotificationSchema.index(
    { recipient: 1, eventKey: 1 },
    { unique: true }
);
ShopNotificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model("ShopNotification", ShopNotificationSchema);
