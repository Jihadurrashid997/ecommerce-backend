const express = require('express');
const cors = require('cors'); // 👈 ইমপোর্ট করা ঠিক আছে!
const dotenv = require('dotenv');
const fs = require('fs');
const connectDB = require('./config/db');

dotenv.config();
const app = express();

// Middleware
app.use(cors()); // 👈 এই লাইনটি যোগ করে দিলাম, যাতে CORS একটিভ হয়! 🎉
app.use(express.json());

// Ensure upload directory exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}
app.use('/uploads', express.static('uploads'));

// Connect Database
connectDB();

// API Endpoints Mapping
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/seller', require('./routes/sellerRoutes'));
app.use('/api/orders', require('./routes/orderRoutes')); // <-- এটার ভেতরেই কার্ট কাজ করবে!
app.use('/api/payment', require('./routes/paymentRoutes')); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server executing seamlessly on port ${PORT}`));