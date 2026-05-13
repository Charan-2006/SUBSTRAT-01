const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
const { createNotification } = require('../utils/notifier');

/**
 * DETERMINISTIC SLA THRESHOLDS (Signal 2)
 */
const STAGE_SLA_THRESHOLDS = {
    'NOT_STARTED': 0,
    'IN_PROGRESS': 8,
    'DRC': 8,
    'LVS': 10,
    'REVIEW': 4,
    'COMPLETED': 0
};

/**
 * Calculate health status based on deterministic execution signals
 */
exports.calculateHealth = (block) => {
    if (!block) return { status: 'HEALTHY', score: 100, reasons: [] };

    if (block.status === 'COMPLETED') {
        return { status: 'HEALTHY', score: 100, reasons: [] };
    }

    let reasons = [];
    
    // SIGNAL 3: Manual Escalation
    const isEscalated = block.escalationState === 'ESCALATED' || block.escalationState === 'CRITICAL_ESCALATED';
    
    // SIGNAL 2: Stage Stagnation (SLA Drift)
    const baseExpected = STAGE_SLA_THRESHOLDS[block.status] || 8;
    let multiplier = 1.0;
    if (block.complexity === 'SIMPLE') multiplier = 0.7;
    else if (block.complexity === 'COMPLEX') multiplier = 1.4;
    else if (block.complexity === 'CRITICAL') multiplier = 1.8;

    let expectedHours = baseExpected * multiplier;
    const stageStartTime = block.stageStartTime || block.createdAt;
    const actualHours = (Date.now() - new Date(stageStartTime).getTime()) / (1000 * 60 * 60);
    const overrunRatio = expectedHours > 0 ? (actualHours / expectedHours) : 0;
    
    // SIGNAL 1: Rejection-Driven Criticality
    const rejections = block.rejectionCount || 0;
    
    // DETERMINISTIC HEALTH MAPPING
    let status = 'HEALTHY';

    // Rule: Escalation is instant CRITICAL
    if (isEscalated) {
        status = 'CRITICAL';
        reasons.push('Manual Escalation Triggered');
    } 
    // Rule: 3+ rejections is CRITICAL
    else if (rejections >= 3) {
        status = 'CRITICAL';
        reasons.push(`${rejections} execution rejections (CRITICAL)`);
    }
    // Rule: 50%+ SLA overrun is CRITICAL
    else if (overrunRatio >= 0.5) {
        status = 'CRITICAL';
        reasons.push(`Severe stage stagnation (>50% overrun)`);
    }
    // Rule: 1-2 rejections is CRITICAL
    else if (rejections >= 1) {
        status = 'CRITICAL';
        reasons.push(`${rejections} rejections (Elevated Pressure)`);
    }
    // Rule: 25%+ SLA overrun is CRITICAL
    else if (overrunRatio >= 0.25) {
        status = 'CRITICAL';
        reasons.push(`Stage stagnation (>25% overrun)`);
    }

    // BOTTLENECK Detection Layer (Signal 4)
    // Layered on top of CRITICAL if it blocks downstream
    const propagationRisk = (block.downstreamCount || 0) * 0.1 + (rejections * 0.2);
    if (status === 'CRITICAL' && (block.downstreamCount > 0) && propagationRisk > 0.3) {
        status = 'BOTTLENECK';
        reasons.push('Critical bottleneck impacting downstream orchestration');
    }

    // SIGNAL 6: Physical Complexity (Normalized Area Impact)
    const areaFactor = Math.sqrt(block.estimatedArea || 0) * 0.5; // Normalized gradual impact
    if (areaFactor > 15) status = 'CRITICAL'; // Large blocks are inherently risky

    // Telemetry and Scoring
    const totalScore = Math.max(0, 100 - (rejections * 25) - (overrunRatio * 50) - (isEscalated ? 40 : 0) - (areaFactor));

    return { 
        status, 
        score: Math.round(totalScore), 
        reasons,
        telemetry: {
            rejectionPressure: rejections * 20,
            stagnationIndex: Math.round(overrunRatio * 100),
            priorityRank: Math.round(totalScore),
            propagationImpact: Math.round(propagationRisk * 100),
            physicalComplexity: Math.round(areaFactor)
        }
    };
};

/**
 * Validate status transition
 */
exports.validateTransition = (currentStatus, nextStatus) => {
    const currentIndex = WORKFLOW_ORDER.indexOf(currentStatus);
    const nextIndex = WORKFLOW_ORDER.indexOf(nextStatus);

    if (nextIndex === -1) return { valid: false, message: 'Invalid status' };

    // Linear progression or rollback from Review
    if (currentStatus === 'REVIEW' && ['IN_PROGRESS', 'DRC', 'LVS'].includes(nextStatus)) {
        return { valid: true };
    }

    if (nextIndex !== currentIndex + 1) {
        return { 
            valid: false, 
            message: `Invalid transition from ${currentStatus} to ${nextStatus}. Sequential flow required.` 
        };
    }

    return { valid: true };
};

