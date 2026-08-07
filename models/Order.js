const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(

{

    customer:{

        type:mongoose.Schema.Types.ObjectId,

        ref:"User",

        required:true

    },

    products:[

        {

            product:{

                type:mongoose.Schema.Types.ObjectId,

                ref:"Product",

                required:true

            },

            quantity:{

                type:Number,

                default:1

            }

        }

    ],

    totalPrice:{

        type:Number,

        required:true

    },

    paymentMethod:{

        type:String,

        default:"SSLCommerz"

    },

    paymentStatus:{

        type:String,

        enum:["Pending","Paid","Failed"],

        default:"Pending"

    },

    orderStatus:{

        type:String,

        enum:[
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ],

        default:"Pending"

    },

    shippingAddress:{

        type:String,

        required:true

    }

},

{

    timestamps:true

}

);

module.exports=mongoose.model("Order",orderSchema);
