const express = require('express');
const router = express.Router();
const {
    getRequests,
    createRequest,
    updateRequestStatus
} = require('../controllers/requestController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(getRequests)
    .post(createRequest);

// Using inline authorize for Manager only on status update
const isManager = (req, res, next) => {
    if (req.user && req.user.role === 'Manager') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Not authorized to perform this action' });
    }
};

router.route('/:id/status')
    .put(isManager, updateRequestStatus);

module.exports = router;
