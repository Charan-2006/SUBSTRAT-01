const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 * @param {Object} params - { userId, message, type, blockId }
 */
const createNotification = async ({ userId, message, type, blockId }) => {
    try {
        if (!userId) return;
        
        await Notification.create({
            userId,
            message,
            type,
            blockId
        });
    } catch (err) {
        console.error('Error creating notification:', err);
    }
};

module.exports = { createNotification };
