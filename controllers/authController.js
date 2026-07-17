const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // 👈 মঙ্গুজ ইমপোর্ট করলাম যাতে রিয়েল ObjectId জেনারেট করা যায়

// 📦 সাময়িক লোকাল ডাটাবেজ (সার্ভার চালু থাকা পর্যন্ত এটি ডেটা মনে রাখবে)
let mockUsers = [];

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // ১. ইমেইল অলরেডি আছে কি না চেক করা
        const userExists = mockUsers.find(u => u.email === email);
        if (userExists) {
            return res.status(400).json({ message: 'User already exists (Offline Mode)' });
        }

        // ২. পাসওয়ার্ড হ্যাশ করা (এটি নরমালি কাজ করবে)
        const hashedPassword = await bcrypt.hash(password, 10);

        // ৩. লোকাল বক্সে ইউজার সেভ করা (মঙ্গুজের রিয়েল ObjectId দিয়ে)
        const newUser = {
            _id: new mongoose.Types.ObjectId().toString(), // 👈 এইখানে এখন মঙ্গুজের আসল ২৪ অক্ষরের আইডি জেনারেট হবে!
            name,
            email,
            password: hashedPassword,
            role: role || 'user'
        };
        mockUsers.push(newUser);

        res.status(201).json({ 
            message: 'User registered successfully (Offline Mode)',
            user: { name, email, role: newUser.role }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ১. লোকাল বক্স থেকে ইউজার খুঁজে বের করা
        const user = mockUsers.find(u => u.email === email);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials (Offline Mode)' });
        }

        // ২. পাসওয়ার্ড মিলানো
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials (Offline Mode)' });
        }

        // ৩. টোকেন তৈরি করা
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            message: "Login successful!",
            token, 
            role: user.role 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};