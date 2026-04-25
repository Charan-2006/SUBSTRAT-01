const AuditLog = require('../models/AuditLog');

/**
 * Log an action to the AuditLog collection
 * @param {Object} options
 * @param {ObjectId} options.userId - ID of the user performing the action
 * @param {String} options.userRole - Role of the user
 * @param {String} options.action - Action type (CREATE, ASSIGN, STATUS_UPDATE, APPROVE, REJECT)
 * @param {ObjectId} options.blockId - ID of the block being modified
 * @param {Any} options.previousValue - Value before the action (optional)
 * @param {Any} options.newValue - Value after the action (optional)
 * @param {String} options.message - Additional context message
 */
exports.logAction = async ({ userId, userRole, action, blockId, previousValue, newValue, message }) => {
    try {
        await AuditLog.create({
            userId,
            userRole,
            action,
            blockId,
            previousValue,
            newValue,
            message
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
};
