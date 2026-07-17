const express = require('express');
const cors = require('cors'); 
const dotenv = require('dotenv');
const fs = require('fs');
const connectDB = require('./config/db');

dotenv.config();
const app = express();

// Middleware
app.use(cors()); 
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
app.use('/api/orders', require('./routes/orderRoutes')); 
app.use('/api/payment', require('./routes/paymentRoutes')); 
app.use('/api/products', require('./routes/productRoutes')); // 👈 নতুন রুটটি এখানে যোগ করা হলো!

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server executing seamlessly on port ${PORT}`));

app.get('/', (req, res) => {
    res.send('Ecommerce Backend is running perfectly! 🚀');
});