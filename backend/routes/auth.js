const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        user = new User({
            username, 
            email,
            password 
        });

        await user.save();

        const tokenPayload = { 
            userId: user._id, 
            username: user.username, 
            email: user.email,
            role: user.role
        };
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'YOUR_FALLBACK_SECRET_KEY_HERE',
            { expiresIn: '1h' }
        );

        res.status(201).json({ 
            message: 'User registered successfully',
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                email: user.email,
                role: user.role
            } 
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            let errors = {};
            for (field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: 'Validation Failed', errors });
        }
        res.status(500).json({ message: 'Server error during registration. Please try again later.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const tokenPayload = { 
            userId: user._id, 
            username: user.username, 
            email: user.email,
            role: user.role
        };
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'YOUR_FALLBACK_SECRET_KEY_HERE',
            { expiresIn: '1h' }
        );

        res.json({ 
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login. Please try again later.' });
    }
});

module.exports = router; 