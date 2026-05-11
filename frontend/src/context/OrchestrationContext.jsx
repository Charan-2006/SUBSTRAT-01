import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { 
    calculateSLA, calculateBottleneck, calculateNodeConfidence, 
    calculatePressureIndex, calculateDependencyImpact, calculateProgress, 
    aggregateKPIs, propagateOrchestrationState
} from '../utils/workflowEngine';
import { STAGES, HEALTH_STATES } from '../constants/workflowStates';
import api from '../api/axios';

const OrchestrationContext = createContext();

export const OrchestrationProvider = ({ children, initialBlocks = [], initialEngineers = [] }) => {
    const [blocks, setBlocks] = useState(initialBlocks);
    const [engineers, setEngineers] = useState(initialEngineers);

    const [activityLog, setActivityLog] = useState([]);


    const logActivity = useCallback((action, blockId, details) => {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action,
            blockId,
            details,
            blockName: blocks.find(b => b._id === blockId)?.name || 'Unknown'
        };
        setActivityLog(prev => [entry, ...prev].slice(0, 100));
    }, [blocks]);

    // CENTRAL STATE ENGINE: Enriches every block with deterministic orchestration metrics
    const enrichedBlocks = useMemo(() => {
        // 1. RECALCULATE PROPAGATION GRAPH (The Heavy Lifting)
        const propagated = propagateOrchestrationState(blocks);

        // 2. MAP TO DISPLAY READY STATE
        return propagated.map(block => {
            const sla = calculateSLA(block);
            
            return {
                ...block,
                id: block._id,
                currentStage: block.status,
                
                // Inherited from propagation engine
                health: block.health,
                healthStatus: block.healthStatus,
                priorityScore: block.priorityScore,
                inheritedRisk: block.inheritedRisk,
                inheritedDelay: block.inheritedDelay,
                inheritedBlockers: block.inheritedBlockers,
                
                // Telemetry (Directly from engine)
                telemetry: block.telemetry,
                
                // Display/Legacy fields
                progress: calculateProgress(block),
                slaTargetHours: sla.expectedHours,
                elapsedHours: sla.actualHours,
                delayHours: sla.delayHours,
                isBottleneck: block.health === HEALTH_STATES.BOTTLENECK,
                isCritical: block.health === HEALTH_STATES.CRITICAL || block.health === HEALTH_STATES.BOTTLENECK,
                isEscalated: block.escalationState && block.escalationState !== 'NORMAL',
                isBlocked: block.orchestrationState === 'BLOCKED' || block.health === 'BLOCKED',
                
                // Orchestration Graph (Full Objects)
                upstream: (block.dependencies || []).map(id => blocks.find(b => b._id === id)).filter(Boolean),
                downstream: (block.downstream || []).map(id => blocks.find(b => b._id === id)).filter(Boolean),
                
                // Effort Tracking
                remainingEffort: Math.max(0, (block.estimatedHours || 0) - (block.totalTimeSpent || 0)),
                variance: (block.totalTimeSpent || 0) - (block.estimatedHours || 0),

                activityLog: activityLog.filter(log => log.blockId === (block._id || block.id))
            };
        });
    }, [blocks, engineers, activityLog]);

    // GLOBAL KPI ENGINE: Derived from enriched blocks
    const kpis = useMemo(() => {
        return aggregateKPIs(enrichedBlocks, engineers);
    }, [enrichedBlocks, engineers]);


    const fetchBlocks = useCallback(async () => {
        try {
            const res = await api.get('/blocks');
            const data = res.data?.data || [];
            console.log(`[OrchestrationContext] Fetched ${data.length} blocks`);
            setBlocks(data);
        } catch (err) {
            console.error("Context fetchBlocks error:", err);
            setBlocks([]);
        }
    }, []);

    const fetchEngineers = useCallback(async () => {
        try {
            const res = await api.get('/users');
            const data = res.data?.data || [];
            // Filter for Engineers (handle case-insensitivity and default fallback since backend already filters)
            setEngineers(data.filter(u => !u.role || u.role.toUpperCase() === 'ENGINEER'));
        } catch (err) {
            console.error("Context fetchEngineers error:", err);
            setEngineers([]);
        }
    }, []);

    const updateBlockStatus = useCallback(async (blockId, newStatus) => {
        try {
            await api.put(`/blocks/${blockId}/status`, { status: newStatus });
            logActivity('status_updated', blockId, { status: newStatus });
        } catch (err) {
            console.error("Context Status update error:", err);
        }
    }, [logActivity]);

    const assignEngineer = useCallback(async (blockId, engineerId) => {
        try {
            await api.put(`/blocks/${blockId}/assign`, { engineerId });
            logActivity('engineer_assigned', blockId, { engineerId });
            await fetchBlocks();
        } catch (err) {
            console.error("Context Assign error:", err);
        }
    }, [logActivity, fetchBlocks]);

    const unassignEngineer = useCallback(async (blockId) => {
        try {
            await api.delete(`/blocks/${blockId}/assign`);
            logActivity('engineer_unassigned', blockId, {});
            await fetchBlocks();
        } catch (err) {
            console.error("Context Unassign error:", err);
        }
    }, [logActivity, fetchBlocks]);

    const escalateBlock = useCallback(async (blockId) => {
        try {
            await api.put(`/blocks/${blockId}/escalate`);
            logActivity('escalation_triggered', blockId, {});
        } catch (err) {
            console.error("Context Escalate error:", err);
        }
    }, [logActivity]);

    const reviewBlock = useCallback(async (blockId, action, reason) => {
        try {
            const res = await api.put(`/blocks/${blockId}/review`, { action, rejectionReason: reason });
            const updatedBlock = res.data.data;
            logActivity(action === 'APPROVE' ? 'approved' : 'rejected', blockId, { reason });
            setBlocks(prev => prev.map(b => b._id === blockId ? updatedBlock : b));
            return updatedBlock;
        } catch (err) {
            console.error("Context Review error:", err);
            throw err;
        }
    }, [logActivity]);

    const createBlock = useCallback(async (formData) => {
        try {
            const res = await api.post('/blocks', formData);
            const newBlock = res.data.data;
            logActivity('block_created', newBlock._id, { name: newBlock.name });
            await fetchBlocks();
            return newBlock;
        } catch (err) {
            console.error("Context createBlock error:", err);
            throw err;
        }
    }, [fetchBlocks, logActivity]);

    useEffect(() => {
        fetchBlocks();
        fetchEngineers();
        const intervalId = setInterval(fetchBlocks, 3000);
        return () => clearInterval(intervalId);
    }, [fetchBlocks, fetchEngineers]);

    const importBlocks = useCallback(async (newBlocks) => {
        try {
            await api.post('/blocks/import', { blocks: newBlocks });
            logActivity('bulk_import', null, { count: newBlocks.length });
        } catch (err) {
            console.error("Context Import error:", err);
        }
    }, [logActivity]);

    const onUpdateBlock = useCallback(async (blockId, formData) => {
        try {
            const res = await api.put(`/blocks/${blockId}`, formData);
            const updatedBlock = res.data.data;
            logActivity('metadata_updated', blockId, { changes: Object.keys(formData) });
            await fetchBlocks();
            return updatedBlock;
        } catch (err) {
            console.error("Context updateBlock error:", err);
            throw err;
        }
    }, [fetchBlocks, logActivity]);

    const value = {
        blocks: enrichedBlocks,
        rawBlocks: blocks,
        kpis,
        engineers,
        activityLog,
        logActivity,
        updateBlockStatus,
        assignEngineer,
        unassignEngineer,
        escalateBlock,
        importBlocks,
        setBlocks,
        setEngineers,
        fetchBlocks,
        fetchEngineers,
        createBlock,
        reviewBlock,
        onUpdateBlock
    };

    return (
        <OrchestrationContext.Provider value={value}>
            {children}
        </OrchestrationContext.Provider>
    );
};

export const useOrchestration = () => {
    const context = useContext(OrchestrationContext);
    if (!context) {
        throw new Error('useOrchestration must be used within an OrchestrationProvider');
    }
    return context;
};
