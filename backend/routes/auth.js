const express = require('express');
const passport = require('passport');
const { googleCallback, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Auth with Google
// @route   GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// @desc    Google auth callback
// @route   GET /api/auth/google/callback
router.get(
    '/google/callback',
    (req, res, next) => {
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
        passport.authenticate('google', { failureRedirect: `${frontendURL}/login?error=auth_failed`, session: false })(req, res, next);
    },
    googleCallback
);

// @desc    Get current user
// @route   GET /api/auth/me
router.get('/me', protect, getMe);

// @desc    Logout user
// @route   GET /api/auth/logout
router.get('/logout', protect, logout);

module.exports = router;
