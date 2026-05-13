const Block = require('../models/Block');
const workflowService = require('./workflowService');

const User = require('../models/User');
const { createNotification } = require('../utils/notifier');

let simulationInterval = null;
let healthCheckInterval = null;

const startSimulation = () => {
    if (simulationInterval) return;
    
    console.log('[Simulation Engine] Starting live execution simulator...');
    simulationInterval = setInterval(async () => {
        try {
            const executingBlocks = await Block.find({ isExecuting: true });
            if (executingBlocks.length === 0) return;
            
            const allBlocks = await Block.find().populate('dependencies').populate('blockedBy');
            
            for (let block of executingBlocks) {
                // Verify it's still unblocked
                const { valid } = await workflowService.checkDependencyResolution(block, allBlocks);
                if (!valid) {
                    block.isExecuting = false;
                    block.executionState = 'BLOCKED';
                    await block.save();
                    continue;
                }

                // Calculate progress increment
                const baseIncrement = 5; // 5% per tick
                const complexityWeight = { 'SIMPLE': 1.2, 'MEDIUM': 1.0, 'COMPLEX': 0.8, 'CRITICAL': 0.6 };
                const weight = complexityWeight[block.complexity] || 1.0;
                const jitter = 0.9 + (Math.random() * 0.2);
                
                const increment = Math.round(baseIncrement * weight * jitter);
                block.progress = Math.min(100, (block.progress || 0) + increment);
                block.actualDurationHours = (block.actualDurationHours || 0) + (increment * 0.1);
                
                const now = new Date();

                if (block.progress >= 100) {
                    const currentIndex = workflowService.WORKFLOW_ORDER.indexOf(block.status);
                    const nextStatus = workflowService.WORKFLOW_ORDER[currentIndex + 1];
                    
                    if (nextStatus) {
                        const stageDurationHours = (now - block.stageStartTime) / (1000 * 60 * 60);
                        block.stageHistory.push({
                            stage: block.status,
                            startTime: block.stageStartTime,
                            endTime: now,
                            durationHours: stageDurationHours
                        });
                        
                        block.status = nextStatus;
                        block.stageStartTime = now;
                        block.progress = 0;
                        
                        if (nextStatus === 'REVIEW') {
                            block.executionState = 'IN_REVIEW';
                            block.isExecuting = false;
                        } else if (nextStatus === 'COMPLETED') {
                            block.executionState = 'COMPLETE';
                            block.progress = 100;
                            block.isExecuting = false;
                        } else {
                            block.executionState = 'READY';
                            block.isExecuting = false; // Auto-pause after stage completion
                        }
                    }
                }

                await block.save();
                await workflowService.propagateWorkflowChanges(block, allBlocks);
            }
        } catch (err) {
            console.error('[Simulation Engine] Error:', err);
        }
    }, 2000); // Tick every 2 seconds

    // Phase 2: Global Health Monitor (SLA & Bottlenecks)
    console.log('[Simulation Engine] Starting orchestration health monitor...');
    healthCheckInterval = setInterval(async () => {
        try {
            const allBlocks = await Block.find().populate('assignedEngineer').populate('createdBy');
            const managers = await User.find({ role: 'Manager' });

            for (const block of allBlocks) {
                if (block.status === 'COMPLETED') continue;

                const health = workflowService.calculateHealth(block);
                
                // 1. Bottleneck Alert
                if (health.status === 'BOTTLENECK') {
                    // Notify Manager(s)
                    for (const manager of managers) {
                        await createNotification({
                            userId: manager._id,
                            message: `Systemic Bottleneck: ${block.name} is stalling downstream execution.`,
                            type: 'BOTTLENECK',
                            severity: 'critical',
                            actionUrl: `/workspace?blockId=${block._id}`,
                            blockId: block._id
                        });
                    }
                }

                // 2. SLA Violation
                const sla = {
                    expected: (workflowService.STAGE_SLA_THRESHOLDS[block.status] || 8),
                    actual: (Date.now() - new Date(block.stageStartTime || block.createdAt).getTime()) / (1000 * 60 * 60)
                };

                if (sla.actual > sla.expected * 1.5) { // 50% overrun
                    // SLA breach notification for engineers disabled per user request
                    /*
                    if (block.assignedEngineer) {
                        await createNotification({
                            userId: block.assignedEngineer._id || block.assignedEngineer,
                            message: `SLA Breach: ${block.name} has exceeded expected duration by 50%.`,
                            type: 'SLA_VIOLATION',
                            severity: 'high',
                            actionUrl: `/workspace?blockId=${block._id}`,
                            blockId: block._id
                        });
                    }
                    */
                    
                    // Notify Manager - Disabled per user request to reduce dashboard noise
                    /*
                    const creatorId = block.createdBy?._id || block.createdBy;
                    if (creatorId) {
                        await createNotification({
                            userId: creatorId,
                            message: `SLA Critical: ${block.name} is severely delayed.`,
                            type: 'SLA_VIOLATION',
                            severity: 'high',
                            actionUrl: `/workspace?blockId=${block._id}`,
                            blockId: block._id
                        });
                    }
                    */
                }
            }
        } catch (err) {
            console.error('[Health Monitor] Error:', err);
        }
    }, 10000); // Check every 10 seconds
};

module.exports = {
    startSimulation
};
