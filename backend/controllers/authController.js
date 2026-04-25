const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);

    const options = {
        expires: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        ),
        httpOnly: true,
        sameSite: 'lax',
        secure: false
    };

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        token,
        user: {
            id: user._id,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            image: user.image
        }
    });
};

// @desc    Google OAuth Callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = (req, res) => {
    // req.user is set by passport after successful authentication
    if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    // Generate JWT and send it via cookie
    const token = generateToken(req.user._id);
    
    const options = {
        expires: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        ),
        httpOnly: true,
        sameSite: 'lax',
        secure: false
    };

    res.cookie('token', token, options);
    
    // Redirect to frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    res.status(200).json({
        success: true,
        data: req.user
    });
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
        sameSite: 'lax',
        secure: false
    });

    res.status(200).json({
        success: true,
        data: {}
    });
};

// @desc    Get all engineers
// @route   GET /api/users
// @access  Private (Manager only)
exports.getEngineers = async (req, res) => {
    try {
        const users = await User.find({ role: 'Engineer' }).select('_id displayName email');
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
