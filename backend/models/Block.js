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
    estimatedArea: {
        type: Number,
        default: 0
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
        enum: ['HEALTHY', 'WARNING', 'CRITICAL', 'BOTTLENECK'],
        default: 'HEALTHY'
    },
    healthScore: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    healthReasons: {
        type: [String],
        default: []
    },
    rejectionCount: {
        type: Number,
        default: 0
    },
    rejectionHistory: [
        {
            stage: String,
            timestamp: { type: Date, default: Date.now },
            engineer: { type: mongoose.Schema.ObjectId, ref: 'User' },
            reason: String,
            severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' }
        }
    ],
    approvalHistory: [
        {
            stage: String,
            timestamp: { type: Date, default: Date.now },
            reviewer: { type: mongoose.Schema.ObjectId, ref: 'User' },
            comments: String
        }
    ],
    stabilityScore: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    confidenceScore: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    pressureScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    propagationRisk: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
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
    },
    dependencies: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Block'
    }],
    escalated: {
        type: Boolean,
        default: false
    },
    escalationState: {
        type: String,
        enum: ['NORMAL', 'ESCALATED', 'CRITICAL_ESCALATED'],
        default: 'NORMAL'
    },
    lastEscalatedAt: {
        type: Date
    },
    expectedDurationHours: {
        type: Number,
        default: 0
    },
    actualDurationHours: {
        type: Number,
        default: 0
    },
    blockedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'Block'
    },
    bottleneckImpact: {
        type: Number,
        default: 0
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    isExecuting: {
        type: Boolean,
        default: false
    },
    isReleased: {
        type: Boolean,
        default: false
    },
    executionState: {
        type: String,
        enum: ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'ESCALATED', 'COMPLETE', 'RELEASED'],
        default: 'NOT_STARTED'
    },
    telemetry: {
        rejectionPressure: { type: Number, default: 0 },
        stagnationIndex: { type: Number, default: 0 },
        priorityRank: { type: Number, default: 0 },
        propagationImpact: { type: Number, default: 0 }
    }
}, { timestamps: true });

const workflowService = require('../services/workflowService');

// Pre-save hook for effort estimation logic
BlockSchema.pre('save', async function() {
    if ((this.isModified('complexity') || this.isModified('baseHours')) && !this.isModified('estimatedHours')) {
        this.estimatedHours = workflowService.calculateEstimation(this.baseHours, this.complexity);
    }
    
    // Auto-calculate health before saving
    const health = workflowService.calculateHealth(this);
    this.healthStatus = health.status;
    this.healthScore = health.score;
    this.healthReasons = health.reasons;
    this.telemetry = health.telemetry;
});

// Method to dynamically calculate health (for API usage)
BlockSchema.methods.calculateHealth = function() {
    const health = workflowService.calculateHealth(this);
    this.healthStatus = health.status;
    this.healthScore = health.score;
    this.healthReasons = health.reasons;
    this.telemetry = health.telemetry;
    return this;
};

module.exports = mongoose.model('Block', BlockSchema);