/**
 * CORE EXECUTION ENGINE: Resume Workflow Action
 */
exports.resumeWorkflow = async (block, allBlocks) => {
    const now = new Date();
    
    // 1. Handle Blocked State Resolution
    if (block.executionState === 'BLOCKED' || block.status === 'NOT_STARTED') {
        const { valid, message } = await exports.checkDependencyResolution(block, allBlocks);
        if (!valid) {
            block.executionState = 'BLOCKED';
            return { success: false, message };
        }
    }

    // 2. Transition to IN_PROGRESS if not already
    if (block.executionState !== 'IN_PROGRESS') {
        block.executionState = 'IN_PROGRESS';
        if (block.status === 'NOT_STARTED') {
            block.status = 'IN_PROGRESS';
            block.stageStartTime = now;
        }
        await block.save();
        return { success: true, message: `Workflow ${block.name} resumed execution.`, block };
    }

    // 3. Toggle Execution State
    block.isExecuting = !block.isExecuting;
    
    if (block.isExecuting) {
        block.executionState = 'IN_PROGRESS';
        if (block.status === 'NOT_STARTED') {
            block.status = 'IN_PROGRESS';
            block.stageStartTime = now;
        }
    } else {
        block.executionState = 'READY';
    }

    await block.save();
    
    // 5. Global Propagation: If this block reached a state that might unblock others
    const unblockedCount = await exports.propagateWorkflowChanges(block, allBlocks);

    return { 
        success: true, 
        message: block.progress >= 100 ? `Stage advanced to ${block.status}` : `Execution progressed to ${block.progress}%`,
        unblockedCount,
        block 
    };
};

/**
 * Check if all dependencies are completed
 */
exports.checkDependencyResolution = async (block, allBlocks) => {
    // Refresh dependencies if they are just IDs
    const dependencies = block.dependencies || [];
    
    for (const depId of dependencies) {
        const dep = allBlocks.find(b => b._id.toString() === (depId._id || depId).toString());
        if (dep && dep.status !== 'COMPLETED') {
            return { valid: false, message: `Blocked by upstream dependency: ${dep.name}` };
        }
    }
    
    return { valid: true };
};

/**
 * Cascading Orchestration: Unblock downstream nodes
 */
exports.propagateWorkflowChanges = async (sourceBlock, allBlocks) => {
    let unblockedCount = 0;
    
    if (sourceBlock.status !== 'COMPLETED') return 0;
    
    const downstream = allBlocks.filter(b => 
        b.dependencies && b.dependencies.some(d => d.toString() === sourceBlock._id.toString())
    );
    
    for (const node of downstream) {
        const { valid } = await exports.checkDependencyResolution(node, allBlocks);
        if (valid && node.executionState === 'BLOCKED') {
            node.executionState = 'READY';
            await node.save();
            unblockedCount++;

            // Notify Assigned Engineer
            if (node.assignedEngineer) {
                await createNotification({
                    userId: node.assignedEngineer,
                    message: `Workflow Unblocked: All dependencies for ${node.name} are resolved.`,
                    type: 'DEPENDENCY_RESOLVED',
                    severity: 'medium',
                    actionUrl: `/workspace?blockId=${node._id}`,
                    blockId: node._id
                });
            }
        }
    }
    
    return unblockedCount;
};

/**
 * CORE EFFORT ESTIMATION ENGINE
 * Formula: estimated_hours = (base_hours_from_type * complexity_factor) + (estimated_area * area_weight)
 */
exports.calculateEstimation = (type, complexity, estimatedArea = 0) => {
    const factors = {
        'SIMPLE': 1.0,
        'MEDIUM': 1.5,
        'COMPLEX': 2.5,
        'CRITICAL': 4.0
    };
    
    // Base hours inferred from component type if explicit baseHours not provided
    const baseHoursMap = {
        'Mixed Signal': 12,
        'Digital': 8,
        'RF / PLL': 16,
        'Power Management': 14,
        'Memory': 20,
        'Clocking': 10
    };
    
    const factor = factors[complexity] || 1.0;
    const baseHours = baseHoursMap[type] || 10; // Default to 10 if type unknown
    const areaWeight = 0.2; 
    
    const baseEffort = baseHours * factor;
    const areaEffort = (estimatedArea || 0) * areaWeight;
    
    return Math.max(1, Math.round(baseEffort + areaEffort)); // NEVER allow 0h
};

exports.WORKFLOW_ORDER = WORKFLOW_ORDER;
exports.STAGE_SLA_THRESHOLDS = STAGE_SLA_THRESHOLDS;

