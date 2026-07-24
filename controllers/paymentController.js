const Order = require('../models/Order');
// আপনার কার্ট মডেলের পাথ যদি আলাদা হয়, তবে সেই অনুযায়ী require করুন
// যেমন: const Cart = require('../models/Cart'); 

// ১. পেমেন্ট ইনিশিয়েট করার ফাংশন (লাইভ ও স্যান্ডবক্স মোড)
exports.initiatePayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        // ডাটাবেজ থেকে অর্ডার খুঁজে বের করা
        const order = await Order.findById(orderId).populate('user');
        if (!order) {
            return res.status(404).json({ message: 'Order not found!' });
        }

        // ইউনিক ট্রানজেকশন আইডি জেনারেট করা
        const tran_id = `TXN-${Date.now()}`;
        
        // ডাটাবেজে ট্রানজেকশন আইডি ট্র্যাক করে রাখা
        order.transactionId = tran_id;
        await order.save();

        // ডামি গেটওয়ে ইউআরএল (রেন্ডার লাইভ সার্ভার সহ)
        const dummyGatewayURL = `${process.env.BASE_URL || 'https://ecommerce-api-9wc9.onrender.com'}/api/payment/dummy-checkout/${tran_id}`;

        res.status(200).json({ url: dummyGatewayURL });

    } catch (error) {
        res.status(500).json({ message: 'Payment initiation failed', error: error.message });
    }
};

// ২. টেস্ট করার জন্য ডামি পেমেন্ট গেটওয়ে পেজ
exports.dummyCheckoutPage = async (req, res) => {
    const { tranId } = req.params;
    res.send(`
        <div style="text-align: center; margin-top: 50px; font-family: sans-serif; background: #f4f6f9; padding: 30px; border-radius: 8px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #ddd;">
            <h2>💻 Sandbox Payment Gateway</h2>
            <p>Transaction ID: <strong>${tranId}</strong></p>
            <p>স্যান্ডবক্স মোডে এই ডামি পেজটি দিয়ে পেমেন্ট টেস্ট করুন।</p>
            <br>
            <form action="/api/payment/success/${tranId}" method="POST" style="display:inline;">
                <button type="submit" style="padding: 12px 25px; background: #28a745; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; margin-right: 10px;">Success (পেমেন্ট করুন)</button>
            </form>
            <form action="/api/payment/fail/${tranId}" method="POST" style="display:inline;">
                <button type="submit" style="padding: 12px 25px; background: #dc3545; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; margin-right: 10px;">Fail (ব্যর্থ)</button>
            </form>
            <form action="/api/payment/cancel/${tranId}" method="POST" style="display:inline;">
                <button type="submit" style="padding: 12px 25px; background: #6c757d; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer;">Cancel (বাতিল)</button>
            </form>
        </div>
    `);
};

// ৩. পেমেন্ট সফল হলে যেখানে রিডাইরেক্ট হবে (এবং কার্ট ফাকা হবে)
exports.paymentSuccess = async (req, res) => {
    try {
        const { tranId } = req.params;

        // ট্রানজেকশন আইডি দিয়ে অর্ডার খুঁজে স্ট্যাটাস আপডেট করা
        const order = await Order.findOne({ transactionId: tranId });
        if (order) {
            order.status = 'Processing'; 
            order.paymentStatus = 'Paid'; // পেমেন্ট স্ট্যাটাস পেইড করে দেওয়া হলো
            await order.save();

            // 💡 বোনাস লজিক: পেমেন্ট সফল হলে ইউজারের কার্ট ক্লিয়ার করার ট্রাই করবে
            try {
                // উদাহরণ: await Cart.findOneAndDelete({ user: order.user });
            } catch (cartErr) {
                console.log("Cart clear failed or model not found, but payment is successful");
            }
        }

        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                <h1 style="color: green; font-size: 32px;">Payment Successful! 🎉</h1>
                <p style="font-size: 18px;">Transaction ID: <strong>${tranId}</strong></p>
                <p>Your order status updated to: <strong>Processing</strong></p>
                <br>
                <a href="http://localhost:3000" style="padding: 12px 25px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
            </div>
        `);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ৪. পেমেন্ট ফেইল করলে
exports.paymentFail = async (req, res) => {
    try {
        const { tranId } = req.params;
        const order = await Order.findOne({ transactionId: tranId });
        if (order) {
            order.status = 'Cancelled';
            order.paymentStatus = 'Failed';
            await order.save();
        }
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                <h1 style="color: red; font-size: 32px;">Payment Failed! ❌</h1>
                <p style="font-size: 18px;">Transaction ID: <strong>${tranId}</strong></p>
                <p>Transaction was cancelled or failed.</p>
                <br>
                <a href="http://localhost:3000" style="padding: 12px 25px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Try Again</a>
            </div>
        `);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ৫. পেমেন্ট ইউজার নিজে ক্যানসেল করলে
exports.paymentCancel = async (req, res) => {
    try {
        const { tranId } = req.params;
        const order = await Order.findOne({ transactionId: tranId });
        if (order) {
            order.status = 'Cancelled';
            order.paymentStatus = 'Cancelled';
            await order.save();
        }
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                <h1 style="color: #6c757d; font-size: 32px;">Payment Cancelled! ⚠️</h1>
                <p style="font-size: 18px;">Transaction ID: <strong>${tranId}</strong></p>
                <p>You have cancelled the payment process.</p>
                <br>
                <a href="http://localhost:3000" style="padding: 12px 25px; background: #6c757d; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Back to Cart</a>
            </div>
        `);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ৬. IPN (Instant Payment Notification) হ্যান্ডলার
exports.paymentIPN = async (req, res) => {
    try {
        const { tran_id, status } = req.body;
        const order = await Order.findOne({ transactionId: tran_id });
        
        if (order && status === 'VALID') {
            order.status = 'Processing';
            order.paymentStatus = 'Paid';
            await order.save();
        }
        res.status(200).json({ message: 'IPN Received Successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};