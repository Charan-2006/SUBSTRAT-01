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
        enum: ['CREATE', 'ASSIGN', 'REASSIGN', 'UNASSIGN', 'STATUS_UPDATE', 'APPROVE', 'REJECT', 'ESCALATE', 'DELETE']
    },
    blockId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Block',
        required: true
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
