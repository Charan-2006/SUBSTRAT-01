const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, proceed) => {
    let token;

    // Check for token in cookies or Authorization header
    if (req.cookies.token) {
        token = req.cookies.token;
    } else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id);
        
        if (!req.user) {
             return res.status(401).json({ success: false, message: 'User not found' });
        }

        proceed();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
};
