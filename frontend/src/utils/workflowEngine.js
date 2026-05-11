import { STAGES, HEALTH_STATES } from '../constants/workflowStates';

/**
 * 1. DETERMINISTIC SLA ENGINE
 * Stage duration expectations are now fixed for high-fidelity orchestration.
 */
export const STAGE_SLA_THRESHOLDS = {
    [STAGES.NOT_STARTED]: 0,
    [STAGES.IN_PROGRESS]: 8,  // User: DRC=8, but let's map IN_PROGRESS to 8 as well
    [STAGES.DRC]: 8,
    [STAGES.LVS]: 10,
    [STAGES.REVIEW]: 4,
    [STAGES.COMPLETED]: 0
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
    
    // Recursive downstream depth
    const findDownstreamCount = (b, visited = new Set()) => {
        const downstream = allBlocks.filter(other => 
            (other.dependencies || []).some(d => (d._id || d) === b._id) && !visited.has(other._id)
        );
        let count = downstream.length;
        downstream.forEach(d => {
            visited.add(d._id);
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
    const name = engineer.displayName || engineer.username || 'Engineer';
    let speed = 1.0;
    if (name.includes('Charan')) speed = 1.3;
    let score = speed * 70;
    if (blockType.includes('ANALOG') || blockType.includes('PLL')) score += 20;
    return Math.min(100, Math.round(score));
}

export function calculateSLA(workflow) {
    if (!workflow) return { actualHours: 0, expectedHours: 0, delayHours: 0, overrun: 0, stagnationPenalty: 0 };
    
    // Fixed Stage Durations
    let baseExpected = STAGE_SLA_THRESHOLDS[workflow.status] || 8;
    
    // Complexity Multipliers
    let multiplier = 1.0;
    const complexity = workflow.complexity || 'MEDIUM';
    if (complexity === 'SIMPLE') multiplier = 0.7;
    if (complexity === 'COMPLEX') multiplier = 1.4;
    if (complexity === 'CRITICAL') multiplier = 1.8;

    let expectedHours = baseExpected * multiplier;
    
    // Actual Duration Calculation
    let actualHours = workflow.actualDurationHours || 0;
    if (workflow.stageStartTime && workflow.status !== STAGES.COMPLETED && !workflow.actualDurationHours) {
        const start = new Date(workflow.stageStartTime).getTime();
        actualHours = (Date.now() - start) / (1000 * 60 * 60);
    }

    const delayHours = Math.max(0, actualHours - expectedHours);
    const overrun = expectedHours > 0 ? (delayHours / expectedHours) : 0;
    
    // Stagnation Detection (Signal 2)
    // Exceeded by 25% = WARNING (handled in calculateHealth)
    // Exceeded by 50% = CRITICAL (handled in calculateHealth)
    
    return {
        actualHours: Math.round(actualHours * 10) / 10, 
        expectedHours: Math.round(expectedHours * 10) / 10,
        delayHours: Math.round(delayHours * 10) / 10,
        overrun: Math.round(overrun * 100) / 100,
        isStagnant: overrun > 0.25
    };
}

/**
 * 2. PRIORITY & RANKING ENGINE
 * Calculates a deterministic priorityScore [0-100] for queue sorting.
 */
export function calculatePriorityScore(workflow, blocks = []) {
    if (!workflow || workflow.status === STAGES.COMPLETED) return 0;
    
    let score = 20; // Base score
    
    // 1. Escalation Boost (Signal 3)
    if (workflow.escalationState === 'ESCALATED' || workflow.escalationState === 'CRITICAL_ESCALATED') {
        score += 40;
    }
    
    // 2. Rejection Pressure (Signal 1)
    const rejections = workflow.rejectionCount || 0;
    score += (rejections * 10);
    
    // 3. SLA Drift (Signal 2)
    const sla = calculateSLA(workflow);
    score += Math.min(20, sla.overrun * 15);
    
    // 4. Downstream Impact
    const downstream = blocks.filter(w => 
        w.dependencies && w.dependencies.some(d => (d._id || d) === (workflow._id || workflow))
    );
    score += Math.min(15, downstream.length * 4);
    
    // 5. Complexity weighting
    if (workflow.complexity === 'CRITICAL') score += 10;
    if (workflow.complexity === 'COMPLEX') score += 5;

    return Math.min(100, score);
}

/**
 * 3. CORE HEALTH ENGINE (Signal-Driven)
 */
export function calculateHealth(workflow, allWorkflows) {
    if (!workflow || workflow.status === STAGES.COMPLETED) return HEALTH_STATES.HEALTHY;
    
    const rejections = workflow.rejectionCount || 0;
    const sla = calculateSLA(workflow);
    const isEscalated = workflow.escalationState === 'ESCALATED' || workflow.escalationState === 'CRITICAL_ESCALATED';
    
    // SIGNAL 3: Manual Escalation (Instant CRITICAL)
    if (isEscalated) return HEALTH_STATES.CRITICAL;
    
    // SIGNAL 1: Rejection-Driven Criticality
    if (rejections >= 3) return HEALTH_STATES.CRITICAL;
    if (rejections >= 1) return HEALTH_STATES.WARNING;
    
    // SIGNAL 2: Stage Stagnation
    if (sla.overrun >= 0.5) return HEALTH_STATES.CRITICAL;
    if (sla.overrun >= 0.25) return HEALTH_STATES.WARNING;

    // SIGNAL 4: Inherited Propagation Risk
    const propagationRisk = workflow.inheritedRisk || 0;
    if (propagationRisk > 0.6) return HEALTH_STATES.CRITICAL;
    if (propagationRisk > 0.3) return HEALTH_STATES.WARNING;

    // Recovery Stabilization Window
    // If it was CRITICAL and rejections were reset, it stays WARNING for a "cooldown"
    if (workflow.lastHealth === HEALTH_STATES.CRITICAL && workflow.status !== STAGES.NOT_STARTED) {
        // Simple stabilization: stays warning until next successful stage transition
        return HEALTH_STATES.WARNING;
    }

    return HEALTH_STATES.HEALTHY;
}

/**
 * 4. DETERMINISTIC ORCHESTRATION PROPAGATION
 */
export function propagateOrchestrationState(allBlocks) {
    if (!allBlocks || allBlocks.length === 0) return [];

    // 1. Initial Pass: Calculate Base Metrics for all nodes
    const graph = allBlocks.map(b => ({
        ...b,
        dependencies: (b.dependencies || []).map(d => d?._id || d).filter(Boolean),
        downstream: b._id ? allBlocks.filter(other => 
            (other.dependencies || []).some(d => (d?._id || d) === b._id)
        ).map(other => other._id).filter(Boolean) : [],
        inheritedDelay: 0,
        inheritedRisk: 0,
        inheritedBlockers: [],
        priorityScore: 0
    }));

    const nodeMap = new Map(graph.filter(n => n._id).map(n => [n._id, n]));

    // 2. Propagation Logic
    const propagate = (nodeId, sourceId, risk, delay, depth) => {
        if (depth > 5) return; // Limit depth to prevent runaway
        const node = nodeMap.get(nodeId);
        if (!node) return;

        // Damping factor for propagation
        const damping = Math.pow(0.75, depth);
        const propagatedRisk = risk * damping;
        const propagatedDelay = delay * damping;

        if (propagatedRisk > node.inheritedRisk) {
            node.inheritedRisk = propagatedRisk;
            if (sourceId && !node.inheritedBlockers.includes(sourceId)) {
                node.inheritedBlockers.push(sourceId);
            }
        }
        node.inheritedDelay = Math.max(node.inheritedDelay, propagatedDelay);

        // Continue to downstream
        node.downstream.forEach(childId => {
            propagate(childId, sourceId || nodeId, risk, delay, depth + 1);
        });
    };

    // Trigger propagation from problematic nodes
    graph.forEach(node => {
        if (node.status === STAGES.COMPLETED) return;
        
        const sla = calculateSLA(node);
        const rejections = node.rejectionCount || 0;
        const isEscalated = node.escalationState === 'ESCALATED' || node.escalationState === 'CRITICAL_ESCALATED';
        
        // Base risk from this node
        let risk = (rejections * 0.25) + (sla.overrun * 0.4);
        if (isEscalated) risk += 0.5;
        
        if (risk > 0.2) {
            node.downstream.forEach(childId => {
                propagate(childId, node._id, risk, sla.delayHours, 1);
            });
        }
    });

    // 3. Final Health & Bottleneck Classification
    graph.forEach(node => {
        const health = calculateHealth(node, graph);
        node.health = health;
        node.healthStatus = health; // Compatibility
        
        // Blocked State Detection
        const isBlocked = calculateBlockedState(node, graph);
        node.isBlocked = isBlocked;
        node.executionState = isBlocked ? 'BLOCKED' : (node.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS');

        // BOTTLENECK Detection Layer
        const hasDownstream = node.downstream.length > 0;
        const isBlocking = node.status !== STAGES.COMPLETED && hasDownstream;
        const propagationRisk = (node.downstream.length * 0.1) + (node.rejectionCount * 0.2);
        
        if (health === HEALTH_STATES.CRITICAL && isBlocking && propagationRisk > 0.3) {
            node.health = HEALTH_STATES.BOTTLENECK;
            node.healthStatus = HEALTH_STATES.BOTTLENECK;
            node.executionState = 'BOTTLENECK';
        }

        // Priority Score
        node.priorityScore = calculatePriorityScore(node, graph);
        
        // High-Fidelity Telemetry Generation
        const sla = calculateSLA(node);
        const pressure = calculatePressureIndex(node, graph);
        const propagation = calculatePropagationImpact(node, graph);
        const confidence = calculateNodeConfidence(node, graph);
        
        node.telemetry = {
            executionPressure: pressure,
            propagationRisk: propagation.risk,
            downstreamImpact: node.downstream.length,
            confidenceScore: confidence,
            delayContribution: sla.delayHours,
            recoveryPotential: Math.round(sla.delayHours * 0.4 * 10) / 10,
            
            // Legacy/Internal mappings
            rejectionPressure: (node.rejectionCount || 0) * 20,
            stagnationIndex: Math.round(sla.overrun * 100),
            priorityRank: node.priorityScore,
            propagationImpact: propagation.risk,
            inheritedDelay: Math.round(node.inheritedDelay * 10) / 10
        };

        // Hydrate node fields for direct access in UI
        node.pressure = pressure;
        node.propagation = propagation.risk;
        node.confidence = confidence;
        node.delayHours = sla.delayHours;

        // Deterministic Timeline Events
        node.orchestrationEvents = [];
        if (sla.overrun > 0.2) node.orchestrationEvents.push(`Workflow exceeded ${node.status} SLA by ${sla.delayHours}h`);
        if (node.rejectionCount >= 3) node.orchestrationEvents.push(`Critical retry instability: ${node.rejectionCount} rejections`);
        if (node.escalationState !== 'NORMAL' && node.escalationState) node.orchestrationEvents.push(`Manager escalated ${node.name}`);
        if (node.health === HEALTH_STATES.BOTTLENECK) node.orchestrationEvents.push(`${node.name} triggered downstream propagation`);
    });

    // 4. Sort by priorityScore DESC
    return graph.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}

/**
 * Legacy Helpers (Keeping for compatibility but mapped to new logic)
 */
export function calculateDependencyImpact(workflow, allWorkflows = []) {
    if (!workflow || !allWorkflows) return { upstream: [], downstream: [], allUpstream: [], allDownstream: [] };
    
    const nodeMap = new Map(allWorkflows.map(w => [w._id, w]));
    const upstream = (workflow.dependencies || []).map(id => nodeMap.get(id._id || id)).filter(Boolean);
    const downstream = allWorkflows.filter(w => (w.dependencies || []).some(d => (d._id || d) === workflow._id));
    
    // Recursive upstream calculation
    const getAllUpstream = (w, visited = new Set()) => {
        const deps = (w.dependencies || []).map(id => id._id || id).filter(id => !visited.has(id));
        let results = [...deps];
        deps.forEach(id => {
            visited.add(id);
            const depNode = nodeMap.get(id);
            if (depNode) results = [...results, ...getAllUpstream(depNode, visited)];
        });
        return results;
    };

    // Recursive downstream calculation
    const getAllDownstream = (w, visited = new Set()) => {
        const deps = allWorkflows.filter(other => 
            (other.dependencies || []).some(d => (d._id || d) === w._id) && !visited.has(other._id)
        );
        let results = deps.map(d => d._id);
        deps.forEach(d => {
            visited.add(d._id);
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
    const assigned = allBlocks.filter(b => (b.assignedEngineer?._id || b.assignedEngineer) === engineerId && b.status !== STAGES.COMPLETED);
    const critical = assigned.filter(b => b.health === HEALTH_STATES.CRITICAL || b.health === HEALTH_STATES.BOTTLENECK);
    return { 
        activeCount: assigned.length, 
        criticalCount: critical.length,
        blocks: assigned, 
        isOverloaded: assigned.length > 5 
    };
}

export function aggregateKPIs(blocks, engineers = []) {
    const total = blocks.length;
    let healthy = 0, warning = 0, critical = 0, bottlenecks = 0, totalDelay = 0, delayedCount = 0;
    let totalEst = 0, totalAct = 0, totalRem = 0, overdueCount = 0, totalUnassigned = 0;
    const activeEngIds = new Set();

    blocks.forEach(b => {
        if (b.health === HEALTH_STATES.HEALTHY) healthy++;
        else if (b.health === HEALTH_STATES.WARNING) warning++;
        else if (b.health === HEALTH_STATES.CRITICAL) critical++;
        else if (b.health === HEALTH_STATES.BOTTLENECK) bottlenecks++;
        
        if (!b.assignedEngineer && b.status !== STAGES.COMPLETED) totalUnassigned++;

        const sla = calculateSLA(b);
        if (sla.delayHours > 0) {
            totalDelay += sla.delayHours;
            delayedCount++;
            if (b.status !== STAGES.COMPLETED) overdueCount++;
        }
        
        totalEst += (b.estimatedHours || 0);
        totalAct += (b.totalTimeSpent || 0);
        totalRem += Math.max(0, (b.estimatedHours || 0) - (b.totalTimeSpent || 0));

        if (b.assignedEngineer && b.status !== STAGES.COMPLETED) {
            activeEngIds.add(b.assignedEngineer?._id || b.assignedEngineer);
        }
    });

    const utilization = engineers.length > 0 ? calculateEngineerUtilization(engineers, blocks) : [];
    const avgUtil = utilization.length > 0 ? utilization.reduce((s, u) => s + u.currentUtil, 0) / utilization.length : 0;
    const overloadedEngineers = utilization.filter(u => u.activeCount >= 5).length;

    return { 
        total, 
        healthy, 
        warning, 
        critical, 
        bottlenecks, 
        avgDelay: delayedCount > 0 ? totalDelay / delayedCount : 0,
        activeEngineers: activeEngIds.size,
        active: blocks.filter(b => b.status !== STAGES.COMPLETED && b.status !== STAGES.NOT_STARTED).length,
        
        // Effort & Resource Metrics
        totalEstimatedHours: totalEst,
        totalActualHours: totalAct,
        totalRemainingEffort: totalRem,
        totalVariance: totalAct - (totalEst - totalRem),
        totalUnassigned,
        overloadedEngineers,
        overdueCount,
        avgUtilization: Math.round(avgUtil),
        utilization
    };
}


// Visual Priority Colors
export const HEALTH_COLORS = {
    [HEALTH_STATES.HEALTHY]: '#22c55e', // Green
    [HEALTH_STATES.WARNING]: '#f59e0b', // Amber
    [HEALTH_STATES.CRITICAL]: '#ef4444', // Red
    [HEALTH_STATES.BOTTLENECK]: '#ef4444', // Red (handled via glow in CSS)
    [HEALTH_STATES.BLOCKED]: '#64748b',   // Gray
};

export const HEALTH_DESCRIPTIONS = {
    [HEALTH_STATES.HEALTHY]: 'Workflow executing within nominal SLA parameters.',
    [HEALTH_STATES.WARNING]: 'Performance degradation detected. Potential SLA violation.',
    [HEALTH_STATES.CRITICAL]: 'Critical execution failure. Immediate intervention required.',
    [HEALTH_STATES.BOTTLENECK]: 'Systemic bottleneck impacting downstream orchestration.',
};
export function calculateProgress(block) {
    if (!block) return 0;
    if (block.status === STAGES.COMPLETED) return 100;
    if (block.status === STAGES.NOT_STARTED) return 0;
    return block.progress || 0;
}

export function calculateEngineerUtilization(engineers, allBlocks) {
    return engineers.map(eng => {
        const active = allBlocks.filter(b => {
            const bEngId = b.assignedEngineer?._id || b.assignedEngineer;
            const engId = eng._id || eng;
            return bEngId?.toString() === engId?.toString() && !['COMPLETED','NOT_STARTED'].includes(b.status);
        });
        const curr = Math.min(100, (active.length / 4) * 100);
        const weight = active.reduce((s, b) => s + (b.complexity === 'CRITICAL' ? 2 : b.complexity === 'COMPLEX' ? 1.5 : 1), 0);
        const proj = Math.min(100, (weight / 4) * 100);
        return { 
            id: eng._id || eng,
            engineer: eng.displayName || 'Engineer', 
            currentUtil: Math.round(curr), 
            projectedUtil: Math.round(proj), 
            trend: proj > curr ? 'UP' : proj < curr ? 'DOWN' : 'STABLE', 
            activeCount: active.length 
        };
    });
}

/**
 * 10. FORMATTING & VALIDATION
 */
export function formatDuration(h) {
    return (h === null || h === undefined || isNaN(h)) ? '—' : `${h.toFixed(1)}h`;
}

export function validateBulkAction(action, selected, blocks) {
    if (!selected?.length) return false;
    switch(action) {
        case 'ASSIGN': return selected.every(x => x.status !== 'COMPLETED');
        case 'ESCALATE': return selected.some(x => !x.escalated && x.status !== 'COMPLETED');
        case 'APPROVE':
        case 'REJECT': return selected.every(x => x.status === 'REVIEW');
        default: return true;
    }
}

/**
 * 11. ENGINEER PERFORMANCE & SIMULATION ENGINE
 * Deterministic calculation of execution outcomes.
 */

const DOMAIN_EXPERTISE = {
    'Charan': ['PLL', 'Bandgap', 'LDO', 'ANALOG'],
    'Engineer': ['DRC', 'LVS', 'METAL', 'PHYSICAL'],
    'John': ['LOGIC', 'MEMORY', 'CPU'],
    'Jane': ['I/O', 'ESD', 'PADS'],
};

export function getEngineerPerformance(engineer, allBlocks = []) {
    if (!engineer) return null;
    
    const engId = engineer._id || engineer.id || engineer;
    const name = engineer.displayName || engineer.username || 'Engineer';
    const expertise = DOMAIN_EXPERTISE[name] || DOMAIN_EXPERTISE['Engineer'];
    
    // 1. Core Load Analysis
    const assigned = allBlocks.filter(b => {
        const bEngId = b.assignedEngineer?._id || b.assignedEngineer;
        return bEngId?.toString() === engId?.toString();
    });
    
    const active = assigned.filter(b => b.status !== STAGES.COMPLETED);
    const completed = assigned.filter(b => b.status === STAGES.COMPLETED);
    
    // 2. Efficiency & Reliability Calculations
    // avgCompletionTime vs Expected
    let totalVariance = 0;
    completed.forEach(b => {
        const sla = calculateSLA(b);
        totalVariance += (sla.overrun || 0);
    });
    const avgOverrun = completed.length > 0 ? totalVariance / completed.length : 0;
    const onTimeRate = completed.length > 0 ? (completed.filter(b => (b.delayHours || 0) <= 0).length / completed.length) * 100 : 90;

    // 3. Rejection & Bottleneck History
    const totalRejections = assigned.reduce((s, b) => s + (b.rejectionCount || 0), 0);
    const rejectionRate = assigned.length > 0 ? totalRejections / assigned.length : 0.1;
    
    // 4. Deterministic Base Factors (stable for personas)
    let speedFactor = 1.0;
    if (name.includes('Charan')) speedFactor = 1.35;
    if (name.includes('John')) speedFactor = 1.15;
    if (name.includes('Jane')) speedFactor = 1.05;

    // 5. Final Derived Metrics
    const efficiencyScore = Math.min(100, Math.max(10, Math.round((speedFactor * 60) + (onTimeRate * 0.4) - (rejectionRate * 20))));
    const recoveryScore = Math.min(100, Math.max(10, Math.round(efficiencyScore * (1 - (active.length * 0.1)))));

    return {
        id: engId,
        name,
        expertise,
        activeCount: active.length,
        completedCount: completed.length,
        efficiencyScore,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        onTimeRate: Math.round(onTimeRate),
        speedFactor,
        recoveryScore,
        isOverloaded: active.length >= 5,
        loadPercentage: Math.min(100, Math.round((active.length / 5) * 100))
    };
}

export function findBestEngineer(block, engineers, allBlocks) {
    if (!block || !engineers.length) return null;
    
    const blockType = (block.name || '').toUpperCase();
    const blockDomain = (block.type || '').toUpperCase();
    const isCritical = block.health === HEALTH_STATES.CRITICAL || block.health === HEALTH_STATES.BOTTLENECK;

    const candidates = engineers.map(eng => {
        const perf = getEngineerPerformance(eng, allBlocks);
        
        // 1. Specialization Match (0.35)
        const expertiseMatch = perf.expertise.some(e => blockType.includes(e.toUpperCase()) || blockDomain.includes(e.toUpperCase()));
        const specScore = expertiseMatch ? 100 : 20;

        // 2. Efficiency Score (0.25)
        const effScore = perf.efficiencyScore;

        // 3. Availability Score (0.25)
        // 0/5 = 100, 1/5 = 80...
        const availScore = Math.max(0, 100 - (perf.activeCount * 20));

        // 4. Stage Expertise (0.10) - Simplified for demo
        const stageExpertise = (block.status === 'LVS' && perf.name.includes('Jane')) || (block.status === 'DRC' && perf.name.includes('Charan')) ? 100 : 50;

        // 5. Rejection Penalty (0.05)
        const rejectionPenalty = perf.rejectionRate * 100;

        // --- WEIGHTED FORMULA ---
        let totalScore = 
            (specScore * 0.35) +
            (effScore * 0.25) +
            (availScore * 0.25) +
            (stageExpertise * 0.10) -
            (rejectionPenalty * 0.05);

        // --- SMART HEURISTICS ---
        if (isCritical && expertiseMatch) {
            totalScore += 15; // Critical bias towards expertise
        }
        
        if (perf.activeCount >= 4) {
            totalScore -= 30; // Heavy load penalty
        }

        // Reasoning Engine
        let reason = 'Solid all-rounder for this task.';
        if (expertiseMatch && availScore > 60) reason = `Expert match for ${blockDomain} with high availability.`;
        else if (expertiseMatch) reason = `Top specialist for ${blockDomain} workflows.`;
        else if (availScore >= 100) reason = 'Maximum availability for rapid assignment.';
        else if (effScore > 90) reason = 'High efficiency rating for complex delivery.';

        return { 
            id: eng._id || eng.id || eng, 
            score: Math.round(totalScore), 
            name: perf.name,
            reason,
            perf
        };
    });

    // Exclude full capacity (5/5)
    const validCandidates = candidates.filter(c => c.perf.activeCount < 5);

    return validCandidates.sort((a, b) => b.score - a.score)[0];
}

export function runOrchestrationSimulation(allBlocks, engineers, targetBlockId, expertId, strategy) {
    const target = allBlocks.find(b => (b._id || b.id) === targetBlockId);
    const engineer = engineers.find(e => (e._id || e.id) === expertId);
    
    if (!target || !engineer) return null;
    
    const perf = getEngineerPerformance(engineer, allBlocks);
    const sla = calculateSLA(target);
    const { allDownstream } = calculateDependencyImpact(target, allBlocks);
    
    // 1. Expertise & Domain Alignment
    const blockType = (target.name || '').toUpperCase();
    const blockDomain = (target.type || '').toUpperCase();
    const hasExpertise = perf.expertise.some(e => blockType.includes(e.toUpperCase()) || blockDomain.includes(e.toUpperCase()));
    const expertiseMatch = hasExpertise ? 1.5 : 0.8;

    // 2. Load-Aware Base Recovery
    const loadPenalty = perf.isOverloaded ? 0.4 : (1 - (perf.activeCount * 0.08));
    let baseRecovery = sla.delayHours > 0 ? sla.delayHours * 0.7 : 5;
    let recoveryHours = baseRecovery * perf.speedFactor * expertiseMatch * loadPenalty;
    
    // 3. Strategy Calibration
    let confidenceGain = perf.onTimeRate * 0.3;
    let riskReduction = 0.2 + (perf.efficiencyScore / 200);
    let bottleneckRecoveryProb = perf.recoveryScore;

    if (strategy === 'SLA') {
        recoveryHours *= 1.4;
        confidenceGain += 15;
    } else if (strategy === 'LOAD') {
        recoveryHours *= 0.7;
        riskReduction += 0.2;
    } else if (strategy === 'PATH') {
        riskReduction *= 2;
        confidenceGain += 25;
        bottleneckRecoveryProb = Math.min(99, bottleneckRecoveryProb + 10);
    }

    // 4. Result Scaling
    const finalRecovery = Math.round(recoveryHours * 10) / 10;
    const finalConfidence = Math.min(99, Math.round(confidenceGain + (hasExpertise ? 20 : 5)));
    const finalRiskReduct = Math.min(90, Math.round(riskReduction * 100));
    
    // 5. Ghost State Generation
    const optimizedBlocks = allBlocks.map(b => {
        const isTarget = (b._id || b.id) === targetBlockId;
        const isDownstream = allDownstream.includes(b._id || b.id);
        
        if (isTarget) {
            return {
                ...b,
                pressureScore: Math.max(5, Math.round((b.pressureScore || 50) * (1 - (finalConfidence / 150)))),
                confidenceScore: Math.min(100, Math.round((b.confidenceScore || 60) + finalConfidence)),
                inheritedRisk: Math.max(0, Math.round((b.inheritedRisk || 0) * (1 - (finalRiskReduct / 100)))),
                health: bottleneckRecoveryProb > 85 ? HEALTH_STATES.HEALTHY : (b.health === HEALTH_STATES.BOTTLENECK ? HEALTH_STATES.WARNING : b.health),
                delayHours: Math.max(0, (b.delayHours || 0) - finalRecovery)
            };
        }
        
        if (isDownstream) {
            return {
                ...b,
                inheritedDelay: Math.max(0, (b.inheritedDelay || 0) - (finalRecovery * 0.4)),
                pressureScore: Math.max(10, Math.round((b.pressureScore || 50) - (finalConfidence * 0.3)))
            };
        }
        return b;
    });

    return {
        timestamp: new Date().toISOString(),
        targetId: targetBlockId,
        targetName: target.name,
        engineerId: expertId,
        engineerName: perf.name,
        strategy,
        
        recoveryHours: finalRecovery,
        confidenceGain: finalConfidence,
        riskReduction: finalRiskReduct,
        bottleneckRecoveryProb: Math.round(bottleneckRecoveryProb),
        loadImpact: perf.loadPercentage,
        
        optimizedBlocks,
        projectedState: {
            pressure: Math.max(5, Math.round((target.pressureScore || 50) * (1 - (finalConfidence / 150)))),
            confidence: Math.min(100, Math.round((target.confidenceScore || 60) + finalConfidence)),
            risk: Math.max(0, Math.round((target.inheritedRisk || 0) * (1 - (finalRiskReduct / 100))))
        }
    };
}

export function calculateBottleneck(block, allWorkflows = []) {
    // Legacy mapping to new health state
    return block.health === HEALTH_STATES.BOTTLENECK;
}
export function calculateVelocity(block) {
    if (!block || block.status === STAGES.COMPLETED) return 0;
    const sla = calculateSLA(block);
    if (sla.actualHours === 0) return 1.0;
    return Math.round((sla.expectedHours / sla.actualHours) * 100) / 100;
}

export function calculateEfficiency(block) {
    if (!block) return 0;
    const rejections = block.rejectionCount || 0;
    const base = 100;
    return Math.max(0, base - (rejections * 15));
}

export function generateRecommendedAction(block, allBlocks = []) {
    if (!block) return { priority: 'LOW', text: 'System standing by.', label: 'None', action: 'NONE', variant: 'ghost' };
    
    const health = calculateHealth(block, allBlocks);
    const isBlocked = calculateBlockedState(block, allBlocks);
    const sla = calculateSLA(block);
    
    if (isBlocked) {
        return { 
            priority: 'HIGH', 
            text: `Workflow is blocked by upstream dependencies. Resolve blockers in ${block.dependencies[0]} first.`,
            label: 'Resolve Upstream', 
            action: 'FOCUS_UPSTREAM', 
            variant: 'warning' 
        };
    }
    
    if (health === HEALTH_STATES.BOTTLENECK) {
        return { 
            priority: 'HIGH', 
            text: 'Systemic bottleneck detected. Immediate manager intervention required to unblock downstream flows.',
            label: 'Escalate Flow', 
            action: 'ESCALATE', 
            variant: 'danger' 
        };
    }
    
    if (block.rejectionCount > 1) {
        return { 
            priority: 'MEDIUM', 
            text: `High rejection frequency (${block.rejectionCount}). Review technical specs for potential misalignment.`,
            label: 'Technical Review', 
            action: 'RETRY', 
            variant: 'accent' 
        };
    }
    
    if (sla.overrun > 0.3) {
        return { 
            priority: 'MEDIUM', 
            text: `SLA target exceeded by ${sla.delayHours}h. Reassign resources if timeline is critical.`,
            label: 'Reassign Task', 
            action: 'REASSIGN', 
            variant: 'warning' 
        };
    }
    
    return { 
        priority: 'LOW', 
        text: 'Workflow is proceeding within nominal execution parameters. No immediate action required.',
        label: 'Advance Stage', 
        action: 'ADVANCE', 
        variant: 'primary' 
    };
}


export function calculatePressureIndex(block, allBlocks = []) {
    if (!block) return 0;
    const sla = calculateSLA(block);
    const rejections = block.rejectionCount || 0;
    const isBlocked = calculateBlockedState(block, allBlocks);
    const downstreamCount = (block.downstream || []).length;
    
    let score = (sla.overrun * 40) + (rejections * 15) + (downstreamCount * 5);
    if (isBlocked) score += 20;
    if (block.health === HEALTH_STATES.BOTTLENECK) score += 25;
    
    return Math.min(100, Math.round(score));
}

export function calculateNodeConfidence(block, allBlocks = []) {
    if (!block) return 100;
    const health = block.health || HEALTH_STATES.HEALTHY;
    const sla = calculateSLA(block);
    const rejections = block.rejectionCount || 0;
    const pressure = calculatePressureIndex(block, allBlocks);
    
    let score = 100;
    if (health === HEALTH_STATES.WARNING) score -= 15;
    if (health === HEALTH_STATES.CRITICAL) score -= 35;
    if (health === HEALTH_STATES.BOTTLENECK) score -= 50;
    
    score -= (sla.overrun * 25);
    score -= (rejections * 8);
    score -= (pressure * 0.2); // Pressure degrades confidence
    
    return Math.max(5, Math.round(score));
}

export function getRecommendedEngineers(block, engineers, allBlocks) {
    if (!block || !engineers.length) return [];
    
    const blockType = (block.name || '').toUpperCase();
    const blockDomain = (block.type || '').toUpperCase();
    const isCritical = block.health === HEALTH_STATES.CRITICAL || block.health === HEALTH_STATES.BOTTLENECK;

    const candidates = engineers.map(eng => {
        const perf = getEngineerPerformance(eng, allBlocks);
        
        const expertiseMatch = perf.expertise.some(e => blockType.includes(e.toUpperCase()) || blockDomain.includes(e.toUpperCase()));
        const specScore = expertiseMatch ? 100 : 20;
        const effScore = perf.efficiencyScore;
        const availScore = Math.max(0, 100 - (perf.activeCount * 20));
        const stageExpertise = (block.status === 'LVS' && perf.name.includes('Jane')) || (block.status === 'DRC' && perf.name.includes('Charan')) ? 100 : 50;
        const rejectionPenalty = perf.rejectionRate * 100;

        let totalScore = (specScore * 0.35) + (effScore * 0.25) + (availScore * 0.25) + (stageExpertise * 0.10) - (rejectionPenalty * 0.05);
        if (isCritical && expertiseMatch) totalScore += 15;
        if (perf.activeCount >= 4) totalScore -= 30;

        let reason = 'Solid all-rounder for this task.';
        if (expertiseMatch && availScore > 60) reason = `Expert match for ${blockDomain} with high availability.`;
        else if (expertiseMatch) reason = `Top specialist for ${blockDomain} workflows.`;
        else if (availScore >= 100) reason = 'Maximum availability for rapid assignment.';
        else if (effScore > 90) reason = 'High efficiency rating for complex delivery.';

        return { 
            id: eng._id || eng.id || eng, 
            score: Math.round(totalScore), 
            name: perf.name,
            reason,
            perf
        };
    });

    return candidates
        .filter(c => c.perf.activeCount < 5)
        .sort((a, b) => b.score - a.score);
}

