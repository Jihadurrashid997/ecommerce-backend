const mongoose = require("mongoose");

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

    isApproved:{
        type:Boolean,
        default:true
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

module.exports = mongoose.model("Product",productSchema);
