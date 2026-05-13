import { STAGES, HEALTH_STATES } from '../constants/workflowStates';

/**
 * 1. DETERMINISTIC SLA ENGINE
 * Stage duration expectations are now fixed for high-fidelity orchestration.
 */
export const STAGE_SLA_THRESHOLDS = {
    [STAGES.NOT_STARTED]: 0,
    [STAGES.IN_PROGRESS]: 8,
    [STAGES.DRC]: 12,
    [STAGES.LVS]: 14,
    [STAGES.REVIEW]: 4,
    [STAGES.COMPLETED]: 0
};

export const calculateEstimation = (type, complexity, estimatedArea = 0) => {
    const factors = {
        'SIMPLE': 1.0,
        'MEDIUM': 1.5,
        'COMPLEX': 2.5,
        'CRITICAL': 4.0
    };
    
    // Base hours inferred from component type
    const baseHoursMap = {
        'Mixed Signal': 12,
        'Digital': 8,
        'RF / PLL': 16,
        'Power Management': 14,
        'Memory': 20,
        'Clocking': 10
    };
    
    const factor = factors[complexity] || 1.0;
    const baseHours = baseHoursMap[type] || 10;
    const areaWeight = 0.2; 
    
    const baseEffort = baseHours * factor;
    const areaEffort = (Number(estimatedArea) || 0) * areaWeight;
    
    return Math.max(1, Math.round(baseEffort + areaEffort));
};

export const getDomainIndex = (type) => {
    if (!type) return 0;
    const t = String(type.type || type || '').toUpperCase();
    if (t.includes('PLL') || t.includes('ADC')) return 1;
    if (t.includes('ANALOG') || t.includes('BANDGAP')) return 2;
    if (t.includes('LOGIC') || t.includes('SRAM')) return 3;
    return 0;
};

export function calculatePropagationImpact(block, allBlocks) {
    if (!block || !allBlocks) return { risk: 0, state: 'STABLE' };
    
    const findDownstreamCount = (b, visited = new Set()) => {
        const bId = b._id || b.id;
        const downstream = allBlocks.filter(other => 
            (other.dependencies || []).some(d => (d._id || d || d) === bId) && !visited.has(other._id || other.id)
        );
        let count = downstream.length;
        downstream.forEach(d => {
            visited.add(d._id || d.id);
            count += findDownstreamCount(d, visited);
        });
        return count;
    };

    const impactCount = findDownstreamCount(block);
    const sla = calculateSLA(block);
    const rejections = block.rejectionCount || 0;
    
    let baseRisk = (impactCount * 8) + (sla.overrun * 25) + (rejections * 10);
    if (block.health === HEALTH_STATES.BOTTLENECK) baseRisk += 30;
    if (block.health === HEALTH_STATES.CRITICAL) baseRisk += 15;
    
    const risk = Math.min(100, Math.round(baseRisk));
    
    let state = 'STABLE';
    if (risk > 70 || block.health === HEALTH_STATES.BOTTLENECK) state = 'CASCADING';
    else if (risk > 40 || block.health === HEALTH_STATES.CRITICAL) state = 'BLOCKED';
    else if (risk > 20) state = 'AT_RISK';

    return { risk, state, impactCount, orchestrationState: state };
}

export function calculateEngineerEffectiveness(engineer, targetBlock) {
    if (!engineer || !targetBlock) return 0;
    const blockType = (targetBlock.type || targetBlock.name || '').toUpperCase();
    
    // Use real metadata from engineer object if available, otherwise base on role
    let speed = engineer.speedFactor || (engineer.role?.toUpperCase() === 'SENIOR' ? 1.2 : 1.0);
    let score = speed * 70;
    
    // Contextual expertise check
    const expertise = engineer.expertise || [];
    const isExpert = expertise.some(e => blockType.includes(e.toUpperCase()));
    if (isExpert) score += 20;

    return Math.min(100, Math.round(score));
}

