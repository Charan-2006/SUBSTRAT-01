const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// @desc    Get user notifications
// @route   GET /api/notifications
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('blockId', 'name');
        
        res.json({ success: true, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
router.patch('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
router.patch('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, read: false },
            { read: true }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Check for inactive blocks and notify manager
// @route   POST /api/notifications/check-inactivity
router.post('/check-inactivity', protect, async (req, res) => {
    if (req.user.role !== 'Manager') return res.status(403).json({ success: false });
    
    try {
        const Block = require('../models/Block');
        const { createNotification } = require('../utils/notifier');
        
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        
        const inactiveBlocks = await Block.find({
            status: { $in: ['IN_PROGRESS', 'DRC', 'LVS'] },
            updatedAt: { $lt: fortyEightHoursAgo }
        });

        for (const block of inactiveBlocks) {
            // Check if notification already exists recently to avoid spam
            const existing = await Notification.findOne({
                userId: req.user._id,
                blockId: block._id,
                type: 'INACTIVITY',
                createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            if (!existing) {
                await createNotification({
                    userId: req.user._id,
                    message: `Stalled Block: ${block.name} hasn't been updated in 48h.`,
                    type: 'INACTIVITY',
                    blockId: block._id
                });
            }
        }

        res.json({ success: true, count: inactiveBlocks.length });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
