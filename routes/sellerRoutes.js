const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
// ১. সব ফাংশন একসাথে ওপরে ইমপোর্ট করে নিলাম
const { 
    uploadProduct, 
    getProducts, 
    getProductById, 
    updateProduct, 
    deleteProduct 
} = require('../controllers/sellerController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ২. প্রোডাক্ট আপলোড রাউট (শুধু সেলারদের জন্য)
router.post('/upload-product', auth(['seller']), upload.array('images', 20), uploadProduct);

// ৩. সব প্রোডাক্ট দেখার রাউট (সবাই দেখতে পারবে)
router.get('/all-products', getProducts);

// ৪. নির্দিষ্ট প্রোডাক্টের আইডি দিয়ে ডিটেইলস দেখার রাউট
router.get('/product/:id', getProductById);

// ৫. প্রোডাক্ট আপডেট করার রাউট (শুধু ওই সেলারের জন্য)
router.put('/product/:id', auth(['seller']), upload.array('images', 20), updateProduct);

// ৬. প্রোডাক্ট ডিলিট করার রাউট (শুধু ওই সেলারের জন্য)
router.delete('/product/:id', auth(['seller']), deleteProduct);

// module.exports সবসময় ফাইলের একদম শেষ লাইনে থাকবে
module.exports = router;