export function calculateSLA(workflow) {
    if (!workflow) return { actualHours: 0, expectedHours: 0, delayHours: 0, overrun: 0, isStagnant: false };
    
    let baseExpected = STAGE_SLA_THRESHOLDS[workflow.status] || 8;
    
    let multiplier = 1.0;
    const complexity = workflow.complexity || 'MEDIUM';
    if (complexity === 'SIMPLE') multiplier = 0.7;
    if (complexity === 'COMPLEX') multiplier = 1.4;
    if (complexity === 'CRITICAL') multiplier = 1.8;

    let expectedHours = baseExpected * multiplier;
    
    // Stage-specific Duration (for SLA monitoring)
    let actualHours = 0;
    if (workflow.stageStartTime && workflow.status !== STAGES.COMPLETED && workflow.status !== STAGES.NOT_STARTED) {
        const start = new Date(workflow.stageStartTime).getTime();
        actualHours = (Date.now() - start) / (1000 * 60 * 60);
    } else if (workflow.status === STAGES.COMPLETED) {
        // For completed blocks, SLA check is against the last stage in history or 0
        const lastStage = workflow.stageHistory?.[workflow.stageHistory.length - 1];
        actualHours = lastStage?.durationHours || 0;
    }

    const delayHours = Math.max(0, actualHours - expectedHours);
    const overrun = expectedHours > 0 ? (delayHours / expectedHours) : 0;
    
    return {
        actualHours: Math.round(actualHours * 10) / 10, 
        expectedHours: Math.round(expectedHours * 10) / 10,
        delayHours: Math.round(delayHours * 10) / 10,
        overrun: Math.round(overrun * 100) / 100,
        isStagnant: overrun > 0.25
    };
}

export function calculatePriorityScore(workflow, blocks = []) {
    if (!workflow || workflow.status === STAGES.COMPLETED || workflow.isReleased) return 0;
    
    let score = 10; 
    
    const isEscalated = workflow.escalated || workflow.escalationState === 'ESCALATED' || workflow.escalationState === 'CRITICAL_ESCALATED';
    const isBottleneck = workflow.health === HEALTH_STATES.BOTTLENECK;
    const isUnassigned = !workflow.assignedEngineer;
    
    // Extreme Priority Overrides
    if (isUnassigned) return 200;
    if (isEscalated && isBottleneck) return 150;
    if (isBottleneck) return 130;
    if (isEscalated) return 110;
    
    // 1. Escalation (Weight: 35)
    if (isEscalated) {
        score += 35;
    }
    
    // 2. Rejections (Weight: 15)
    const rejections = workflow.rejectionCount || 0;
    score += Math.min(15, rejections * 7.5);
    
    // 3. SLA Overrun (Weight: 20)
    const sla = calculateSLA(workflow);
    score += Math.min(20, sla.overrun * 20);
    
    // 4. Downstream Impact (Weight: 15)
    const wId = workflow._id || workflow.id;
    const downstream = blocks.filter(w => 
        w.dependencies && w.dependencies.some(d => (d._id || d || d) === wId)
    );
    score += Math.min(15, downstream.length * 5);
    
    // 5. Stage Criticality (Weight: 10)
    const stageWeight = {
        [STAGES.REVIEW]: 10,
        [STAGES.LVS]: 8,
        [STAGES.DRC]: 6,
        [STAGES.IN_PROGRESS]: 4,
        [STAGES.NOT_STARTED]: 2
    };
    score += (stageWeight[workflow.status] || 0);

    // 6. Complexity (Weight: 5)
    if (workflow.complexity === 'CRITICAL') score += 5;
    else if (workflow.complexity === 'COMPLEX') score += 3;
    
    // 7. Area Normalization (Weight: 10)
    const areaFactor = Math.sqrt(workflow.estimatedArea || 0) * 0.2;
    score += Math.min(10, areaFactor);

    return Math.min(100, Math.round(score));
}

