const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
    type: {
        type: String,
        required: [true, 'Please add a request type'],
        enum: ['Reassignment', 'Escalation', 'Resource Request', 'Dependency Unlock', 'Load Balancing', 'General'],
        default: 'General'
    },
    title: {
        type: String,
        trim: true,
    },
    reason: {
        type: String,
        required: [true, 'Please provide a reason/justification'],
    },
    description: {
        type: String,
        trim: true,
    },
    blockId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Block'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        default: 'MEDIUM'
    },
    stage: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'],
        default: 'NOT_STARTED'
    },
    requestedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    suggestedAssignee: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    dueDate: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    }
}, { timestamps: true });

module.exports = mongoose.model('Request', RequestSchema);
