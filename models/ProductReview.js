const mongoose = require("mongoose");

const productReviewSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true
        },
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true,
            validate: Number.isInteger
        },
        comment: {
            type: String,
            trim: true,
            minlength: 3,
            maxlength: 1000,
            required: true
        }
    },
    { timestamps: true }
);

productReviewSchema.index(
    { product: 1, order: 1, buyer: 1 },
    { unique: true }
);
productReviewSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("ProductReview", productReviewSchema);
