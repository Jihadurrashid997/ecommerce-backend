const User = require('../models/User'); // আপনার প্রজেক্টের ইউজার মডেল
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ১. রেজিস্ট্রেশন কন্ট্রোলার (ডাটাবেজে ডেটা সেভ হবে)
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // পাসওয়ার্ড কমপক্ষে ৮ ডিজিটের হতে হবে কি না চেক করা
        if (!password || password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long!' });
        }

        // ইমেইল অলরেডি ডাটাবেজে আছে কি না চেক করা
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email!' });
        }

        // পাসওয়ার্ড সিকিউর করার জন্য হ্যাশ করা
        const hashedPassword = await bcrypt.hash(password, 10);

        // নতুন ইউজার তৈরি করে মঙ্গোডিবি ডাটাবেজে সেভ করা
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'customer'
        });

        await newUser.save();

        res.status(201).json({ 
            message: 'Registration successful!',
            user: { name: newUser.name, email: newUser.email, role: newUser.role }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ২. লগইন কন্ট্রোলার (ডাটাবেজ থেকে চেক করবে)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ডাটাবেজ থেকে ইউজার খুঁজে বের করা (রেজিস্ট্রেশন করা না থাকলে এখানে ধরা পড়বে)
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Account not found! Please register first.' });
        }

        // পাসওয়ার্ড মিলিয়ে দেখা (bcrypt দিয়ে চেক করা)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password!' });
        }

        // JWT টোকেন তৈরি করা
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            message: "Login successful!",
            token, 
            role: user.role,
            user: { name: user.name, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
