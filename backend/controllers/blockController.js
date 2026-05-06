const Block = require('../models/Block');
const { logAction } = require('../utils/logger');
const { createNotification } = require('../utils/notifier');
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

        // Manager sees all, Engineer sees only their assigned blocks
        if (req.user.role === 'Manager') {
            query = Block.find().populate('assignedEngineer', 'displayName email').populate('createdBy', 'displayName email');
        } else {
            query = Block.find({ assignedEngineer: req.user.id }).populate('assignedEngineer', 'displayName email').populate('createdBy', 'displayName email');
        }

        const blocks = await query;

        // Calculate health dynamically and sort
        const updatedBlocks = blocks.map((block) => {
            block.calculateHealth();
            return block;
        });

        // Sort: CRITICAL -> RISK -> HEALTHY
        const severityMap = { 'CRITICAL': 3, 'RISK': 2, 'HEALTHY': 1 };
        updatedBlocks.sort((a, b) => severityMap[b.healthStatus] - severityMap[a.healthStatus]);

        res.status(200).json({ success: true, count: updatedBlocks.length, data: updatedBlocks });
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

        const previousEngineer = block.assignedEngineer;

        // Basic limit check: Ensure engineer doesn't have too many active tasks
        const activeTasksCount = await Block.countDocuments({
            assignedEngineer: engineerId,
            status: { $in: ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS'] }
        });

        // Let's set a maximum of 3 active tasks
        if (activeTasksCount >= 3) {
            return res.status(400).json({ success: false, message: 'Engineer has reached the maximum number of active tasks (3).' });
        }

        // Update block
        block.assignedEngineer = engineerId;
        block.assignmentHistory.push({ engineer: engineerId });
        
        await block.save();

        // Notify engineer
        await createNotification({
            userId: engineerId,
            message: `New block assigned: ${block.name}`,
            type: 'ASSIGNMENT',
            blockId: block._id
        });

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'ASSIGN',
            blockId: block._id,
            previousValue: previousEngineer,
            newValue: engineerId,
            message: `Assigned engineer ${engineerId} to block ${block.name}.`
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
                message: `Block ${block.name} is ready for review.`,
                type: 'COMPLETION',
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
            await block.save();

            // Notify engineer
            await createNotification({
                userId: block.assignedEngineer,
                message: `Congratulations! Block ${block.name} has been approved.`,
                type: 'COMPLETION',
                blockId: block._id
            });

            await logAction({
                userId: req.user.id,
                userRole: req.user.role,
                action: 'APPROVE',
                blockId: block._id,
                previousValue: previousStatus,
                newValue: 'COMPLETED',
                message: `Block approved and marked as COMPLETED.`
            });

        } else if (action === 'REJECT') {
            if (!rejectionReason) {
                return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting a block' });
            }
            
            // Rejection moves back to PREVIOUS stage
            const workflowOrder = workflowService.WORKFLOW_ORDER;
            const currentIndex = workflowOrder.indexOf(previousStatus);
            const prevStatus = workflowOrder[currentIndex - 1] || 'IN_PROGRESS';

            block.status = prevStatus;
            block.stageStartTime = now;
            block.rejectionReason = rejectionReason;
            block.rejectionCount = (block.rejectionCount || 0) + 1;
            await block.save();

            // Notify engineer
            await createNotification({
                userId: block.assignedEngineer,
                message: `Block ${block.name} was rejected: ${rejectionReason}`,
                type: 'REJECTION',
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

// @desc    Get audit logs for a specific block
// @route   GET /api/blocks/:id/logs
// @access  Private
exports.getBlockLogs = async (req, res, next) => {
    try {
        const AuditLog = require('../models/AuditLog');
        
        // Ensure block exists and user has access
        const block = await Block.findById(req.params.id);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        if (req.user.role === 'Engineer' && block.assignedEngineer?.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to view logs for this block' });
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
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
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
        
        // Optionally reload fresh demo data automatically
        // await exports.loadDemoData(req, res); 
        
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
        const User = require('../models/User');
        
        // 1. Wipe existing data
        await Block.deleteMany({});
        await AuditLog.deleteMany({});

        // 2. Get users for assignment
        const engineers = await User.find({ role: 'Engineer' });
        const manager = await User.findOne({ role: 'Manager' });
        const creatorId = manager ? manager._id : req.user.id;

        // Specific distribution as requested (Total: 8 blocks)
        const distribution = [
            { status: 'NOT_STARTED', count: 1 },
            { status: 'IN_PROGRESS', count: 2 },
            { status: 'DRC', count: 2 },
            { status: 'LVS', count: 1 },
            { status: 'REVIEW', count: 1 },
            { status: 'COMPLETED', count: 1 }
        ];

        // Define target health distribution for the 8 blocks
        // We'll map these to the blocks as we generate them
        const targetHealths = [
            'HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 
            'AT_RISK', 'AT_RISK', 
            'CRITICAL', 'CRITICAL'
        ];
        
        // Shuffle targets to randomize which status gets which health
        for (let i = targetHealths.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [targetHealths[i], targetHealths[j]] = [targetHealths[j], targetHealths[i]];
        }

        const blockNames = [
            'Bandgap_Ref', 'LDO_Regulator', 'PLL_Core', 'SRAM_Array', 
            'ADC_SAR', 'DAC_IDAC', 'Bias_Gen', 'Level_Shifter',
            'Input_Buffer', 'Output_Stage', 'Charge_Pump', 'POR_Circuit'
        ];

        const workflow = workflowService.WORKFLOW_ORDER;
        const now = new Date();
        const hour = 60 * 60 * 1000;
        const day = 24 * hour;

        let nameIdx = 0;
        for (const item of distribution) {
            for (let c = 0; c < item.count; c++) {
                const name = blockNames[nameIdx % blockNames.length];
                const targetHealth = targetHealths[nameIdx]; // Assign one of our balanced targets
                nameIdx++;

                const complexity = ['SIMPLE', 'MEDIUM', 'COMPLEX'][Math.floor(Math.random() * 3)];
                const techNode = ['12nm', '7nm', '28nm'][Math.floor(Math.random() * 3)];
                const estimatedHours = workflowService.calculateEstimation(complexity, techNode);
                
                const statusIndex = workflow.indexOf(item.status);
                const assignedEng = engineers.length > 0 ? engineers[nameIdx % engineers.length] : null;

                // Determine rejectionCount based on target health
                let rejectionCount = 0;
                if (targetHealth === 'AT_RISK') rejectionCount = Math.random() > 0.5 ? 1 : 0;
                if (targetHealth === 'CRITICAL') rejectionCount = Math.random() > 0.5 ? 2 : 1;

                // Special case: NOT_STARTED and COMPLETED are usually healthy in logic, 
                // but let's keep the rejections for history if target was critical
                if (item.status === 'NOT_STARTED') rejectionCount = 0;

                let block = new Block({
                    name,
                    complexity,
                    techNode,
                    status: item.status,
                    createdBy: creatorId,
                    assignedEngineer: item.status !== 'NOT_STARTED' ? (assignedEng ? assignedEng._id : null) : null,
                    rejectionCount: rejectionCount,
                    estimatedHours: estimatedHours,
                    stageHistory: [],
                    totalTimeSpent: 0
                });

                // Simulate time per stage
                // Start history 15 days ago to keep it compact
                let currentTime = new Date(now.getTime() - (15 * day)); 
                
                for (let i = 0; i <= statusIndex; i++) {
                    const stage = workflow[i];
                    
                    if (stage === 'COMPLETED' && i === statusIndex) {
                         await AuditLog.create({
                            userId: creatorId,
                            userRole: 'Manager',
                            action: 'APPROVE',
                            blockId: block._id,
                            previousValue: 'REVIEW',
                            newValue: 'COMPLETED',
                            message: `Block approved by manager.`,
                            timestamp: currentTime
                        });
                        continue;
                    }

                    // Base time distribution per stage (Total should sum to ~1.0 roughly)
                    let baseMultiplier = 0.2; 
                    if (stage === 'IN_PROGRESS') baseMultiplier = 0.25;
                    if (stage === 'DRC') baseMultiplier = 0.4; // DRC is the bottleneck
                    if (stage === 'LVS') baseMultiplier = 0.2;
                    if (stage === 'REVIEW') baseMultiplier = 0.15;

                    // Calculate Jitter to meet health target in the ACTIVE stage
                    let jitter = 0.85; // Default: slightly faster than expected
                    
                    if (i === statusIndex) {
                        // Current active stage - this is where health is calculated
                        if (targetHealth === 'HEALTHY') jitter = 0.7 + Math.random() * 0.25; // 70% to 95%
                        if (targetHealth === 'AT_RISK') {
                            // 10-40% above expected
                            jitter = 1.1 + Math.random() * 0.3; 
                        }
                        if (targetHealth === 'CRITICAL') {
                            // 50-100% above expected
                            jitter = 1.5 + Math.random() * 0.5;
                        }
                    } else {
                        // Historical stages - keep them mostly realistic/healthy
                        jitter = 0.8 + Math.random() * 0.2; // 80% to 100%
                    }

                    const duration = Math.round(estimatedHours * baseMultiplier * jitter);
                    const startTime = new Date(currentTime);
                    const endTime = new Date(currentTime.getTime() + (duration * hour));
                    
                    if (i < statusIndex) {
                        block.stageHistory.push({
                            stage,
                            startTime,
                            endTime,
                            durationHours: duration
                        });
                        block.totalTimeSpent += duration;
                        
                        await AuditLog.create({
                            userId: assignedEng ? assignedEng._id : creatorId,
                            userRole: assignedEng ? 'Engineer' : 'Manager',
                            action: 'STATUS_UPDATE',
                            blockId: block._id,
                            previousValue: workflow[i-1] || 'NONE',
                            newValue: stage,
                            message: `Stage ${stage} finished.`,
                            timestamp: startTime
                        });

                        currentTime = endTime;
                    } else {
                        // Active stage
                        block.stageStartTime = startTime;
                        await AuditLog.create({
                            userId: assignedEng ? assignedEng._id : creatorId,
                            userRole: assignedEng ? 'Engineer' : 'Manager',
                            action: 'STATUS_UPDATE',
                            blockId: block._id,
                            previousValue: workflow[i-1] || 'NONE',
                            newValue: stage,
                            message: `Work started on ${stage}.`,
                            timestamp: startTime
                        });
                    }
                }

                // Apply rejections if any
                if (block.rejectionCount > 0 && block.stageStartTime) {
                    block.rejectionReason = "Timing violations detected in routing tracks.";
                    for (let r = 0; r < block.rejectionCount; r++) {
                        await AuditLog.create({
                            userId: creatorId,
                            userRole: 'Manager',
                            action: 'REJECT',
                            blockId: block._id,
                            previousValue: 'REVIEW',
                            newValue: 'LVS',
                            message: `Review rejected (Iteration #${r+1}).`,
                            timestamp: new Date(block.stageStartTime.getTime() - (r + 1) * hour)
                        });
                    }
                }

                block.calculateHealth();
                await block.save();
            }
        }

        res.status(200).json({ success: true, message: 'Realistic demo data loaded successfully' });
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