export function calculateHealth(workflow, allWorkflows = []) {
    if (!workflow || workflow.status === STAGES.COMPLETED) return HEALTH_STATES.HEALTHY;
    
    const rejections = workflow.rejectionCount || 0;
    const sla = calculateSLA(workflow);
    const isEscalated = workflow.escalationState === 'ESCALATED' || workflow.escalationState === 'CRITICAL_ESCALATED';
    
    // SIGNAL 3: Manual Escalation (Instant CRITICAL)
    if (isEscalated) return HEALTH_STATES.CRITICAL;
    
    // SIGNAL 1: Rejection-Driven Criticality
    if (rejections >= 3) return HEALTH_STATES.CRITICAL;
    
    // SIGNAL 2: Stage Stagnation (Breached SLA)
    if (sla.overrun >= 0.5) return HEALTH_STATES.CRITICAL;
    if (sla.overrun >= 0.2) return HEALTH_STATES.CRITICAL;

    // SIGNAL 4: Dependency Blockage
    const isBlocked = calculateBlockedState(workflow, allWorkflows);
    if (isBlocked) return HEALTH_STATES.BLOCKED;

    // SIGNAL 5: Engineer Overload Influence
    if (workflow.assignedEngineer) {
        const engId = workflow.assignedEngineer?._id || workflow.assignedEngineer;
        const load = calculateEngineerLoad(engId, allWorkflows);
        if (load.isOverloaded && sla.overrun > 0.1) return HEALTH_STATES.CRITICAL;
    }

    if (rejections >= 1) return HEALTH_STATES.CRITICAL;
    if (sla.overrun > 0) return HEALTH_STATES.CRITICAL;

    return HEALTH_STATES.HEALTHY;
}

export function propagateOrchestrationState(allBlocks) {
    if (!allBlocks || allBlocks.length === 0) return [];

    const graph = allBlocks.map(b => ({
        ...b,
        dependencies: (b.dependencies || []).map(d => d?._id || d || d).filter(Boolean),
        downstream: b._id ? allBlocks.filter(other => 
            (other.dependencies || []).some(d => (d?._id || d || d) === b._id)
        ).map(other => other._id).filter(Boolean) : [],
        inheritedDelay: 0,
        inheritedRisk: 0,
        inheritedBlockers: [],
        priorityScore: 0
    }));

    const nodeMap = new Map(graph.filter(n => n._id).map(n => [n._id, n]));

    const propagate = (nodeId, sourceId, risk, delay, depth) => {
        if (depth > 5) return; 
        const node = nodeMap.get(nodeId);
        if (!node) return;

        const damping = Math.pow(0.8, depth);
        const propagatedRisk = risk * damping;
        const propagatedDelay = delay * damping;

        if (propagatedRisk > node.inheritedRisk) {
            node.inheritedRisk = propagatedRisk;
            if (sourceId && !node.inheritedBlockers.includes(sourceId)) {
                node.inheritedBlockers.push(sourceId);
            }
        }
        node.inheritedDelay = Math.max(node.inheritedDelay, propagatedDelay);

        node.downstream.forEach(childId => {
            propagate(childId, sourceId || nodeId, risk, delay, depth + 1);
        });
    };

    graph.forEach(node => {
        if (node.status === STAGES.COMPLETED) return;
        
        const sla = calculateSLA(node);
        const rejections = node.rejectionCount || 0;
        const isEscalated = node.escalationState === 'ESCALATED' || node.escalationState === 'CRITICAL_ESCALATED';
        
        let risk = (rejections * 0.3) + (sla.overrun * 0.4);
        if (isEscalated) risk += 0.5;
        
        if (risk > 0.15) {
            node.downstream.forEach(childId => {
                propagate(childId, node._id, risk, sla.delayHours, 1);
            });
        }
    });

    graph.forEach(node => {
        const health = calculateHealth(node, graph);
        node.health = health;
        
        const isBlocked = calculateBlockedState(node, graph);
        node.isBlocked = isBlocked;

        const sla = calculateSLA(node);

        // BOTTLENECK Logic: Critical node that blocks others
        const isStalled = node.status !== STAGES.COMPLETED && 
            (node.status === STAGES.REVIEW || 
             sla.overrun > 0 || 
             (node.rejectionCount || 0) > 0 || 
             health === HEALTH_STATES.CRITICAL);
             
        if (isStalled && node.downstream.length > 0) {
            node.health = HEALTH_STATES.BOTTLENECK;
        }

        node.priorityScore = calculatePriorityScore(node, graph);
        
        const pressure = calculatePressureIndex(node, graph);
        const propagation = calculatePropagationImpact(node, graph);
        
        node.telemetry = {
            executionPressure: pressure,
            propagationRisk: propagation.risk,
            downstreamImpact: node.downstream.length,
            delayContribution: sla.delayHours,
            rejectionPressure: (node.rejectionCount || 0) * 20,
            stagnationIndex: Math.round(sla.overrun * 100),
            priorityRank: node.priorityScore,
            inheritedDelay: Math.round(node.inheritedDelay * 10) / 10
        };
    });

    return graph.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}

