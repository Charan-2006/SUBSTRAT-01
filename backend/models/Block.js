const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a block name'],
        trim: true,
    },
    type: {
        type: String,
    },
    description: {
        type: String,
    },
    techNode: {
        type: String,
    },
    complexity: {
        type: String,
        enum: ['SIMPLE', 'MEDIUM', 'COMPLEX', 'CRITICAL'],
        default: 'SIMPLE'
    },
    baseHours: {
        type: Number,
        default: 0
    },
    estimatedHours: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'],
        default: 'NOT_STARTED'
    },
    assignedEngineer: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    rejectionReason: {
        type: String,
    },
    notes: {
        type: String,
    },
    assignmentHistory: [
        {
            engineer: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            assignedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    healthStatus: {
        type: String,
        enum: ['HEALTHY', 'RISK', 'CRITICAL'],
        default: 'HEALTHY'
    },
    healthReasons: {
        type: [String],
        default: []
    },
    rejectionCount: {
        type: Number,
        default: 0
    },
    stageStartTime: {
        type: Date,
        default: Date.now
    },
    stageHistory: [
        {
            stage: String,
            startTime: Date,
            endTime: Date,
            durationHours: Number
        }
    ],
    totalTimeSpent: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const workflowService = require('../services/workflowService');

// Pre-save hook for effort estimation logic
BlockSchema.pre('save', async function() {
    if (this.isModified('complexity') || this.isModified('techNode')) {
        this.estimatedHours = workflowService.calculateEstimation(this.complexity, this.techNode);
    }
    
    // Auto-calculate health before saving
    const health = workflowService.calculateHealth(this);
    this.healthStatus = health.status;
    this.healthReasons = health.reasons;
});

// Method to dynamically calculate health (for API usage)
BlockSchema.methods.calculateHealth = function() {
    const health = workflowService.calculateHealth(this);
    this.healthStatus = health.status;
    this.healthReasons = health.reasons;
};

module.exports = mongoose.model('Block', BlockSchema);
