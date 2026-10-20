const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        name: {
            type: String,
            required: true
        },

        price: {
            type: Number,
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        image: {
            type: String,
            default: ""
        }
    },
    {
        _id: false
    }
);

const SellerSettlementSchema = new mongoose.Schema(
    {
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        deliveryStatus: {
            type: String,
            enum: [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled"
            ],
            default: "Pending"
        },
        receiptConfirmedAt: {
            type: Date,
            default: null
        },
        sellerConfirmedAt: {
            type: Date,
            default: null
        },
        sellerPayoutMethod: {
            type: String,
            trim: true,
            maxlength: 40,
            default: ""
        },
        sellerPayoutAccount: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },
        payoutStatus: {
            type: String,
            enum: [
                "awaiting_payment",
                "held",
                "ready",
                "paid",
                "cancelled"
            ],
            default: "awaiting_payment"
        },
        payoutMethod: {
            type: String,
            trim: true,
            maxlength: 40,
            default: ""
        },
        payoutReference: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },
        payoutPaidAt: {
            type: Date,
            default: null
        },
        payoutPaidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

const RefundRequestSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ["none", "requested", "rejected", "refunded"],
            default: "none"
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },
        requestedAt: {
            type: Date,
            default: null
        },
        adminNote: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        refundMethod: {
            type: String,
            trim: true,
            maxlength: 40,
            default: ""
        },
        refundReference: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },
        refundedAt: {
            type: Date,
            default: null
        }
    },
    {
        _id: false
    }
);

const OrderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        items: {
            type: [OrderItemSchema],
            required: true
        },

        sellerSettlements: {
            type: [SellerSettlementSchema],
            default: []
        },

        refundRequest: {
            type: RefundRequestSchema,
            default: () => ({})
        },

        totalPrice: {
            type: Number,
            required: true,
            min: 0
        },

        shippingAddress: {
            name: String,
            phone: String,
            address: String,
            city: String,
            postalCode: String
        },

        paymentMethod: {
            type: String,
            enum: [
                "cod",
                "sslcommerz",
                "stripe",
                "online"
            ],
            default: "cod"
        },

        paymentStatus: {
            type: String,
            enum: [
                "pending",
                "paid",
                "refunded",
                "failed",
                "cancelled"
            ],
            default: "pending"
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled"
            ],
            default: "Pending"
        },

        transactionId: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Order",
    OrderSchema
);