export function calculateDependencyImpact(workflow, allWorkflows = []) {
    if (!workflow || !allWorkflows) return { upstream: [], downstream: [], allUpstream: [], allDownstream: [] };
    
    const nodeMap = new Map(allWorkflows.map(w => [w._id || w.id, w]));
    const wId = workflow._id || workflow.id;
    const upstream = (workflow.dependencies || []).map(id => nodeMap.get(id?._id || id || id)).filter(Boolean).filter(u => u.status !== 'COMPLETED');
    const downstream = allWorkflows.filter(w => (w.dependencies || []).some(d => (d?._id || d || d) === wId)).filter(d => d.status !== 'COMPLETED');
    
    const getAllUpstream = (w, visited = new Set()) => {
        const deps = (w.dependencies || []).map(id => id?._id || id || id).filter(id => !visited.has(id));
        let results = [...deps];
        deps.forEach(id => {
            visited.add(id);
            const depNode = nodeMap.get(id);
            if (depNode) results = [...results, ...getAllUpstream(depNode, visited)];
        });
        return results;
    };

    const getAllDownstream = (w, visited = new Set()) => {
        const id = w._id || w.id;
        const deps = allWorkflows.filter(other => 
            (other.dependencies || []).some(d => (d?._id || d || d) === id) && !visited.has(other._id || other.id)
        );
        let results = deps.map(d => d._id || d.id);
        deps.forEach(d => {
            visited.add(d._id || d.id);
            results = [...results, ...getAllDownstream(d, visited)];
        });
        return results;
    };
    
    return { 
        upstream, 
        downstream, 
        allUpstream: [...new Set(getAllUpstream(workflow))],
        allDownstream: [...new Set(getAllDownstream(workflow))]
    };
}

export function calculateBlockedState(workflow, allWorkflows) {
    if (!workflow || workflow.status === STAGES.COMPLETED) return false;
    const { upstream } = calculateDependencyImpact(workflow, allWorkflows);
    return upstream.some(u => u.status !== STAGES.COMPLETED);
}

export function calculateEngineerLoad(engineerId, allBlocks) {
    const assigned = allBlocks.filter(b => (b.assignedEngineer?._id || b.assignedEngineer)?.toString() === engineerId?.toString() && b.status !== STAGES.COMPLETED);
    const critical = assigned.filter(b => b.health === HEALTH_STATES.CRITICAL || b.health === HEALTH_STATES.BOTTLENECK);
    return { 
        activeCount: assigned.length, 
        criticalCount: critical.length,
        isOverloaded: assigned.length >= 5 
    };
}

