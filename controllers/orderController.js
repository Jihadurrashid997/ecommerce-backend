const Order=require("../models/Order");

// Get All Orders

exports.getOrders=async(req,res)=>{

try{

const orders=await Order.find()

.populate("customer","name email")

.populate("products.product","name price image");

res.json(orders);

}

catch(err){

res.status(500).json({

message:err.message

});

}

};

// Create Order

exports.createOrder=async(req,res)=>{

try{

const order=await Order.create({

customer:req.user.id,

products:req.body.products,

totalPrice:req.body.totalPrice,

shippingAddress:req.body.shippingAddress,

paymentMethod:req.body.paymentMethod

});

res.status(201).json(order);

}

catch(err){

res.status(500).json({

message:err.message

});

}

};

// Get My Orders

exports.getMyOrders=async(req,res)=>{

try{

const orders=await Order.find({

customer:req.user.id

})

.populate("products.product");

res.json(orders);

}

catch(err){

res.status(500).json({

message:err.message

});

}

};
