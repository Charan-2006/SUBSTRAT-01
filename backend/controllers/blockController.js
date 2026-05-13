const Block = require('../models/Block');
const { logAction } = require('../utils/logger');
const { createNotification } = require('../utils/notifier');
const User = require('../models/User');
const workflowService = require('../services/workflowService');

// @desc    Create a new block
// @route   POST /api/blocks
// @access  Private (Manager only)
exports.createBlock = async (req, res, next) => {
    try {
        // Add createdBy from logged in user
        req.body.createdBy = req.user.id;

        const block = await Block.create(req.body);

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'CREATE',
            blockId: block._id,
            newValue: block,
            message: `Block ${block.name} created.`
        });

        res.status(201).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Get blocks
// @route   GET /api/blocks
// @access  Private
exports.getBlocks = async (req, res, next) => {
    try {
        let query;

        if (req.user.role === 'Manager') {
            query = Block.find().populate('assignedEngineer', 'displayName email').populate('createdBy', 'displayName email').populate('dependencies', 'name status healthStatus');
        } else {
            query = Block.find({ assignedEngineer: req.user.id }).populate('assignedEngineer', 'displayName email').populate('createdBy', 'displayName email').populate('dependencies', 'name status healthStatus');
        }

        const blocks = await query;

        // Calculate health dynamically and sort
        const updatedBlocks = blocks.map((block) => {
            block.calculateHealth();
            return block;
        });

        // Sort: Priority (Higher first) -> Health Status (CRITICAL -> WARNING -> HEALTHY)
        const severityMap = { 'BOTTLENECK': 4, 'CRITICAL': 3, 'WARNING': 2, 'HEALTHY': 1 };
        updatedBlocks.sort((a, b) => {
            if ((b.priority || 0) !== (a.priority || 0)) {
                return (b.priority || 0) - (a.priority || 0);
            }
            return (severityMap[b.healthStatus] || 0) - (severityMap[a.healthStatus] || 0);
        });

        res.status(200).json({ success: true, count: updatedBlocks.length, data: updatedBlocks });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a block
// @route   PUT /api/blocks/:id
// @access  Private (Manager only)
exports.updateBlock = async (req, res, next) => {
    try {
        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        const previousValue = JSON.parse(JSON.stringify(block));
        
        // Update fields
        const fieldsToUpdate = [
            'name', 'type', 'description', 'techNode', 'complexity', 
            'estimatedDurationHours', 'estimatedArea', 'priority', 'dependencies', 'assignedEngineer',
            'drcProof', 'lvsProof'
        ];

        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) {
                block[field] = req.body[field];
            }
        });

        await block.save();

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'UPDATE',
            blockId: block._id,
            previousValue,
            newValue: block,
            message: `Block ${block.name} metadata updated.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Assign engineer to a block
// @route   PUT /api/blocks/:id/assign
// @access  Private (Manager only)
exports.assignEngineer = async (req, res, next) => {
    try {
        const { engineerId } = req.body;
        
        if (!engineerId) {
            return res.status(400).json({ success: false, message: 'Please provide an engineerId' });
        }

        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        if (block.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Cannot assign a completed workflow.' });
        }

        const previousEngineerId = block.assignedEngineer;
        const isReassignment = previousEngineerId && previousEngineerId.toString() !== engineerId.toString();

        if (previousEngineerId && previousEngineerId.toString() === engineerId.toString()) {
            return res.status(200).json({ success: true, message: 'Block is already assigned to this engineer.', data: block });
        }

        // Capacity check for new engineer
        const activeTasksCount = await Block.countDocuments({
            assignedEngineer: engineerId,
            status: { $in: ['IN_PROGRESS', 'DRC', 'LVS', 'REVIEW'] }
        });

        if (activeTasksCount >= 5) {
            return res.status(400).json({ success: false, message: 'Engineer has reached the maximum capacity (5 active blocks).' });
        }

        // Fetch User details for intelligent notifications
        const newEngineer = await User.findById(engineerId);
        const prevEngineer = previousEngineerId ? await User.findById(previousEngineerId) : null;

        // Update block
        block.assignedEngineer = engineerId;
        block.assignmentHistory.push({ 
            engineer: engineerId, 
            assignedAt: new Date(),
            reassignedFrom: previousEngineerId || null
        });
        
        await block.save();

        // 1. Notify NEW engineer
        await createNotification({
            userId: engineerId,
            message: `${isReassignment ? 'URGENT REASSIGNMENT' : 'NEW ASSIGNMENT'}: ${block.name} assigned to you. Initializing execution environment.`,
            type: 'ASSIGNMENT',
            severity: 'high',
            actionUrl: `/workspace?blockId=${block._id}`,
            blockId: block._id
        });

        // 2. Notify PREVIOUS engineer (if reassignment)
        if (isReassignment && prevEngineer) {
            await createNotification({
                userId: previousEngineerId,
                message: `WORKFLOW HANDOVER: ${block.name} has been reassigned to ${newEngineer.displayName}. No further action required.`,
                type: 'SYSTEM',
                severity: 'medium',
                actionUrl: `/audit?blockId=${block._id}`,
                blockId: block._id
            });
        }

        // 3. Log Action
        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: isReassignment ? 'REASSIGN' : 'ASSIGN',
            blockId: block._id,
            previousValue: previousEngineerId,
            newValue: engineerId,
            message: isReassignment 
                ? `Workflow ${block.name} reassigned from ${prevEngineer ? prevEngineer.displayName : 'Unknown'} to ${newEngineer.displayName}.`
                : `Workflow ${block.name} assigned to ${newEngineer.displayName}.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove engineer assignment
// @route   DELETE /api/blocks/:id/assign
// @access  Private (Manager only)
exports.unassignEngineer = async (req, res, next) => {
    try {
        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        const previousEngineer = block.assignedEngineer;
        block.assignedEngineer = undefined;
        
        await block.save();

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'UNASSIGN',
            blockId: block._id,
            previousValue: previousEngineer,
            message: `Engineer unassigned from block ${block.name}.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Update block status
// @route   PUT /api/blocks/:id/status
// @access  Private (Engineer only)
exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        // Only assigned engineer can update status
        if (block.assignedEngineer.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this block' });
        }

        const validation = workflowService.validateTransition(block.status, status);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }

        // Engineer cannot move to COMPLETED directly
        if (status === 'COMPLETED') {
             return res.status(403).json({ success: false, message: 'Only managers can mark a block as COMPLETED' });
        }

        const previousStatus = block.status;
        const now = new Date();

        // Close current stage time
        const stageDurationHours = (now - block.stageStartTime) / (1000 * 60 * 60);
        block.stageHistory.push({
            stage: previousStatus,
            startTime: block.stageStartTime,
            endTime: now,
            durationHours: stageDurationHours
        });

        // Update total time
        block.actualDurationHours = (block.actualDurationHours || 0) + stageDurationHours;

        // Start next stage
        block.status = status;
        block.stageStartTime = now;
        
        await block.save();

        // If moved to REVIEW, notify the manager who created it
        if (status === 'REVIEW') {
            await createNotification({
                userId: block.createdBy,
                message: `Technical review requested: ${block.name} has entered sign-off stage.`,
                type: 'REVIEW_REQUEST',
                severity: 'high',
                actionUrl: `/workspace?blockId=${block._id}`,
                blockId: block._id
            });
        }

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'STATUS_UPDATE',
            blockId: block._id,
            previousValue: previousStatus,
            newValue: status,
            message: `Status updated to ${status}.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve or reject a block
// @route   PUT /api/blocks/:id/review
// @access  Private (Manager only)
exports.reviewBlock = async (req, res, next) => {
    try {
        const { action, rejectionReason } = req.body; // action can be 'APPROVE' or 'REJECT'
        
        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        if (block.status !== 'REVIEW') {
             return res.status(400).json({ success: false, message: 'Block must be in REVIEW status to be approved or rejected' });
        }

        const previousStatus = block.status;
        const now = new Date();

        // Close current stage (REVIEW)
        const stageDurationHours = (now - block.stageStartTime) / (1000 * 60 * 60);
        block.stageHistory.push({
            stage: previousStatus,
            startTime: block.stageStartTime,
            endTime: now,
            durationHours: stageDurationHours
        });
        block.actualDurationHours = (block.actualDurationHours || 0) + stageDurationHours;

        if (action === 'APPROVE') {
            block.status = 'COMPLETED';
            block.stageStartTime = now;
            block.escalated = false; 
            block.healthStatus = 'HEALTHY'; 
            block.executionState = 'COMPLETE';
            block.progress = 100;
            
            // Track Approval History
            block.approvalHistory.push({
                stage: previousStatus,
                timestamp: now,
                reviewer: req.user.id,
                comments: rejectionReason || 'Approved' // Reusing rejectionReason field for simplicity in payload or allow 'comment'
            });

            await block.save();

            // Notify engineer
            await createNotification({
                userId: block.assignedEngineer,
                message: `Verification success: ${block.name} has been approved and marked as COMPLETED.`,
                type: 'APPROVAL',
                severity: 'low',
                actionUrl: `/workspace?blockId=${block._id}`,
                blockId: block._id
            });

            await logAction({
                userId: req.user.id,
                userRole: req.user.role,
                action: 'APPROVE',
                blockId: block._id,
                previousValue: previousStatus,
                newValue: 'COMPLETED',
                message: `Block approved and marked as COMPLETED. Comments: ${rejectionReason || 'N/A'}`
            });

        } else if (action === 'REJECT') {
            if (!rejectionReason) {
                return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting a block' });
            }
            
            // Rejection resets to the INITIAL execution stage (IN_PROGRESS)
            const prevStatus = 'IN_PROGRESS';
            
            // Rejection Impact Model (Cumulative)
            block.confidenceScore = Math.max(0, (block.confidenceScore || 100) - 8);
            block.stabilityScore = Math.max(0, (block.stabilityScore || 100) - 12);
            block.pressureScore = Math.min(100, (block.pressureScore || 0) + 12);
            block.propagationRisk = Math.min(1, (block.propagationRisk || 0) + 0.15);
            
            // History Tracking
            block.rejectionHistory.push({
                stage: previousStatus,
                timestamp: now,
                engineer: block.assignedEngineer,
                reason: rejectionReason,
                severity: block.rejectionCount >= 2 ? 'HIGH' : 'MEDIUM'
            });

            block.status = prevStatus;
            block.stageStartTime = now;
            block.rejectionReason = rejectionReason;
            block.rejectionCount = (block.rejectionCount || 0) + 1;
            block.executionState = 'READY';
            block.isExecuting = false;
            block.progress = 0;
            
            await block.save();

            // Notify engineer
            await createNotification({
                userId: block.assignedEngineer,
                message: `Verification failure: ${block.name} was rejected. Reason: ${rejectionReason}`,
                type: 'REJECTION',
                severity: 'high',
                actionUrl: `/workspace?blockId=${block._id}`,
                blockId: block._id
            });

            await logAction({
                userId: req.user.id,
                userRole: req.user.role,
                action: 'REJECT',
                blockId: block._id,
                previousValue: previousStatus,
                newValue: prevStatus,
                message: `Block rejected. Moved back to ${prevStatus}. Reason: ${rejectionReason}`
            });

        } else {
            return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT.' });
        }

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Escalate a block
// @route   PUT /api/blocks/:id/escalate
// @access  Private (Manager only)
exports.escalateBlock = async (req, res, next) => {
    try {
        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        const states = ['NORMAL', 'ESCALATED', 'CRITICAL_ESCALATED'];
        const currIdx = states.indexOf(block.escalationState || 'NORMAL');
        const nextState = states[(currIdx + 1) % states.length];

        block.escalationState = nextState;
        block.escalated = nextState !== 'NORMAL';
        
        if (nextState === 'NORMAL') {
            block.priority = 5; // Reset to medium
        } else if (nextState === 'ESCALATED') {
            block.healthStatus = 'CRITICAL';
            block.priority = 8;
            block.lastEscalatedAt = new Date();
        } else if (nextState === 'CRITICAL_ESCALATED') {
            block.healthStatus = 'SEVERE';
            block.priority = 10;
            block.lastEscalatedAt = new Date();
        }

        await block.save();

        if (block.assignedEngineer && nextState !== 'NORMAL') {
            await createNotification({
                userId: block.assignedEngineer,
                message: `URGENT: ${block.name} escalated to ${nextState} status. Priority check required.`,
                type: 'ESCALATION',
                severity: nextState === 'CRITICAL_ESCALATED' ? 'critical' : 'high',
                actionUrl: `/workspace?blockId=${block._id}`,
                blockId: block._id
            });
        }

        // Also notify the manager if they aren't the one who triggered it (or just always for log consistency)
        await createNotification({
            userId: block.createdBy,
            message: `Orchestration Alert: ${block.name} state shifted to ${nextState}.`,
            type: 'ESCALATION',
            severity: nextState === 'CRITICAL_ESCALATED' ? 'critical' : 'high',
            actionUrl: `/workspace?blockId=${block._id}`,
            blockId: block._id
        });

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'ESCALATE',
            blockId: block._id,
            previousValue: states[currIdx],
            newValue: nextState,
            message: `Block escalation updated to ${nextState}. Priority: ${block.priority}.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};

// @desc    Resume workflow execution
// @route   POST /api/blocks/:id/resume
// @access  Private (Engineer only)
exports.resumeWorkflow = async (req, res, next) => {
    try {
        const block = await Block.findById(req.params.id);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        if (block.assignedEngineer && block.assignedEngineer.toString() !== req.user.id.toString()) {
             return res.status(403).json({ success: false, message: 'Not authorized to resume this block' });
        }

        const { force } = req.body;
        const allBlocks = await Block.find({});
        const result = await workflowService.resumeWorkflow(block, allBlocks, force);

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message });
        }

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'RESUME_WORKFLOW',
            blockId: block._id,
            message: result.message
        });

        res.status(200).json({ 
            success: true, 
            message: result.message, 
            unblockedCount: result.unblockedCount,
            data: block 
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get audit logs for a specific block
// @route   GET /api/blocks/:id/logs
// @access  Private
exports.getBlockLogs = async (req, res, next) => {
    try {
        const AuditLog = require('../models/AuditLog');
        const block = await Block.findById(req.params.id);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;

        const total = await AuditLog.countDocuments({ blockId: req.params.id });

        const logs = await AuditLog.find({ blockId: req.params.id })
            .populate('userId', 'displayName email')
            .sort({ timestamp: -1 })
            .skip(startIndex)
            .limit(limit);

        res.status(200).json({ 
            success: true, 
            count: logs.length,
            total,
            pagination: { page, limit, totalPages: Math.ceil(total / limit) },
            data: logs 
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get global audit logs
// @route   GET /api/blocks/logs/all
// @access  Private (Manager only)
exports.getGlobalLogs = async (req, res, next) => {
    try {
        const AuditLog = require('../models/AuditLog');
        const logs = await AuditLog.find({})
            .populate('userId', 'displayName email role')
            .populate('blockId', 'name')
            .sort({ timestamp: -1 })
            .limit(100);

        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Calculate system analytics (e.g. bottlenecks)
// @route   GET /api/blocks/analytics
// @access  Private
exports.getAnalytics = async (req, res, next) => {
    try {
        const blocks = await Block.find();
        
        const stageStats = {};
        workflowService.WORKFLOW_ORDER.forEach(stage => {
            if (stage !== 'COMPLETED' && stage !== 'NOT_STARTED') {
                stageStats[stage] = { totalHours: 0, count: 0 };
            }
        });

        blocks.forEach(block => {
            block.stageHistory.forEach(history => {
                if (stageStats[history.stage]) {
                    stageStats[history.stage].totalHours += (history.durationHours || 0);
                    stageStats[history.stage].count += 1;
                }
            });
        });

        let bottleneckStage = null;
        let maxAvg = 0;
        const analytics = {};

        for (const stage in stageStats) {
            const avg = stageStats[stage].count > 0 ? stageStats[stage].totalHours / stageStats[stage].count : 0;
            analytics[stage] = { avgHours: parseFloat(avg.toFixed(2)), count: stageStats[stage].count };
            
            if (avg > maxAvg) {
                maxAvg = avg;
                bottleneckStage = stage;
            }
        }

        res.status(200).json({
            success: true,
            bottleneckStage: maxAvg > 0 ? bottleneckStage : 'NONE',
            maxAvgHours: parseFloat(maxAvg.toFixed(2)),
            stageAnalytics: analytics
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reset all blocks and logs
// @route   DELETE /api/blocks/reset
// @access  Private (Manager only)
exports.resetDataset = async (req, res, next) => {
    try {
        const AuditLog = require('../models/AuditLog');
        const Notification = require('../models/Notification');
        const Request = require('../models/Request');
        await Block.deleteMany({});
        await AuditLog.deleteMany({});
        // Also clear notifications and requests for a full reset
        try { await Notification.deleteMany({}); } catch(e) {}
        try { await Request.deleteMany({}); } catch(e) {}
        res.status(200).json({ success: true, message: 'Dataset reset successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Load demo data
// @route   POST /api/blocks/demo
// @access  Private (Manager only)
exports.loadDemoData = async (req, res, next) => {
    try {
        const AuditLog = require('../models/AuditLog');
        const Notification = require('../models/Notification');
        const Request = require('../models/Request');
        await Block.deleteMany({});
        await AuditLog.deleteMany({});
        try { await Notification.deleteMany({}); } catch(e) {}
        try { await Request.deleteMany({}); } catch(e) {}

        const creatorId = req.user.id;
        const now = new Date();
        const H = 3600000; // 1 hour in ms

        // --- Engineer identity map (match by displayName or fallback by index) ---
        const allEngineers = await User.find({ role: 'Engineer' });
        const eng = (name) => {
            const found = allEngineers.find(e => e.displayName === name);
            return found ? found._id : (allEngineers.length > 0 ? allEngineers[0]._id : null);
        };

        // Helper to build stage history
        const stages = (list) => list.map(s => ({
            stage: s[0],
            startTime: new Date(now.getTime() - s[2] * H),
            endTime: new Date(now.getTime() - s[1] * H),
            durationHours: s[2] - s[1]
        }));

        const blocks = {};

        // ── 1. Bandgap_Reference ─────────────────────────────────
        blocks.b1 = await new Block({
            name: 'Bandgap_Reference', type: 'Analog Core', techNode: '7nm',
            complexity: 'MEDIUM', priority: 7, status: 'COMPLETED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_1'),
            estimatedDurationHours: 12, actualDurationHours: 12,
            rejectionCount: 0, progress: 100,
            executionState: 'COMPLETE', confidenceScore: 100, stabilityScore: 100,
            pressureScore: 0, propagationRisk: 0.3,
            stageStartTime: new Date(now.getTime() - 2 * H),
            stageHistory: stages([
                ['NOT_STARTED', 14, 15], ['IN_PROGRESS', 10, 14],
                ['DRC', 7, 10], ['LVS', 4, 7], ['REVIEW', 2, 4]
            ]),
        }).save();

        // ── 2. PMIC_Controller ───────────────────────────────────
        blocks.b2 = await new Block({
            name: 'PMIC_Controller', type: 'Power Management', techNode: '7nm',
            complexity: 'COMPLEX', priority: 9, status: 'REVIEW',
            healthStatus: 'BOTTLENECK', createdBy: creatorId,
            assignedEngineer: eng('Verification_Engineer_1'),
            estimatedDurationHours: 24, actualDurationHours: 58,
            rejectionCount: 1, progress: 100,
            executionState: 'IN_REVIEW', confidenceScore: 72, stabilityScore: 65,
            pressureScore: 58, propagationRisk: 0.45,
            rejectionReason: 'LVS netlist mismatch on power rail routing',
            stageStartTime: new Date(now.getTime() - 3 * H),
            stageHistory: stages([
                ['NOT_STARTED', 26, 28], ['IN_PROGRESS', 18, 26],
                ['DRC', 12, 18], ['LVS', 6, 12], ['REVIEW', 5, 6],
                ['IN_PROGRESS', 4, 5], ['DRC', 3.5, 4], ['LVS', 3.2, 3.5]
            ]),
            rejectionHistory: [{
                stage: 'REVIEW', timestamp: new Date(now.getTime() - 6 * H),
                reason: 'LVS netlist mismatch on power rail routing', severity: 'MEDIUM'
            }],
        }).save();

        // ── 3. ADC_Interface ─────────────────────────────────────
        blocks.b3 = await new Block({
            name: 'ADC_Interface', type: 'Mixed Signal', techNode: '5nm',
            complexity: 'CRITICAL', priority: 10, status: 'DRC',
            healthStatus: 'CRITICAL', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_2'),
            estimatedDurationHours: 28, actualDurationHours: 28,
            rejectionCount: 2, progress: 55,
            executionState: 'IN_PROGRESS', confidenceScore: 48, stabilityScore: 40,
            pressureScore: 82, propagationRisk: 0.65,
            escalated: true, escalationState: 'ESCALATED', lastEscalatedAt: new Date(now.getTime() - 4 * H),
            rejectionReason: 'Metal density violation in SAR comparator array',
            stageStartTime: new Date(now.getTime() - 6 * H),
            stageHistory: stages([
                ['NOT_STARTED', 40, 42], ['IN_PROGRESS', 28, 40],
                ['DRC', 22, 28], ['IN_PROGRESS', 16, 22], ['DRC', 12, 16],
                ['IN_PROGRESS', 8, 12]
            ]),
            rejectionHistory: [
                { stage: 'DRC', timestamp: new Date(now.getTime() - 22 * H), reason: 'Spacing violation on M5-M6 layers', severity: 'MEDIUM' },
                { stage: 'DRC', timestamp: new Date(now.getTime() - 12 * H), reason: 'Metal density violation in SAR comparator array', severity: 'HIGH' }
            ],
        }).save();

        // ── 4. Clock_Distribution_Network ────────────────────────
        blocks.b4 = await new Block({
            name: 'Clock_Distribution_Network', type: 'Clocking', techNode: '5nm',
            complexity: 'MEDIUM', priority: 6, status: 'IN_PROGRESS',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_1'),
            estimatedDurationHours: 14, actualDurationHours: 22,
            rejectionCount: 0, progress: 45,
            executionState: 'IN_PROGRESS', confidenceScore: 95, stabilityScore: 92,
            pressureScore: 15, propagationRisk: 0.2,
            stageStartTime: new Date(now.getTime() - 8 * H),
            stageHistory: stages([['NOT_STARTED', 12, 14], ['IN_PROGRESS', 10, 12]]),
        }).save();

        // ── 5. SRAM_Controller_Array ─────────────────────────────
        blocks.b5 = await new Block({
            name: 'SRAM_Controller_Array', type: 'Memory', techNode: '6nm',
            complexity: 'CRITICAL', priority: 10, status: 'NOT_STARTED',
            healthStatus: 'CRITICAL', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_3'),
            estimatedDurationHours: 38, actualDurationHours: 66,
            rejectionCount: 1, progress: 0,
            executionState: 'BLOCKED', confidenceScore: 55, stabilityScore: 50,
            pressureScore: 75, propagationRisk: 0.7,
            escalated: true, escalationState: 'ESCALATED', lastEscalatedAt: new Date(now.getTime() - 2 * H),
            rejectionHistory: [{ stage: 'DRC', timestamp: new Date(now.getTime() - 48 * H), reason: 'Previous iteration had SRAM bit-cell spacing violations', severity: 'HIGH' }],
        }).save();

        // ── 6. PLL_Core_Unit ─────────────────────────────────────
        blocks.b6 = await new Block({
            name: 'PLL_Core_Unit', type: 'RF / PLL', techNode: '5nm',
            complexity: 'CRITICAL', priority: 9, status: 'LVS',
            healthStatus: 'BOTTLENECK', createdBy: creatorId,
            assignedEngineer: eng('Verification_Engineer_2'),
            estimatedDurationHours: 30, actualDurationHours: 52,
            rejectionCount: 1, progress: 78,
            executionState: 'IN_PROGRESS', confidenceScore: 68, stabilityScore: 62,
            pressureScore: 52, propagationRisk: 0.4,
            rejectionReason: 'VCO tuning range mismatch in LVS extraction',
            stageStartTime: new Date(now.getTime() - 5 * H),
            stageHistory: stages([
                ['NOT_STARTED', 34, 36], ['IN_PROGRESS', 22, 34],
                ['DRC', 14, 22], ['LVS', 8, 14], ['IN_PROGRESS', 6, 8]
            ]),
            rejectionHistory: [{ stage: 'LVS', timestamp: new Date(now.getTime() - 8 * H), reason: 'VCO tuning range mismatch in LVS extraction', severity: 'MEDIUM' }],
        }).save();

        // ── 7. IO_Buffer_Array ───────────────────────────────────
        blocks.b7 = await new Block({
            name: 'IO_Buffer_Array', type: 'IO', techNode: '7nm',
            complexity: 'SIMPLE', priority: 4, status: 'COMPLETED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_2'),
            estimatedDurationHours: 8, actualDurationHours: 23,
            rejectionCount: 0, progress: 100,
            executionState: 'COMPLETE', confidenceScore: 100, stabilityScore: 100,
            pressureScore: 0, propagationRisk: 0.15,
            stageStartTime: new Date(now.getTime() - 1 * H),
            stageHistory: stages([
                ['NOT_STARTED', 10, 11], ['IN_PROGRESS', 6, 10],
                ['DRC', 4, 6], ['LVS', 2.5, 4], ['REVIEW', 1, 2.5]
            ]),
        }).save();

        // ── 8. Thermal_Sensor_Interface ──────────────────────────
        blocks.b8 = await new Block({
            name: 'Thermal_Sensor_Interface', type: 'Sensor', techNode: '6nm',
            complexity: 'MEDIUM', priority: 6, status: 'REVIEW',
            healthStatus: 'CRITICAL', createdBy: creatorId,
            assignedEngineer: eng('Senior_Reviewer_1'),
            estimatedDurationHours: 11, actualDurationHours: 20,
            rejectionCount: 1, progress: 100,
            executionState: 'IN_REVIEW', confidenceScore: 70, stabilityScore: 68,
            pressureScore: 45, propagationRisk: 0.25,
            rejectionReason: 'Thermal diode placement violates guard ring rules',
            stageStartTime: new Date(now.getTime() - 4 * H),
            stageHistory: stages([
                ['NOT_STARTED', 20, 22], ['IN_PROGRESS', 14, 20],
                ['DRC', 10, 14], ['LVS', 6, 10], ['REVIEW', 5, 6],
                ['IN_PROGRESS', 4.5, 5], ['DRC', 4.2, 4.5]
            ]),
            rejectionHistory: [{ stage: 'REVIEW', timestamp: new Date(now.getTime() - 6 * H), reason: 'Thermal diode placement violates guard ring rules', severity: 'MEDIUM' }],
        }).save();

        // ── 9. Power_Gating_Controller ───────────────────────────
        blocks.b9 = await new Block({
            name: 'Power_Gating_Controller', type: 'Power', techNode: '5nm',
            complexity: 'COMPLEX', priority: 9, status: 'NOT_STARTED',
            healthStatus: 'CRITICAL', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_3'),
            estimatedDurationHours: 24, actualDurationHours: 24,
            rejectionCount: 0, progress: 0,
            executionState: 'BLOCKED', confidenceScore: 60, stabilityScore: 55,
            pressureScore: 70, propagationRisk: 0.8,
        }).save();

        // ── 10. Security_Encryption_Engine ───────────────────────
        blocks.b10 = await new Block({
            name: 'Security_Encryption_Engine', type: 'Security', techNode: '6nm',
            complexity: 'MEDIUM', priority: 7, status: 'IN_PROGRESS',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_3'),
            estimatedDurationHours: 16, actualDurationHours: 16,
            rejectionCount: 0, progress: 40,
            executionState: 'IN_PROGRESS', confidenceScore: 90, stabilityScore: 88,
            pressureScore: 20, propagationRisk: 0.1,
            stageStartTime: new Date(now.getTime() - 9 * H),
            stageHistory: stages([['NOT_STARTED', 12, 14], ['IN_PROGRESS', 10, 12]]),
        }).save();

        // ── 11. Power_Management_Unit ────────────────────────────
        blocks.b11 = await new Block({
            name: 'Power_Management_Unit', type: 'Power', techNode: '5nm',
            complexity: 'MEDIUM', priority: 8, status: 'DRC',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            assignedEngineer: eng('Layout_Engineer_1'),
            estimatedDurationHours: 14, actualDurationHours: 24.5,
            rejectionCount: 0, progress: 20,
            executionState: 'IN_PROGRESS', confidenceScore: 85, stabilityScore: 82,
            pressureScore: 30, propagationRisk: 0.15,
            stageStartTime: new Date(now.getTime() - 2 * H),
        }).save();

        // ── 12. Thermal_Control_Logic ────────────────────────────
        blocks.b12 = await new Block({
            name: 'Thermal_Control_Logic', type: 'Digital', techNode: '6nm',
            complexity: 'SIMPLE', priority: 5, status: 'NOT_STARTED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            estimatedDurationHours: 6, actualDurationHours: 12.5,
            rejectionCount: 0, progress: 0,
            executionState: 'NOT_STARTED', confidenceScore: 100, stabilityScore: 100,
            pressureScore: 0, propagationRisk: 0.05,
        }).save();

        // ── 13. GPIO_Pad_Array ───────────────────────────────────
        blocks.b13 = await new Block({
            name: 'GPIO_Pad_Array', type: 'IO', techNode: '7nm',
            complexity: 'SIMPLE', priority: 3, status: 'NOT_STARTED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            estimatedDurationHours: 10, actualDurationHours: 10,
        }).save();

        // ── 14. SerDes_Transceiver ───────────────────────────────
        blocks.b14 = await new Block({
            name: 'SerDes_Transceiver', type: 'Analog Core', techNode: '5nm',
            complexity: 'CRITICAL', priority: 10, status: 'NOT_STARTED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            estimatedDurationHours: 45, actualDurationHours: 45,
        }).save();

        // ── 15. Voltage_Regulator ────────────────────────────────
        blocks.b15 = await new Block({
            name: 'Voltage_Regulator', type: 'Power Management', techNode: '7nm',
            complexity: 'MEDIUM', priority: 7, status: 'NOT_STARTED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            estimatedDurationHours: 18, actualDurationHours: 18,
        }).save();

        // ── 16. Logic_Standard_Cells ─────────────────────────────
        blocks.b16 = await new Block({
            name: 'Logic_Standard_Cells', type: 'Digital', techNode: '6nm',
            complexity: 'SIMPLE', priority: 4, status: 'NOT_STARTED',
            healthStatus: 'HEALTHY', createdBy: creatorId,
            estimatedDurationHours: 40, actualDurationHours: 40,
        }).save();

        // ── Wire Dependencies ────────────────────────────────────
        const depMap = {
            b2: ['b1'],           // PMIC depends on Bandgap
            b3: ['b2'],           // ADC depends on PMIC
            b4: ['b1'],           // Clock depends on Bandgap
            b5: ['b3'],           // SRAM depends on ADC
            b6: ['b4'],           // PLL depends on Clock
            b8: ['b7'],           // Thermal depends on IO_Buffer
            b9: ['b5', 'b6'],     // Power_Gating depends on SRAM + PLL
            b10: ['b7'],          // Security depends on IO_Buffer
        };
        for (const [key, deps] of Object.entries(depMap)) {
            const blk = blocks[key];
            blk.dependencies = deps.map(d => blocks[d]._id);
            await blk.save();
        }

        // ── Generate Audit Trail History ─────────────────────────
        const logEntries = [
            { action: 'CREATE', blockId: blocks.b1._id, message: 'Block Bandgap_Reference created.', offset: 72 },
            { action: 'ASSIGN', blockId: blocks.b1._id, message: 'Assigned to Layout_Engineer_1.', offset: 71 },
            { action: 'STATUS_UPDATE', blockId: blocks.b1._id, previousValue: 'NOT_STARTED', newValue: 'IN_PROGRESS', message: 'Execution started.', offset: 60 },
            { action: 'STATUS_UPDATE', blockId: blocks.b1._id, previousValue: 'IN_PROGRESS', newValue: 'DRC', message: 'DRC verification initiated.', offset: 48 },
            { action: 'STATUS_UPDATE', blockId: blocks.b1._id, previousValue: 'DRC', newValue: 'LVS', message: 'DRC passed. LVS initiated.', offset: 36 },
            { action: 'STATUS_UPDATE', blockId: blocks.b1._id, previousValue: 'LVS', newValue: 'REVIEW', message: 'LVS clean. Submitted for review.', offset: 24 },
            { action: 'APPROVE', blockId: blocks.b1._id, previousValue: 'REVIEW', newValue: 'COMPLETED', message: 'Approved by management.', offset: 12 },
            { action: 'CREATE', blockId: blocks.b3._id, message: 'Block ADC_Interface created.', offset: 48 },
            { action: 'ASSIGN', blockId: blocks.b3._id, message: 'Assigned to Layout_Engineer_2.', offset: 47 },
            { action: 'ESCALATE', blockId: blocks.b3._id, previousValue: 'NORMAL', newValue: 'ESCALATED', message: 'Critical path bottleneck. Escalated.', offset: 4 },
            { action: 'REJECT', blockId: blocks.b3._id, previousValue: 'DRC', newValue: 'IN_PROGRESS', message: 'Metal density violation. Rejected.', offset: 12 },
            { action: 'CREATE', blockId: blocks.b2._id, message: 'Block PMIC_Controller created.', offset: 50 },
            { action: 'REJECT', blockId: blocks.b2._id, previousValue: 'REVIEW', newValue: 'IN_PROGRESS', message: 'LVS netlist mismatch. Rejected.', offset: 6 },
            { action: 'ESCALATE', blockId: blocks.b5._id, previousValue: 'NORMAL', newValue: 'ESCALATED', message: 'Blocked by upstream. Escalated for resolution.', offset: 2 },
        ];

        for (const entry of logEntries) {
            await AuditLog.create({
                userId: creatorId, userRole: 'Manager',
                action: entry.action, blockId: entry.blockId,
                previousValue: entry.previousValue || null,
                newValue: entry.newValue || null,
                message: entry.message,
                timestamp: new Date(now.getTime() - entry.offset * H)
            });
        }

        res.status(200).json({ success: true, message: 'High-fidelity semiconductor execution data seeded — 10 blocks, dependency graph, audit trail.' });
    } catch (error) {
        next(error);
    }
};
// @desc    Delete a block
// @route   DELETE /api/blocks/:id
// @access  Private (Manager only)
exports.deleteBlock = async (req, res, next) => {
    try {
        const block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        const assignedEngineerId = block.assignedEngineer;
        const blockName = block.name;

        // 1. Notify engineer if assigned
        if (assignedEngineerId) {
            await createNotification({
                userId: assignedEngineerId,
                message: `CRITICAL ALERT: Workflow ${blockName} has been deleted by management. Any active execution for this block has been terminated.`,
                type: 'SYSTEM',
                severity: 'high',
                blockId: block._id
            });
        }

        // 2. Log Action
        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'DELETE',
            blockId: block._id,
            previousValue: blockName,
            newValue: null,
            message: `Workflow block ${blockName} deleted by manager.`
        });

        // 3. Delete the block
        await Block.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Release a block to tapeout
// @route   PUT /api/blocks/:id/release
// @access  Private (Manager only)
exports.releaseBlock = async (req, res, next) => {
    try {
        const block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        // Only COMPLETED blocks can be released
        if (block.status !== 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Only completed workflows can be released to tapeout' });
        }

        block.isReleased = true;
        block.executionState = 'RELEASED';
        await block.save();

        // Notify engineer
        if (block.assignedEngineer) {
            await createNotification({
                userId: block.assignedEngineer,
                message: `SUCCESS: Workflow ${block.name} has been released to Tapeout. Execution terminated successfully.`,
                type: 'SYSTEM',
                severity: 'low',
                blockId: block._id
            });
        }

        // Log Action
        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'RELEASE',
            blockId: block._id,
            message: `Workflow block ${block.name} released to tapeout by manager.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};
// @desc    Upload proof for DRC or LVS
// @route   PUT /api/blocks/:id/proof
// @access  Private (Engineer only)
exports.uploadProof = async (req, res, next) => {
    try {
        const { drcProof, lvsProof } = req.body;
        const updateData = {};
        
        if (drcProof) updateData.drcProof = drcProof;
        if (lvsProof) updateData.lvsProof = lvsProof;

        const block = await Block.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: false }
        );

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'UPDATE',
            blockId: block._id,
            message: `Proof of work uploaded for ${drcProof ? 'DRC' : 'LVS'} by engineer ${req.user.displayName || 'unknown'}.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        console.error("uploadProof Controller Error:", error);
        next(error);
    }
};

// @desc    Notify owner/reviewer/manager about a blocker
// @route   POST /api/blocks/:id/notify
// @access  Private
exports.notifyBlocker = async (req, res, next) => {
    try {
        const { targetUserId, message, type, severity } = req.body;
        const block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        // Create notification for target user
        await createNotification({
            userId: targetUserId,
            message,
            type: type || 'SYSTEM',
            severity: severity || 'medium',
            blockId: block._id
        });

        // Log the action
        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'NOTIFY',
            blockId: block._id,
            message: `Blocker notification sent for ${block.name}: ${message}`
        });

        res.status(200).json({ success: true, message: 'Notification sent successfully' });
    } catch (error) {
        next(error);
    }
};