export function aggregateKPIs(blocks, engineers = []) {
    const total = blocks.length;
    let healthy = 0, warning = 0, critical = 0, bottlenecks = 0;
    
    let totalEst = 0;
    let totalAct = 0;
    let totalRem = 0;
    
    let overdueCount = 0;
    let totalUnassigned = 0;
    let breachedBlocks = [];
    
    let dependencyPressure = 0;
    let highestPropagationRiskBlock = null;

    const activeEngIds = new Set();
    const ACTIVE_STAGES = [STAGES.IN_PROGRESS, STAGES.DRC, STAGES.LVS, STAGES.REVIEW];

    blocks.forEach(b => {
        const health = b.health || calculateHealth(b, blocks);
        if (health === HEALTH_STATES.HEALTHY) healthy++;
        else if (health === HEALTH_STATES.WARNING) warning++; 
        else if (health === HEALTH_STATES.CRITICAL) critical++;
        else if (health === HEALTH_STATES.BOTTLENECK) bottlenecks++;
        
        if (!b.assignedEngineer && b.status !== STAGES.COMPLETED) totalUnassigned++;

        const estHours = (b.estimatedDurationHours || 0);
        const actHours = (b.actualDurationHours || 0);
        
        totalAct += actHours;
        totalEst += estHours;

        if (b.status !== STAGES.COMPLETED) {
            totalRem += Math.max(estHours - actHours, 0);
        }

        const sla = calculateSLA(b);
        
        // E. SLA Breach Detection
        // A block is "Breached" if Total Act > Total Est OR Stage Overrun > 0
        const totalOverrun = actHours > estHours;
        const stageOverrun = sla.overrun > 0;
        
        if (totalOverrun || stageOverrun) {
            overdueCount++;
            breachedBlocks.push(b);
        }

        if (b.assignedEngineer && ACTIVE_STAGES.includes(b.status)) {
            activeEngIds.add(b.assignedEngineer?._id || b.assignedEngineer);
        }

        if (b.downstream && b.downstream.length > 0) {
            let weight = 1;
            if (health === HEALTH_STATES.CRITICAL) weight = 2;
            if (health === HEALTH_STATES.BOTTLENECK) weight = 3;
            if (b.status === STAGES.COMPLETED) weight = 0;
            dependencyPressure += (b.downstream.length * weight);
        }

        if ((b.telemetry?.propagationRisk || 0) > (highestPropagationRiskBlock?.telemetry?.propagationRisk || 0)) {
            highestPropagationRiskBlock = b;
        }
    });

    const totalVariance = totalAct - totalEst;
    const breachedPercentage = total > 0 ? Math.round((overdueCount / total) * 100) : 0;
    
    // Sort by Absolute Drift (Variance) then by Stage Overrun
    const highestDriftWorkflow = [...breachedBlocks].sort((a,b) => {
        const driftB = (b.actualDurationHours || 0) - (b.estimatedDurationHours || 0);
        const driftA = (a.actualDurationHours || 0) - (a.estimatedDurationHours || 0);
        if (Math.abs(driftB - driftA) > 0.1) return driftB - driftA;
        return calculateSLA(b).overrun - calculateSLA(a).overrun;
    })[0] || null;

    // D. Team Utilization calculation
    // Fallback to 10 if engineers array is missing to prevent 100% or infinity
    const totalAvailableEngineers = engineers.length > 0 ? engineers.length : Math.max(activeEngIds.size, 10); 
    const avgUtilization = (activeEngIds.size / totalAvailableEngineers) * 100;

    // Retain legacy util calculation for specific component compatibility
    const utilization = engineers.length > 0 ? calculateEngineerUtilization(engineers, blocks) : [];
    const overloadedEngineers = utilization.filter(u => u.activeCount >= 5).length;

    return { 
        total, 
        healthy, 
        warning, 
        critical, 
        bottlenecks, 
        activeEngineers: activeEngIds.size,
        active: blocks.filter(b => b.status !== STAGES.COMPLETED && b.status !== STAGES.NOT_STARTED).length,
        
        totalEstimatedHours: Math.round(totalEst * 10) / 10,
        totalActualHours: Math.round(totalAct * 10) / 10,
        totalRemainingEffort: Math.round(totalRem * 10) / 10,
        totalVariance: Math.round(totalVariance * 10) / 10,
        
        totalUnassigned,
        overloadedEngineers,
        overdueCount,
        breachedPercentage: Math.round(breachedPercentage),
        highestDriftWorkflow,
        
        avgUtilization: Math.round(avgUtilization),
        utilization,
        
        dependencyPressureScore: dependencyPressure,
        highestPropagationRiskBlock
    };
}

