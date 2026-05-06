const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

const STAGE_CRITICALITY = {
    'DRC': 'HIGH',
    'LVS': 'HIGH',
    'REVIEW': 'MEDIUM',
    'IN_PROGRESS': 'LOW',
    'NOT_STARTED': 'LOW',
    'COMPLETED': 'LOW'
};

/**
 * Calculate estimated hours based on complexity and tech node
 */
exports.calculateEstimation = (complexity, techNode) => {
    let base = 20;
    switch (complexity) {
        case 'MEDIUM': base = 40; break;
        case 'COMPLEX': base = 60; break;
        case 'CRITICAL': base = 80; break;
        default: base = 20; // SIMPLE
    }

    let multiplier = 1.0;
    if (techNode === '12nm') multiplier = 1.2;
    if (techNode === '7nm') multiplier = 1.3;
    if (techNode === '5nm') multiplier = 1.5; // Added for future proofing

    return Math.round(base * multiplier);
};

/**
 * Calculate health status based on time spent and rejections
 */
exports.calculateHealth = (block) => {
    let status = 'HEALTHY';
    let reasons = [];

    const estimatedHours = block.estimatedHours || 0;
    if (estimatedHours === 0 || block.status === 'NOT_STARTED' || block.status === 'COMPLETED') {
        return { status: 'HEALTHY', reasons: [] };
    }

    // Time spent in current stage
    const stageStartTime = block.stageStartTime || block.createdAt;
    const timeSpentInStage = (Date.now() - stageStartTime.getTime()) / (1000 * 60 * 60);
    
    // We assume the total estimated hours is distributed across stages.
    // For simplicity, let's say each stage should take roughly 20% of total time.
    const expectedStageTime = estimatedHours * 0.2;

    // Base status on time
    if (timeSpentInStage > expectedStageTime * 1.5) {
        status = 'CRITICAL';
        reasons.push(`Time in ${block.status} (${timeSpentInStage.toFixed(1)}h) >> expected (${expectedStageTime.toFixed(1)}h)`);
    } else if (timeSpentInStage > expectedStageTime) {
        status = 'RISK';
        reasons.push(`Time in ${block.status} (${timeSpentInStage.toFixed(1)}h) > expected (${expectedStageTime.toFixed(1)}h)`);
    }

    // Impact of rejections
    if (block.rejectionCount >= 2) {
        status = 'CRITICAL';
        reasons.push(`${block.rejectionCount} rejections reached`);
    } else if (block.rejectionCount === 1) {
        // Increase risk level by one step
        if (status === 'HEALTHY') {
            status = 'RISK';
            reasons.push('Increased risk due to rejection');
        } else if (status === 'RISK') {
            status = 'CRITICAL';
            reasons.push('Critical status reached due to delay and rejection');
        }
    }

    return { status, reasons };
};

/**
 * Validate status transition
 */
exports.validateTransition = (currentStatus, nextStatus) => {
    const currentIndex = WORKFLOW_ORDER.indexOf(currentStatus);
    const nextIndex = WORKFLOW_ORDER.indexOf(nextStatus);

    if (nextIndex === -1) return { valid: false, message: 'Invalid status' };

    // Linear progression only
    if (nextIndex !== currentIndex + 1) {
        return { 
            valid: false, 
            message: `Invalid transition from ${currentStatus} to ${nextStatus}. You must follow the sequence: ${WORKFLOW_ORDER.join(' → ')}` 
        };
    }

    return { valid: true };
};

exports.WORKFLOW_ORDER = WORKFLOW_ORDER;
exports.STAGE_CRITICALITY = STAGE_CRITICALITY;
