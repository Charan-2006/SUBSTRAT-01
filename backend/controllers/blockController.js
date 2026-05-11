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
            'baseHours', 'estimatedArea', 'priority', 'dependencies', 'assignedEngineer'
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
            return res.status(400).json({ success: false, message: 'Block is already assigned to this engineer.' });
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
        block.totalTimeSpent = (block.totalTimeSpent || 0) + stageDurationHours;

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
        block.totalTimeSpent = (block.totalTimeSpent || 0) + stageDurationHours;

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

        const allBlocks = await Block.find({});
        const result = await workflowService.resumeWorkflow(block, allBlocks);

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
        await Block.deleteMany({});
        await AuditLog.deleteMany({});
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
        const User = require('../models/User');
        const engineers = await User.find({ role: 'Engineer' });
        const manager = await User.findOne({ role: 'Manager' });
        const creatorId = manager ? manager._id : req.user.id;

        const now = new Date();
        const hour = 60 * 60 * 1000;
        
        const dagStructure = [
            { id: 'b1', name: 'PLL_Core', status: 'IN_PROGRESS', health: 'CRITICAL', complexity: 'CRITICAL', deps: [] },
            { id: 'b16', name: 'Bandgap_Ref', status: 'IN_PROGRESS', health: 'SEVERE', complexity: 'COMPLEX', deps: ['b1'] },
            { id: 'b5', name: 'Bias_Gen', status: 'DRC', health: 'RISK', complexity: 'COMPLEX', deps: ['b16'] },
            { id: 'b17', name: 'Level_Shifter', status: 'NOT_STARTED', health: 'HEALTHY', complexity: 'MEDIUM', deps: ['b5'] },
            { id: 'b2', name: 'ADC_SAR', status: 'NOT_STARTED', health: 'HEALTHY', complexity: 'COMPLEX', deps: ['b17'] },
            { id: 'b3', name: 'DAC_IDAC', status: 'NOT_STARTED', health: 'HEALTHY', complexity: 'MEDIUM', deps: ['b2'] },
            { id: 'b11', name: 'POR_Circuit', status: 'COMPLETED', health: 'HEALTHY', complexity: 'SIMPLE', deps: [] },
            { id: 'b12', name: 'LDO_Regulator', status: 'COMPLETED', health: 'HEALTHY', complexity: 'MEDIUM', deps: ['b11'] },
            { id: 'b6', name: 'SRAM_Array', status: 'IN_PROGRESS', health: 'RISK', complexity: 'CRITICAL', deps: ['b12', 'b5'] },
            { id: 'b7', name: 'Sense_Amp', status: 'NOT_STARTED', health: 'HEALTHY', complexity: 'MEDIUM', deps: ['b6'] },
            { id: 'b8', name: 'Clock_Distribution', status: 'LVS', health: 'BOTTLENECK', complexity: 'CRITICAL', deps: [] },
            { id: 'b9', name: 'Top_Wrap', status: 'NOT_STARTED', health: 'HEALTHY', complexity: 'COMPLEX', deps: ['b8', 'b3', 'b7'] },
            { id: 'b10', name: 'Charge_Pump', status: 'REVIEW', health: 'RISK', complexity: 'MEDIUM', deps: [] },
            { id: 'b13', name: 'Input_Buffer', status: 'IN_PROGRESS', health: 'HEALTHY', complexity: 'SIMPLE', deps: ['b10', 'b12'] },
            { id: 'b14', name: 'Output_Stage', status: 'DRC', health: 'HEALTHY', complexity: 'MEDIUM', deps: ['b13'] },
            { id: 'b15', name: 'ESD_Clamp', status: 'NOT_STARTED', health: 'HEALTHY', complexity: 'SIMPLE', deps: ['b14'] }
        ];

        let blockDocs = {};
        
        for (let i = 0; i < dagStructure.length; i++) {
            const item = dagStructure[i];
            const assignedEng = engineers.length > 0 ? engineers[i % engineers.length] : null;
            
            let baseExpected = 8;
            if (item.status === 'IN_PROGRESS') baseExpected = 7;
            else if (item.status === 'DRC') baseExpected = 10;
            else if (item.status === 'LVS') baseExpected = 6;
            else if (item.status === 'REVIEW') baseExpected = 2;

            let mult = item.complexity === 'CRITICAL' ? 1.6 : item.complexity === 'COMPLEX' ? 1.3 : item.complexity === 'SIMPLE' ? 0.8 : 1.0;
            let expectedHours = baseExpected * mult;
            let actualHours = expectedHours;
            let rejectionCount = 0;

            if (item.health === 'RISK') actualHours = expectedHours * 1.25;
            if (item.health === 'CRITICAL') actualHours = expectedHours * 1.45;
            if (item.health === 'SEVERE' || item.health === 'BOTTLENECK') actualHours = expectedHours * 1.85;
            if (item.health === 'HEALTHY' && item.status !== 'NOT_STARTED') actualHours = expectedHours * 0.85;

            if (item.health === 'CRITICAL') rejectionCount = 1;
            if (item.health === 'SEVERE' || item.health === 'BOTTLENECK') rejectionCount = 2;

            const startTime = new Date(now.getTime() - (actualHours * hour));
            const progress = item.status === 'COMPLETED' ? 100 : (item.status === 'REVIEW' ? 100 : (item.status === 'NOT_STARTED' ? 0 : Math.floor(Math.random() * 80) + 10));
            const executionState = item.status === 'COMPLETED' ? 'COMPLETE' : 
                                 (item.status === 'REVIEW' ? 'IN_REVIEW' : 
                                 (item.status === 'NOT_STARTED' ? (item.deps.length > 0 ? 'BLOCKED' : 'READY') : 'IN_PROGRESS'));

            const block = new Block({
                name: item.name,
                complexity: item.complexity,
                techNode: '7nm',
                status: item.status,
                progress,
                executionState,
                createdBy: creatorId,
                assignedEngineer: item.status !== 'NOT_STARTED' ? assignedEng?._id : null,
                rejectionCount,
                expectedDurationHours: expectedHours,
                actualDurationHours: item.status === 'NOT_STARTED' ? 0 : actualHours,
                stageStartTime: item.status === 'NOT_STARTED' ? null : startTime,
                healthStatus: (item.status === 'NOT_STARTED' || item.status === 'COMPLETED') ? 'HEALTHY' : item.health,
                totalTimeSpent: item.status === 'NOT_STARTED' ? 0 : actualHours,
            });

            blockDocs[item.id] = await block.save();
        }

        for (const item of dagStructure) {
            if (item.deps.length > 0) {
                const currentBlock = blockDocs[item.id];
                currentBlock.dependencies = item.deps.map(depId => blockDocs[depId]._id);
                await currentBlock.save();
            }
        }

        res.status(200).json({ success: true, message: 'High-fidelity enterprise data seeded.' });
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