const PROGRESS_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

export function calculateProgress(block) {
    if (!block) return 0;
    if (block.status === 'COMPLETED') return 100;
    if (block.status === 'NOT_STARTED') return 0;
    
    const stageIndex = PROGRESS_ORDER.indexOf(block.status);
    if (stageIndex === -1) return 0;

    const sla = calculateSLA(block);
    const baseProgress = stageIndex * 20; 
    // Add micro-progress within the stage based on time spent vs expected
    const sessionProgress = Math.min(19, (sla.actualHours / sla.expectedHours) * 20);
    
    return Math.min(99, Math.round(baseProgress + sessionProgress));
}

export function calculateEngineerUtilization(engineers, allBlocks) {
    return engineers.map(eng => {
        const engId = (eng._id || eng).toString();
        const active = allBlocks.filter(b => {
            const bEngId = (b.assignedEngineer?._id || b.assignedEngineer)?.toString();
            return bEngId === engId && !['COMPLETED','NOT_STARTED'].includes(b.status);
        });
        const curr = Math.min(100, (active.length / 5) * 100);
        const weight = active.reduce((s, b) => s + (b.complexity === 'CRITICAL' ? 2 : b.complexity === 'COMPLEX' ? 1.5 : 1), 0);
        const proj = Math.min(100, (weight / 5) * 100);
        return { 
            id: engId,
            engineer: eng.displayName || 'Engineer', 
            currentUtil: Math.round(curr), 
            projectedUtil: Math.round(proj), 
            trend: proj > curr ? 'UP' : proj < curr ? 'DOWN' : 'STABLE', 
            activeCount: active.length 
        };
    });
}

export function formatDuration(h) {
    return (h === null || h === undefined || isNaN(h)) ? '0.0h' : `${h.toFixed(1)}h`;
}

export function getEngineerPerformance(engineer, allBlocks = []) {
    if (!engineer) return null;
    const engId = (engineer._id || engineer.id || engineer).toString();
    const assigned = allBlocks.filter(b => (b.assignedEngineer?._id || b.assignedEngineer)?.toString() === engId);
    const active = assigned.filter(b => b.status !== STAGES.COMPLETED);
    const completed = assigned.filter(b => b.status === STAGES.COMPLETED);
    
    let totalVariance = 0;
    completed.forEach(b => {
        const sla = calculateSLA(b);
        totalVariance += (sla.overrun || 0);
    });
    const avgOverrun = completed.length > 0 ? totalVariance / completed.length : 0;
    const onTimeRate = completed.length > 0 ? (completed.filter(b => calculateSLA(b).delayHours <= 0).length / completed.length) * 100 : 90;

    const totalRejections = assigned.reduce((s, b) => s + (b.rejectionCount || 0), 0);
    const rejectionRate = assigned.length > 0 ? totalRejections / assigned.length : 0;
    
    const speedFactor = engineer.speedFactor || 1.0;
    const efficiencyScore = Math.min(100, Math.max(10, Math.round((speedFactor * 60) + (onTimeRate * 0.4) - (rejectionRate * 20))));

    return {
        id: engId,
        name: engineer.displayName || 'Engineer',
        activeCount: active.length,
        completedCount: completed.length,
        efficiencyScore,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        onTimeRate: Math.round(onTimeRate),
        speedFactor,
        loadPercentage: Math.min(100, Math.round((active.length / 5) * 100))
    };
}

