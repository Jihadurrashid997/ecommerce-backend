const express=require("express");

const router=express.Router();

const auth=require("../middleware/auth");

const{

getOrders,

createOrder,

getMyOrders

}=require("../controllers/orderController");

router.get("/",auth(["admin"]),getOrders);

router.get("/my",auth(),getMyOrders);

router.post("/",auth(),createOrder);

module.exports=router;
