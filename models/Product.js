const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            required: true,
            maxlength: 80
        },
        sku: {
            type: String,
            trim: true,
            uppercase: true,
            required: true,
            maxlength: 64
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: "Variant stock must be a whole number."
            }
        },
        image: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ""
        }
    },
    { timestamps: true }
);

const productSchema = new mongoose.Schema(
{
    name:{
        type:String,
        required:true
    },

    description:{
        type:String,
        required:true
    },

    price:{
        type:Number,
        required:true,
        min:0
    },

    category:{
        type:String,
        required:true
    },

    image:{
        type:String,
        default:""
    },

    stock:{
        type:Number,
        default:1,
        min:0,
        validate: {
            validator: Number.isInteger,
            message: "Stock must be a whole number."
        }
    },

    variants: {
        type: [productVariantSchema],
        default: []
    },

    isApproved:{
        type:Boolean,
        default:true
    },

    approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved"
    },

    approvalReviewNote: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    },

    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }

},
{
    timestamps:true
}
);

productSchema.index(
    { seller: 1, "variants.sku": 1 },
    { unique: true, sparse: true }
);

module.exports = mongoose.model("Product",productSchema);
