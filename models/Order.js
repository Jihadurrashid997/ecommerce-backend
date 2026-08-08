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
