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
    }
}, { timestamps: true });

// Pre-save hook for effort estimation logic (async pattern - no callback needed)
BlockSchema.pre('save', function() {
    if (this.isModified('baseHours') || this.isModified('complexity')) {
        let factor = 1;
        switch (this.complexity) {
            case 'SIMPLE': factor = 1; break;
            case 'MEDIUM': factor = 1.5; break;
            case 'COMPLEX': factor = 2; break;
            case 'CRITICAL': factor = 3; break;
        }
        this.estimatedHours = this.baseHours * factor;
    }
});

// Method to dynamically calculate health
BlockSchema.methods.calculateHealth = function() {
    let status = 'HEALTHY';
    let reasons = [];

    // 1. Rejections
    if (this.rejectionCount >= 2) {
        status = 'CRITICAL';
        reasons.push(`${this.rejectionCount} rejections`);
    } else if (this.rejectionCount === 1) {
        if (status !== 'CRITICAL') status = 'RISK';
        reasons.push('1 rejection');
    }

    // 2. Inactivity (hours since last update)
    const lastUpdate = this.updatedAt || new Date();
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 48) {
        status = 'CRITICAL';
        reasons.push(`Inactive for >48h`);
    } else if (hoursSinceUpdate > 24) {
        if (status !== 'CRITICAL') status = 'RISK';
        reasons.push(`Inactive for >24h`);
    }

    // 3. Time vs Estimated
    // Time spent in hours since block was assigned or created
    const docCreatedAt = this.createdAt || new Date();
    const startTime = this.assignmentHistory.length > 0 ? this.assignmentHistory[this.assignmentHistory.length - 1].assignedAt : docCreatedAt;
    const timeSpent = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
    
    if (this.estimatedHours > 0 && this.status !== 'NOT_STARTED' && this.status !== 'COMPLETED') {
        const ratio = timeSpent / this.estimatedHours;
        if (ratio > 1.2) {
            status = 'CRITICAL';
            reasons.push(`Time spent (${timeSpent.toFixed(1)}h) is >120% of estimated (${this.estimatedHours}h)`);
        } else if (ratio >= 0.8) {
            if (status !== 'CRITICAL') status = 'RISK';
            reasons.push(`Time spent (${timeSpent.toFixed(1)}h) is approaching estimated (${this.estimatedHours}h)`);
        }
    }

    this.healthStatus = status;
    this.healthReasons = reasons;
};

module.exports = mongoose.model('Block', BlockSchema);