export function generateRecommendedAction(block, allBlocks = []) {
    if (!block) return { priority: 'LOW', text: 'System standing by.', label: 'None', action: 'NONE', variant: 'ghost' };
    
    const health = block.health || calculateHealth(block, allBlocks);
    const isBlocked = calculateBlockedState(block, allBlocks);
    const sla = calculateSLA(block);
    
    if (isBlocked) {
        return { 
            priority: 'HIGH', 
            text: `Critical Blockage: Waiting for upstream dependencies to complete.`,
            label: 'Resolve Blockers', 
            action: 'NONE', 
            variant: 'warning' 
        };
    }
    
    if (health === HEALTH_STATES.BOTTLENECK) {
        return { 
            priority: 'CRITICAL', 
            text: 'Systemic bottleneck detected. Immediate managerial intervention required.',
            label: 'Escalate Now', 
            action: 'ESCALATE', 
            variant: 'danger' 
        };
    }
    
    if (block.rejectionCount > 1) {
        return { 
            priority: 'HIGH', 
            text: `Repeated rejections (${block.rejectionCount}x). Technical alignment review recommended.`,
            label: 'Review Specs', 
            action: 'RETRY', 
            variant: 'danger' 
        };
    }
    
    if (sla.overrun > 0.1) {
        return { 
            priority: 'MEDIUM', 
            text: `SLA Variance detected (${sla.delayHours}h). Consider resource reallocation.`,
            label: 'Reassign Task', 
            action: 'REASSIGN', 
            variant: 'warning' 
        };
    }
    
    return { 
        priority: 'LOW', 
        text: 'Execution is nominal. No intervention required.',
        label: 'Monitor', 
        action: 'NONE', 
        variant: 'primary' 
    };
}

export function calculatePressureIndex(block, allBlocks = []) {
    if (!block) return 0;
    const sla = calculateSLA(block);
    const rejections = block.rejectionCount || 0;
    const isBlocked = calculateBlockedState(block, allBlocks);
    const downstreamCount = (block.downstream || []).length;
    
    // Normalize area impact to prevent it from overpowering SLA/Rejections
    const areaPressure = Math.sqrt(block.estimatedArea || 0) * 0.15;
    
    let score = (sla.overrun * 40) + (rejections * 15) + (downstreamCount * 5) + areaPressure;
    if (isBlocked) score += 20;
    if (block.health === HEALTH_STATES.BOTTLENECK) score += 25;
    
    return Math.min(100, Math.round(score));
}

export function calculateNodeConfidence(block, allBlocks = []) {
    if (!block) return 0;
    const sla = calculateSLA(block);
    const rejections = block.rejectionCount || 0;
    let score = 95 - (rejections * 15) - (sla.overrun * 20);
    if (block.isEscalated) score -= 10;
    return Math.max(5, Math.round(score));
}

export function calculateBottleneck(block, allBlocks = []) {
    return block.health === HEALTH_STATES.BOTTLENECK;
}

export function calculateVelocity(block) {
    if (!block || block.status === 'COMPLETED') return 0;
    const sla = calculateSLA(block);
    if (sla.actualHours === 0) return 1.0;
    return Math.round((sla.expectedHours / sla.actualHours) * 100) / 100;
}

export function calculateEfficiency(block) {
    if (!block || !block.estimatedDurationHours) return 100;
    const act = block.actualDurationHours || 0;
    const est = block.estimatedDurationHours;
    if (act === 0) return 100;
    return Math.max(0, Math.round((est / act) * 100));
}

export function getRecommendedEngineers(targetBlock, engineers = [], allBlocks = []) {
    if (!targetBlock || !engineers.length) return [];
    
    return engineers.map(eng => {
        const perf = getEngineerPerformance(eng, allBlocks) || { activeCount: 0, isOverloaded: false };
        let score = calculateEngineerEffectiveness(eng, targetBlock);
        let reason = "Standard performance profile.";
        
        if (perf.isOverloaded) {
            score -= 30;
            reason = "Engineer is currently overloaded.";
        } else if (perf.activeCount === 0) {
            score += 10;
            reason = "High availability.";
        } else {
            reason = "Optimal capacity.";
        }

        const typeMatch = (eng.expertise || []).some(e => targetBlock.type?.toUpperCase().includes(e.toUpperCase()));
        if (typeMatch) {
            score += 20;
            reason = "Domain expert match.";
        }

        return {
            id: eng._id || eng.id,
            name: eng.displayName || 'Engineer',
            score: Math.max(0, score),
            perf,
            reason
        };
    }).sort((a, b) => b.score - a.score);
}

