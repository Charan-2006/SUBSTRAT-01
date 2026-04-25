const Block = require('../models/Block');
const { logAction } = require('../utils/logger');
const { createNotification } = require('../utils/notifier');

// @desc    Create a new block
// @route   POST /api/blocks
// @access  Private (Manager only)
exports.createBlock = async (req, res) => {
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
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get blocks
// @route   GET /api/blocks
// @access  Private
exports.getBlocks = async (req, res) => {
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
        const updatedBlocks = await Promise.all(blocks.map(async (block) => {
            block.calculateHealth();
            // Optional: Save it back so DB is updated
            await block.save();
            return block;
        }));

        // Sort: CRITICAL -> RISK -> HEALTHY
        const severityMap = { 'CRITICAL': 3, 'RISK': 2, 'HEALTHY': 1 };
        updatedBlocks.sort((a, b) => severityMap[b.healthStatus] - severityMap[a.healthStatus]);

        res.status(200).json({ success: true, count: updatedBlocks.length, data: updatedBlocks });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Assign engineer to a block
// @route   PUT /api/blocks/:id/assign
// @access  Private (Manager only)
exports.assignEngineer = async (req, res) => {
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
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update block status
// @route   PUT /api/blocks/:id/status
// @access  Private (Engineer only)
exports.updateStatus = async (req, res) => {
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

        const workflowOrder = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
        const currentIndex = workflowOrder.indexOf(block.status);
        const newIndex = workflowOrder.indexOf(status);

        if (newIndex === -1) {
             return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Cannot skip stages and cannot go backwards unless rejected (which is handled by Manager)
        if (newIndex !== currentIndex + 1) {
             return res.status(400).json({ 
                 success: false, 
                 message: `Invalid status transition. You must move from ${block.status} to ${workflowOrder[currentIndex + 1] || 'None'}` 
             });
        }

        // Engineer cannot move to COMPLETED directly
        if (status === 'COMPLETED') {
             return res.status(403).json({ success: false, message: 'Only managers can mark a block as COMPLETED' });
        }

        const previousStatus = block.status;
        block.status = status;
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
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Approve or reject a block
// @route   PUT /api/blocks/:id/review
// @access  Private (Manager only)
exports.reviewBlock = async (req, res) => {
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

        if (action === 'APPROVE') {
            block.status = 'COMPLETED';
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
            
            block.status = 'IN_PROGRESS';
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
                newValue: 'IN_PROGRESS',
                message: `Block rejected. Reason: ${rejectionReason}`
            });

        } else {
            return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT.' });
        }

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get audit logs for a specific block
// @route   GET /api/blocks/:id/logs
// @access  Private
exports.getBlockLogs = async (req, res) => {
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
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Calculate system analytics (e.g. bottlenecks)
// @route   GET /api/blocks/analytics
// @access  Private
exports.getAnalytics = async (req, res) => {
    try {
        const AuditLog = require('../models/AuditLog');
        
        // Find all status update logs
        const logs = await AuditLog.find({ action: 'STATUS_UPDATE' }).sort({ blockId: 1, timestamp: 1 });
        
        const stageTimes = {
            'NOT_STARTED': { totalHours: 0, count: 0 },
            'IN_PROGRESS': { totalHours: 0, count: 0 },
            'DRC': { totalHours: 0, count: 0 },
            'LVS': { totalHours: 0, count: 0 },
            'REVIEW': { totalHours: 0, count: 0 }
        };

        // Group logs by blockId to calculate time spent in each stage
        const logsByBlock = {};
        logs.forEach(log => {
            if (!logsByBlock[log.blockId]) logsByBlock[log.blockId] = [];
            logsByBlock[log.blockId].push(log);
        });

        for (const blockId in logsByBlock) {
            const blockLogs = logsByBlock[blockId];
            for (let i = 0; i < blockLogs.length - 1; i++) {
                const currentLog = blockLogs[i];
                const nextLog = blockLogs[i + 1];
                
                const timeDiffHours = (nextLog.timestamp - currentLog.timestamp) / (1000 * 60 * 60);
                const stage = currentLog.newValue; // The stage it entered
                
                if (stageTimes[stage]) {
                    stageTimes[stage].totalHours += timeDiffHours;
                    stageTimes[stage].count += 1;
                }
            }
        }

        let bottleneckStage = null;
        let maxAvg = 0;

        const analytics = {};
        for (const stage in stageTimes) {
            const avg = stageTimes[stage].count > 0 ? stageTimes[stage].totalHours / stageTimes[stage].count : 0;
            analytics[stage] = { avgHours: avg, count: stageTimes[stage].count };
            
            if (avg > maxAvg) {
                maxAvg = avg;
                bottleneckStage = stage;
            }
        }

        res.status(200).json({
            success: true,
            bottleneckStage,
            maxAvgHours: maxAvg,
            stageAnalytics: analytics
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Load demo data
// @route   POST /api/blocks/demo
// @access  Private (Manager only)
exports.loadDemoData = async (req, res) => {
    try {
        const AuditLog = require('../models/AuditLog');
        
        // 1. Wipe existing data
        await Block.deleteMany({});
        await AuditLog.deleteMany({});

        // 2. Create demo blocks
        const demoBlocks = [];
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        // Block 1: Healthy, newly created
        demoBlocks.push({
            name: 'ALU_Core_Top', type: 'Core', techNode: '7nm', complexity: 'MEDIUM', baseHours: 40,
            status: 'IN_PROGRESS', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 0, createdAt: new Date(now - oneDay * 0.5), updatedAt: new Date(now - oneDay * 0.1),
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 0.5) }]
        });

        // Block 2: Risk (inactive for > 24h)
        demoBlocks.push({
            name: 'PLL_Freq_Synth', type: 'Analog', techNode: '5nm', complexity: 'COMPLEX', baseHours: 80,
            status: 'DRC', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 0, createdAt: new Date(now - oneDay * 5), updatedAt: new Date(now - oneDay * 2), // 48h inactive -> RISK/CRITICAL
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 5) }]
        });

        // Block 3: Critical (time spent > 120%)
        demoBlocks.push({
            name: 'LDO_Regulator_v2', type: 'Power', techNode: '12nm', complexity: 'SIMPLE', baseHours: 10,
            status: 'LVS', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 1, createdAt: new Date(now - oneDay * 14), updatedAt: new Date(now - oneDay * 0.5),
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 14) }] // 14 days for a 10h task!
        });

        // Block 4: Critical (2+ rejections)
        demoBlocks.push({
            name: 'Bandgap_Ref', type: 'Analog', techNode: '5nm', complexity: 'MEDIUM', baseHours: 20,
            status: 'IN_PROGRESS', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 3, rejectionReason: 'Failed EMIR checks repeatedly.',
            createdAt: new Date(now - oneDay * 3), updatedAt: new Date(now - oneDay * 0.2),
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 3) }]
        });

        // Block 5: Healthy, completed
        demoBlocks.push({
            name: 'SRAM_Macro_1MB', type: 'Memory', techNode: '7nm', complexity: 'CRITICAL', baseHours: 120,
            status: 'COMPLETED', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 0, createdAt: new Date(now - oneDay * 20), updatedAt: new Date(now - oneDay * 2),
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 20) }]
        });

        // Block 6: Healthy, Review
        demoBlocks.push({
            name: 'ADC_12bit', type: 'Mixed-Signal', techNode: '5nm', complexity: 'COMPLEX', baseHours: 100,
            status: 'REVIEW', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 0, createdAt: new Date(now - oneDay * 4), updatedAt: new Date(now - oneDay * 0.1),
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 4) }]
        });

        // Block 7: Not Started
        demoBlocks.push({
            name: 'DAC_10bit', type: 'Mixed-Signal', techNode: '5nm', complexity: 'MEDIUM', baseHours: 40,
            status: 'NOT_STARTED', createdBy: req.user.id, 
            rejectionCount: 0, createdAt: new Date(now - oneDay * 1), updatedAt: new Date(now - oneDay * 1)
        });
        
        // Block 8: Risk (1 rejection)
        demoBlocks.push({
            name: 'Temp_Sensor', type: 'Analog', techNode: '12nm', complexity: 'SIMPLE', baseHours: 15,
            status: 'IN_PROGRESS', createdBy: req.user.id, assignedEngineer: req.user.id,
            rejectionCount: 1, rejectionReason: 'Missed top level routing tracks.',
            createdAt: new Date(now - oneDay * 2), updatedAt: new Date(now - oneDay * 0.5),
            assignmentHistory: [{ engineer: req.user.id, assignedAt: new Date(now - oneDay * 2) }]
        });

        const createdBlocks = await Block.insertMany(demoBlocks);
        
        // Calculate health dynamically and save
        await Promise.all(createdBlocks.map(async (block) => {
            try {
                const b = await Block.findById(block._id);
                if (b) {
                    b.calculateHealth();
                    await b.save();
                    
                    // Add a fake log to make timeline look populated
                    await AuditLog.create({
                        userId: req.user.id,
                        userRole: req.user.role,
                        action: 'CREATE',
                        blockId: b._id,
                        newValue: b.name,
                        message: `Block created automatically via Demo Generator.`,
                        timestamp: b.createdAt
                    });

                    // If it has status beyond NOT_STARTED, add some fake transition logs to feed the analytics
                    if (b.status !== 'NOT_STARTED') {
                         await AuditLog.create({
                            userId: req.user.id,
                            userRole: req.user.role,
                            action: 'STATUS_UPDATE',
                            blockId: b._id,
                            previousValue: 'NOT_STARTED',
                            newValue: 'IN_PROGRESS',
                            message: `Status updated to IN_PROGRESS.`,
                            timestamp: new Date(b.createdAt.getTime() + (oneDay * 0.1))
                        });
                    }
                    if (b.status === 'LVS' || b.status === 'REVIEW' || b.status === 'COMPLETED') {
                         // Fake bottleneck in DRC
                         await AuditLog.create({
                            userId: req.user.id,
                            userRole: req.user.role,
                            action: 'STATUS_UPDATE',
                            blockId: b._id,
                            previousValue: 'IN_PROGRESS',
                            newValue: 'DRC',
                            message: `Status updated to DRC.`,
                            timestamp: new Date(b.createdAt.getTime() + (oneDay * 0.2))
                        });
                        await AuditLog.create({
                            userId: req.user.id,
                            userRole: req.user.role,
                            action: 'STATUS_UPDATE',
                            blockId: b._id,
                            previousValue: 'DRC',
                            newValue: 'LVS',
                            message: `Status updated to LVS.`,
                            timestamp: new Date(b.createdAt.getTime() + (oneDay * 2.5)) // 2.3 days in DRC
                        });
                    }
                }
            } catch (err) {
                console.error(`Failed to process demo block ${block._id}:`, err);
            }
        }));

        res.status(200).json({ success: true, message: 'Demo data loaded successfully' });
    } catch (error) {
        console.error("Critical error in loadDemoData:", error);
        res.status(500).json({ success: false, message: 'Failed to load demo data: ' + error.message });
    }
};
