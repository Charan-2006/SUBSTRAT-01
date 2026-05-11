const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            'ASSIGNMENT', 'REASSIGNMENT', 'STAGE_CHANGE', 'REVIEW_REQUEST', 
            'APPROVAL', 'REJECTION', 'ESCALATION', 'SLA_VIOLATION', 
            'BOTTLENECK', 'DEPENDENCY_RESOLVED', 'OPTIMIZATION', 'SYSTEM'
        ],
        default: 'SYSTEM'
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    actionUrl: {
        type: String
    },
    blockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Block'
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