export function findBestEngineer(targetBlock, engineers = [], allBlocks = []) {
    const recs = getRecommendedEngineers(targetBlock, engineers, allBlocks);
    return recs.length > 0 ? engineers.find(e => (e._id || e.id) === recs[0].id) : null;
}

export function runOrchestrationSimulation(blocks, engineers, targetId, engId, strat) {
    const targetBlock = blocks.find(b => (b._id || b.id) === targetId);
    const eng = engineers.find(e => (e._id || e.id) === engId);
    
    if (!targetBlock || !eng) return null;

    const baseDelay = calculateSLA(targetBlock).delayHours || 0;
    const isBottleneck = targetBlock.health === HEALTH_STATES.BOTTLENECK;
    
    let recoveryHours = 0;
    if (strat === 'SLA') recoveryHours = Math.min(baseDelay, 12);
    else if (strat === 'LOAD') recoveryHours = Math.min(baseDelay, 8);
    else if (strat === 'PATH') recoveryHours = Math.min(baseDelay, 16);
    
    if (recoveryHours === 0 && isBottleneck) recoveryHours = 8;
    if (recoveryHours === 0) recoveryHours = 4;

    const riskReduction = Math.min(40, recoveryHours * 2);
    const confidenceGain = Math.min(30, recoveryHours * 1.5);
    const bottleneckRecoveryProb = isBottleneck ? Math.min(95, 40 + recoveryHours * 5) : 100;

    const projectedState = {
        confidence: Math.min(100, (targetBlock.confidenceScore || 50) + confidenceGain),
        pressure: Math.max(0, (targetBlock.pressureScore || 50) - riskReduction)
    };

    const optimizedBlocks = blocks.map(b => {
        if ((b._id || b.id) === targetId) {
            return {
                ...b,
                assignedEngineer: eng,
                delayHours: Math.max(0, baseDelay - recoveryHours),
                health: isBottleneck && bottleneckRecoveryProb > 80 ? HEALTH_STATES.HEALTHY : b.health
            };
        }
        return b;
    });

    return {
        targetId,
        targetName: targetBlock.name,
        engineerName: eng.displayName,
        strategy: strat,
        recoveryHours: Math.round(recoveryHours * 10) / 10,
        confidenceGain: Math.round(confidenceGain),
        riskReduction: Math.round(riskReduction),
        bottleneckRecoveryProb: Math.round(bottleneckRecoveryProb),
        projectedState,
        optimizedBlocks
    };
}

export function validateBulkAction(action, selectedBlocks, allBlocks) {
    if (!selectedBlocks || selectedBlocks.length === 0) return false;
    
    switch (action) {
        case 'ASSIGN':
            return selectedBlocks.every(b => b.status !== 'COMPLETED');
        case 'ESCALATE':
            return selectedBlocks.every(b => b.status !== 'COMPLETED' && b.escalationState !== 'ESCALATED' && b.escalationState !== 'CRITICAL_ESCALATED');
        case 'APPROVE':
        case 'REJECT':
            return selectedBlocks.every(b => b.status === 'REVIEW');
        default:
            return false;
    }
}

/**
 * CIRCULAR DEPENDENCY DETECTION
 * Recursively checks if adding a dependency creates a cycle.
 */
export function hasCircularDependency(targetId, newDepId, allBlocks) {
    if (!targetId || !newDepId) return false;
    if (targetId === newDepId) return true;

    const visited = new Set();
    const stack = [newDepId];

    while (stack.length > 0) {
        const currentId = stack.pop();
        if (currentId === targetId) return true;
        if (visited.has(currentId)) continue;
        
        visited.add(currentId);
        const block = allBlocks.find(b => b._id === currentId || b.id === currentId);
        if (block && block.dependencies) {
            block.dependencies.forEach(d => {
                const dId = d._id || d.id || d;
                stack.push(dId);
            });
        }
    }

    return false;
}
