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
        required:true
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
        default:1
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
