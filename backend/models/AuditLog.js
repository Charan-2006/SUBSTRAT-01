const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    userRole: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: [true, 'Please provide an action type'],
        enum: ['CREATE', 'ASSIGN', 'REASSIGN', 'UNASSIGN', 'STATUS_UPDATE', 'APPROVE', 'REJECT', 'ESCALATE', 'DELETE', 'UPDATE']
    },
    blockId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Block',
        // Optional for general requests/actions not tied to a specific block
    },
    previousValue: {
        type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
        type: mongoose.Schema.Types.Mixed,
    },
    message: {
        type: String,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
