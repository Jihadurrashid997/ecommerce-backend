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

const ShipmentUpdateSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled"
            ],
            required: true
        },
        courierName: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        },
        trackingNumber: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },
        trackingUrl: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        source: {
            type: String,
            enum: ["manual", "provider"],
            default: "manual"
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
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
        courierName: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        },
        trackingNumber: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ""
        },
        trackingUrl: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        deliveryEvidence: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        deliveredAt: {
            type: Date,
            default: null
        },
        shipmentHistory: {
            type: [ShipmentUpdateSchema],
            default: []
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
                "approved",
                "paid",
                "cancelled"
            ],
            default: "awaiting_payment"
        },
        payoutApprovedAt: {
            type: Date,
            default: null
        },
        payoutApprovedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
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

const OrderStatusHistorySchema = new mongoose.Schema(
    {
        fromStatus: {
            type: String,
            default: ""
        },
        toStatus: {
            type: String,
            enum: [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled"
            ],
            required: true
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        actorRole: {
            type: String,
            enum: ["buyer", "seller", "admin", "system"],
            required: true
        },
        fulfillmentId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        },
        source: {
            type: String,
            enum: ["checkout", "buyer", "seller", "admin", "system"],
            required: true
        },
        occurredAt: {
            type: Date,
            default: Date.now,
            immutable: true
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

        checkoutIdempotencyKey: {
            type: String,
            maxlength: 128,
            select: false
        },

        checkoutRequestHash: {
            type: String,
            maxlength: 64,
            select: false
        },

        items: {
            type: [OrderItemSchema],
            required: true
        },

        sellerSettlements: {
            type: [SellerSettlementSchema],
            default: []
        },

        statusHistory: {
            type: [OrderStatusHistorySchema],
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

OrderSchema.index(
    { user: 1, checkoutIdempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            checkoutIdempotencyKey: { $type: "string" }
        }
    }
);

module.exports = mongoose.model(
    "Order",
    OrderSchema
);
