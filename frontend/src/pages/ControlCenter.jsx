import React, { useMemo, useState, useEffect } from 'react';
import { 
    Workflow, Sliders, Zap, Activity, Info, AlertTriangle, 
    Play, Sparkles, Target, Settings, Layers, MousePointer2,
    Database, Box, Search, User, Clock, Gauge, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    runOrchestrationSimulation, getDomainIndex, calculatePropagationImpact,
    calculateEngineerEffectiveness, calculateDependencyImpact, calculateEngineerLoad,
    findBestEngineer, calculateSLA, calculatePressureIndex, getEngineerPerformance,
    getRecommendedEngineers
} from '../utils/workflowEngine';
import { useOrchestration } from '../context/OrchestrationContext';
import { STAGES } from '../constants/workflowStates';
import toast from 'react-hot-toast';
import './ControlCenter.css';

// --- Section 1: Simulation Control Panel ---
const SimulationControl = ({ 
    onRun, onSimulate, isSimulating, activeNodeId, history = [], 
    blocks, engineers,
    targetBlockId, setTargetBlockId,
    expertId, setExpertId,
    strategy, setStrategy,
    simResult
}) => {
    const [showHistory, setShowHistory] = useState(false);

    const targetBlock = useMemo(() => blocks.find(b => (b._id || b.id) === targetBlockId), [blocks, targetBlockId]);
    const bestMatch = useMemo(() => {
        return findBestEngineer(targetBlock, engineers, blocks);
    }, [targetBlock, engineers, blocks]);

    const recommended = useMemo(() => {
        return getRecommendedEngineers(targetBlock, engineers, blocks);
    }, [targetBlock, engineers, blocks]);

    // Filtered blocks for target selection
    const targetOptions = useMemo(() => {
        if (!blocks || !Array.isArray(blocks)) return [];
        return blocks
            .filter(b => b.status !== 'COMPLETED' && b.status !== 'COMPLETE')
            .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    }, [blocks]);

    // Sync with graph selection
    useEffect(() => {
        if (activeNodeId) setTargetBlockId(activeNodeId);
    }, [activeNodeId]);

    // Auto-recommend engineer when target changes
    useEffect(() => {
        if (targetBlockId && bestMatch && !expertId) {
            setExpertId(bestMatch._id || bestMatch.id);
        }
    }, [targetBlockId, bestMatch, expertId, setExpertId]);

    const handleSimulate = () => {
        onSimulate();
    };

    const handleRun = () => {
        onRun();
    };

    const selectedEngineer = engineers.find(e => (e._id || e.id) === expertId);
    const perf = selectedEngineer ? getEngineerPerformance(selectedEngineer, blocks) : null;


    return (
        <aside className="cc-sidebar">
            <div className="cc-section-title" style={{ color: 'var(--cc-accent)' }}>
                <Zap size={14} fill="currentColor" /> EXECUTION OPTIMIZER
            </div>
            
            <div className="cc-group">
                <label className="cc-label">Target Workflow</label>
                <div style={{ position: 'relative' }}>
                    <select className="cc-select" value={targetBlockId} onChange={(e) => setTargetBlockId(e.target.value)}>
                        <option value="">Select critical node...</option>
                        {targetOptions.map(b => (
                            <option key={b._id} value={b._id}>
                                {b.name} • {b.status} • {b.healthStatus}
                            </option>
                        ))}
                    </select>
                    {targetBlock && (
                        <div style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                             <div style={{ width: 8, height: 8, borderRadius: '50%', background: targetBlock.health === 'BOTTLENECK' ? 'var(--cc-error)' : targetBlock.health === 'CRITICAL' ? 'var(--cc-error)' : 'var(--cc-success)' }} />
                        </div>
                    )}
                </div>
            </div>

            <div className="cc-group">
                <label className="cc-label">Strategic Engineer Assignment</label>
                <select className="cc-select" value={expertId} onChange={(e) => setExpertId(e.target.value)}>
                    <option value="">Assign lead expert...</option>
                    {recommended.map((c, idx) => {
                        return (
                            <option key={c.id} value={c.id}>
                                {idx === 0 ? '★ RECOMMENDED: ' : ''}{c.name} • Score: {c.score} • {c.perf.activeCount}/5 Load
                            </option>
                        );
                    })}
                    {/* Show non-recommended if list is short or empty */}
                    {recommended.length === 0 && engineers.map(e => (
                        <option key={e._id || e.id} value={e._id || e.id}>
                            {e.displayName} (Capacity Reached)
                        </option>
                    ))}
                </select>
                
                {selectedEngineer && (
                    <div className="cc-eng-card fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cc-text-pri)' }}>
                                {selectedEngineer.displayName}
                                {recommended[0]?.id === (selectedEngineer._id || selectedEngineer.id) && <span className="cc-badge-rec">RECOMMENDED</span>}
                            </div>
                            <div style={{ fontSize: 9, color: perf.isOverloaded ? 'var(--cc-error)' : 'var(--cc-text-ter)' }}>
                                Score: {recommended.find(c => c.id === (selectedEngineer._id || selectedEngineer.id))?.score || 'N/A'}
                            </div>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--cc-accent)', marginBottom: 8, fontStyle: 'italic' }}>
                            "{recommended.find(c => c.id === (selectedEngineer._id || selectedEngineer.id))?.reason || 'Standard performance profile.'}"
                        </div>
                        <div className="cc-progress-bar">
                            <div 
                                className="cc-progress-fill" 
                                style={{ 
                                    width: `${perf.loadPercentage}%`,
                                    background: perf.isOverloaded ? 'var(--cc-error)' : 'var(--cc-accent)'
                                }} 
                            />
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                            <span style={{ color: 'var(--cc-text-sec)' }}>On-Time: {perf.onTimeRate}%</span>
                            <span style={{ color: 'var(--cc-text-sec)' }}>Eff: {perf.efficiencyScore}</span>
                        </div>
                        {perf.isOverloaded && (
                            <div style={{ marginTop: 6, fontSize: 9, color: 'var(--cc-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={10} /> Overload Penalty: Significant recovery delay.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="cc-group">
                <label className="cc-label">Optimization Strategy</label>
                <div className="cc-tabs">
                    {[
                        { id: 'SLA', label: 'SLA', icon: Clock, desc: 'Reduce Delay' },
                        { id: 'LOAD', label: 'Load', icon: User, desc: 'Balance Res' },
                        { id: 'PATH', label: 'Path', icon: Layers, desc: 'Critical Path' }
                    ].map(s => (
                        <button 
                            key={s.id} 
                            className={`cc-tab-v2 ${strategy === s.id ? 'active' : ''}`}
                            onClick={() => setStrategy(s.id)}
                            title={s.desc}
                        >
                            <s.icon size={12} />
                            <span>{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="cc-spacer" style={{ height: 20 }} />

            <div style={{ display: 'flex', gap: 10 }}>
                <button 
                    className="cc-primary-btn" 
                    onClick={handleSimulate}
                    disabled={!targetBlockId || !expertId || isSimulating}
                    style={{ background: 'var(--cc-bg-card)', border: '1px solid var(--cc-accent)', color: 'var(--cc-accent)', flex: 1 }}
                >
                    <Activity size={16} />
                    <span>Run Simulation</span>
                </button>

                <button 
                    className="cc-primary-btn" 
                    onClick={handleRun}
                    disabled={!simResult || isSimulating}
                    style={{ flex: 1 }}
                >
                    {isSimulating ? (
                        <Activity size={16} className="spin" />
                    ) : (
                        targetBlock?.assignedEngineer ? <Zap size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />
                    )}
                    <span>{targetBlock?.assignedEngineer ? 'Reassign & Commit' : 'Commit Strategy'}</span>
                </button>
            </div>

            {history.length > 0 && (
                <div className="cc-history-v2">
                    <div className="cc-section-title" style={{ cursor: 'pointer' }} onClick={() => setShowHistory(!showHistory)}>
                        <Activity size={12} /> Optimization History ({history.length})
                    </div>
                    {showHistory && (
                        <div className="cc-history-list custom-scrollbar">
                            {history.map((h, i) => (
                                <div key={i} className="cc-history-item">
                                    <div className="head">
                                        <span>{h.targetName}</span>
                                        <span className="recov">+{h.recoveryHours}h</span>
                                    </div>
                                    <div className="meta">
                                        {h.engineerName} • {h.strategy}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
};

// --- Section 2: Orchestration Graph Workspace ---
const NodeCard = ({ block, isSelected, onClick, simResult }) => {
    const { health, confidenceScore: confidence, pressureScore: pressure, delayHours } = block;
    const isTarget = simResult?.targetId === block._id;
    const isSimulated = !!simResult;
    
    const isEscalated = block.escalationState === 'ESCALATED' || block.escalationState === 'CRITICAL_ESCALATED';
    
    const stateClass = 
        health === 'BOTTLENECK' ? 'bottleneck' : 
        health === 'CRITICAL' ? 'critical' : 
        health === 'WARNING' ? 'warning' : 'stable';
    
    const statusLabelClass = `status-${stateClass}`;

    return (
        <div 
            className={`cc-node ${stateClass} ${isSelected ? 'selected' : ''} ${(health === 'CRITICAL' || health === 'BOTTLENECK') && !isTarget ? 'cc-critical-pulse' : ''} ${isEscalated ? 'cc-escalated-pulse' : ''} ${isTarget ? 'cc-sim-target' : ''}`}
            onClick={onClick}
        >
            {isTarget && (
                <div style={{ position: 'absolute', top: -20, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--cc-accent)', color: 'white', fontSize: 8, fontWeight: 900, padding: '2px 8px', borderRadius: 4, letterSpacing: 0.5 }}>
                        SIMULATED GHOST STATE
                    </div>
                </div>
            )}
            <div className="cc-node-name">{block.name}</div>
            <div className={`cc-node-status ${statusLabelClass}`}>{isEscalated ? 'PRIORITY_ROUTING' : (isTarget ? (simResult.bottleneckRecoveryProb > 80 ? 'STABLE' : 'RECOVERING') : health)}</div>
            <div className="cc-node-metrics">
                <div className="cc-stat">
                    <span className="cc-stat-lbl">CONF</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="cc-stat-val" style={{ fontSize: 12 }}>{isTarget ? simResult.projectedState.confidence : (isSimulated ? block.confidenceScore : confidence)}%</span>
                        {isTarget && <ArrowRight size={8} className="text-success" />}
                    </div>
                </div>
                <div className="cc-stat">
                    <span className="cc-stat-lbl">PRES</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="cc-stat-val" style={{ fontSize: 12 }}>{isTarget ? simResult.projectedState.pressure : (isSimulated ? block.pressureScore : pressure)}</span>
                        {isTarget && <ArrowRight size={8} className="text-success" />}
                    </div>
                </div>
            </div>
            {delayHours > 0 && !isTarget && (
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: 'var(--cc-danger)', textAlign: 'right' }}>
                    +{delayHours.toFixed(1)}h SLA
                </div>
            )}
            {isTarget && (
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: 'var(--cc-success)', textAlign: 'right' }}>
                    -{simResult.recoveryHours}h PROJECTED
                </div>
            )}
        </div>
    );
};

const GraphWorkspace = ({ blocks, simResult, selectedNodeId, onSelectNode, isSimulating }) => {
    const DOMAINS = ['DESIGN', 'VERIFICATION', 'VALIDATION', 'INTEGRATION', 'TAPEOUT'];
    const displayBlocks = simResult?.optimizedBlocks || blocks;

    const layout = useMemo(() => {
        const nodes = [];
        const grid = {}; // { domainIdx: { tier: [blocks] } }
        
        displayBlocks.forEach(b => {
            const dIdx = getDomainIndex(b.type);
            const { allUpstream } = calculateDependencyImpact(b, displayBlocks);
            const tier = Math.min(6, allUpstream.length);
            if (!grid[dIdx]) grid[dIdx] = {};
            if (!grid[dIdx][tier]) grid[dIdx][tier] = [];
            grid[dIdx][tier].push(b);
        });

        const NODE_HEIGHT = 160; // Increased for buffer
        const TIER_WIDTH = 300;
        
        let currentY = 60;
        const domainPositions = [];

        // Calculate Y positions for each domain
        DOMAINS.forEach((_, dIdx) => {
            if (!grid[dIdx]) return;
            
            // Height of this domain row is based on the tier with the most nodes
            let maxNodesInTier = 0;
            Object.values(grid[dIdx]).forEach(tierBlocks => {
                maxNodesInTier = Math.max(maxNodesInTier, tierBlocks.length);
            });
            
            const domainRowHeight = Math.max(220, maxNodesInTier * NODE_HEIGHT);
            domainPositions[dIdx] = currentY;
            
            Object.keys(grid[dIdx]).forEach(tierStr => {
                const tier = parseInt(tierStr);
                const tierBlocks = grid[dIdx][tier];
                tierBlocks.forEach((b, bIdx) => {
                    nodes.push({
                        block: b,
                        x: 80 + tier * TIER_WIDTH,
                        y: currentY + (bIdx * NODE_HEIGHT) + 20
                    });
                });
            });

            currentY += domainRowHeight;
        });

        const edges = [];
        nodes.forEach(target => {
            const deps = target.block.dependencies || [];
            deps.forEach(dep => {
                const sId = dep?._id || dep;
                const source = nodes.find(n => n.block._id === sId);
                if (source) {
                    const impact = calculatePropagationImpact(target.block, displayBlocks);
                    edges.push({ source, target, id: `${sId}-${target.block._id}`, state: impact.state });
                }
            });
        });

        return { nodes, edges, canvasHeight: currentY + 100 };
    }, [displayBlocks]);

    return (
        <div className="cc-workspace">
            <div className="cc-workspace-header">
                <div className="cc-workspace-title"><Workflow size={18} /> Orchestration Workspace</div>
                <div style={{ display: 'flex', gap: 16 }}>
                    {['Stable', 'At Risk', 'Blocked', 'Cascading'].map(s => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--cc-text-sec)' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: `var(--cc-${s === 'Stable' ? 'success' : s === 'At Risk' ? 'warning' : s === 'Blocked' ? 'danger' : 'danger-deep'})` }} />
                            {s}
                        </div>
                    ))}
                </div>
            </div>
            <div className={`cc-canvas ${isSimulating ? 'cc-shimmer' : ''}`} style={{ height: layout.canvasHeight }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: layout.canvasHeight, pointerEvents: 'none' }}>
                    {layout.edges.map(edge => {
                        const isCritical = edge.state === 'CASCADING' || edge.state === 'BLOCKED';
                        const isSelected = selectedNodeId === edge.source.block._id || selectedNodeId === edge.target.block._id;
                        
                        const srcX = edge.source.x + 200;
                        const srcY = edge.source.y + 45;
                        const tgtX = edge.target.x;
                        const tgtY = edge.target.y + 45;
                        
                        const cp1X = srcX + 60;
                        const cp2X = tgtX - 60;
                        const d = `M ${srcX} ${srcY} C ${cp1X} ${srcY}, ${cp2X} ${tgtY}, ${tgtX} ${tgtY}`;

                        return (
                            <path 
                                key={edge.id}
                                d={d} 
                                className={`cc-edge ${isCritical ? 'critical' : ''} ${isSelected ? 'active' : ''}`}
                            />
                        );
                    })}
                </svg>
                {layout.nodes.map(n => (
                    <div 
                        key={n.block._id}
                        style={{ position: 'absolute', left: n.x, top: n.y }}
                    >
                        <NodeCard 
                            block={n.block} 
                            isSelected={selectedNodeId === n.block._id}
                            onClick={() => onSelectNode(n.block._id)}
                            simResult={simResult}
                        />
                    </div>
                ))}
            </div>
            
            {/* EXECUTION MONITOR BAR */}
            <div className="cc-monitor">
                <div className="cc-monitor-inner">
                    <div className="cc-monitor-stat">
                        <span className="cc-monitor-lbl">Baseline Delay</span>
                        <span className="cc-monitor-val text-danger">+{blocks.reduce((s, b) => s + (b.delayHours || 0), 0).toFixed(1)}h</span>
                    </div>
                    <div className="cc-monitor-track">
                        <div className="cc-monitor-progress bg-danger" style={{ width: '40%' }} />
                        {simResult && <div className="cc-monitor-progress bg-success" style={{ width: `${(simResult.recoveryHours / 50) * 100}%`, marginLeft: '40%' }} />}
                    </div>
                    <div className="cc-monitor-stat">
                        <span className="cc-monitor-lbl">Projected Recovery</span>
                        <span className="cc-monitor-val text-success">
                            {simResult ? `-${simResult.recoveryHours}h` : '0.0h'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StrategicInsights = ({ 
    activeNodeId, blocks, simResult, isSimulating, 
    onSimulate, setTargetBlockId, setExpertId, setStrategy 
}) => {
    const activeBlock = useMemo(() => blocks.find(b => b._id === activeNodeId), [activeNodeId, blocks]);

    if (!activeNodeId) {
        return (
            <aside className="cc-sidebar cc-sidebar-right">
                <div className="cc-empty">
                    <MousePointer2 size={32} style={{ marginBottom: 16, opacity: 0.3 }} />
                    <p>Select a node to inspect<br />orchestration impact.</p>
                </div>
            </aside>
        );
    }

    const sla = calculateSLA(activeBlock);
    const telemetry = activeBlock.telemetry || {};
    const pressure = telemetry.executionPressure || 0;
    const propagation = telemetry.propagationRisk || 0;
    const recovery = simResult?.targetId === activeNodeId ? simResult.recoveryHours : (telemetry.recoveryPotential || 0);

    return (
        <aside className="cc-sidebar cc-sidebar-right">
            <div className="cc-section-title"><Target size={14} /> Strategic Simulation Preview</div>
            
            <div className="cc-group">
                <div className="cc-sim-preview-v3">
                    <div className="cc-sim-header-v3">
                        <Activity size={12} />
                        <span>PROJECTED RECOVERY PREVIEW</span>
                    </div>
                    
                    <div className="cc-sim-grid-v3">
                        <div className="cc-sim-item-v3">
                            <div className="lbl">EST. RECOVERY</div>
                            <div className="val success">+{recovery}h</div>
                        </div>
                        <div className="cc-sim-item-v3">
                            <div className="lbl">CONFIDENCE</div>
                            <div className="val info">+{simResult ? simResult.confidenceGain : Math.round(activeBlock.confidence * 0.2)}%</div>
                        </div>
                        <div className="cc-sim-item-v3">
                            <div className="lbl">RISK DELTA</div>
                            <div className="val danger">-{simResult ? simResult.riskReduction : 15}%</div>
                        </div>
                        <div className="cc-sim-item-v3">
                            <div className="lbl">BOTTLENECK RECOV.</div>
                            <div className="val warning">{simResult ? simResult.bottleneckRecoveryProb : 0}%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="cc-group" style={{ marginTop: 'auto' }}>
                <div className="cc-section-title" style={{ marginBottom: 12 }}>Strategic Actions</div>
                <button 
                    className="cc-action-btn primary" 
                    onClick={() => {
                        onSimulate({
                            targetBlockId: activeNodeId,
                            expertId: activeBlock?.assignedEngineer?._id || activeBlock?.assignedEngineer,
                            strategy: 'SLA'
                        });
                    }}
                >
                    <Zap size={14} /> Simulate Optimization
                </button>
                <button 
                    className="cc-action-btn" 
                    onClick={() => {
                        onSimulate({
                            targetBlockId: activeNodeId,
                            strategy: 'LOAD'
                        });
                    }}
                >
                    <User size={14} /> Load Balancing
                </button>
                <button 
                    className="cc-action-btn" 
                    onClick={() => {
                        onSimulate({
                            targetBlockId: activeNodeId,
                            strategy: 'PATH'
                        });
                    }}
                >
                    <Database size={14} /> Critical Path Analysis
                </button>
            </div>
        </aside>
    );
};

// --- Main Component ---
const ControlCenter = () => {
    const { blocks, engineers, assignEngineer } = useOrchestration();
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [simResult, setSimResult] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [history, setHistory] = useState([]);

    // Shared Simulation State
    const [targetBlockId, setTargetBlockId] = useState('');
    const [expertId, setExpertId] = useState('');
    const [strategy, setStrategy] = useState('SLA');

    const handleRunSimulation = async (overrides = {}) => {
        const targetId = overrides.targetBlockId || targetBlockId;
        let engId = overrides.expertId || expertId;
        const strat = overrides.strategy || strategy;

        if (!targetId) return;

        // Auto-resolve best engineer if missing (e.g. from sidebar quick actions)
        if (!engId) {
            const targetBlock = blocks.find(b => (b._id || b.id) === targetId);
            const bestMatch = findBestEngineer(targetBlock, engineers, blocks);
            if (bestMatch) {
                engId = bestMatch._id || bestMatch.id;
            }
        }

        if (!engId) {
            toast.error("No valid engineer found for simulation");
            return;
        }

        const result = runOrchestrationSimulation(
            blocks, 
            engineers,
            targetId,
            engId,
            strat
        );
        setSimResult(result);
        
        // Sync UI state if it was an override (e.g. from sidebar)
        if (overrides.targetBlockId) setTargetBlockId(overrides.targetBlockId);
        if (overrides.expertId) setExpertId(overrides.expertId);
        if (overrides.strategy) setStrategy(overrides.strategy);

        toast.success('Orchestration simulation completed', {
            icon: '📊',
            style: { background: '#1c1c1e', color: '#fff', border: '1px solid var(--cc-accent)' }
        });
    };

    const handleCommitStrategy = async () => {
        setIsSimulating(true);
        if (simResult) {
            try {
                const targetBlock = blocks.find(b => (b._id || b.id) === targetBlockId);
                const isReassignment = !!targetBlock?.assignedEngineer;
                
                await assignEngineer(targetBlockId, expertId);
                setHistory(prev => [simResult, ...prev].slice(0, 10));
                setSimResult(null);
                setTargetBlockId('');
                setExpertId('');
                
                toast.success(
                    isReassignment 
                        ? `Strategic Reassignment: ${simResult.targetName} optimized.` 
                        : `Optimized ${simResult.targetName} via ${strategy} strategy`, 
                    {
                        icon: '🚀',
                        style: { background: '#1c1c1e', color: '#fff', border: '1px solid var(--cc-accent)' }
                    }
                );
            } catch (err) {
                console.error("Commit error:", err);
                toast.error("Failed to commit orchestration strategy");
            }
        }
        setIsSimulating(false);
    };

    return (
        <div className="cc-redesign-container">
            <SimulationControl 
                blocks={blocks} 
                engineers={engineers} 
                onRun={handleCommitStrategy}
                onSimulate={handleRunSimulation}
                isSimulating={isSimulating}
                activeNodeId={selectedNodeId}
                history={history}
                targetBlockId={targetBlockId}
                setTargetBlockId={setTargetBlockId}
                expertId={expertId}
                setExpertId={setExpertId}
                strategy={strategy}
                setStrategy={setStrategy}
                simResult={simResult}
            />
            
            <GraphWorkspace 
                blocks={blocks}
                simResult={simResult}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                isSimulating={isSimulating}
            />

            <StrategicInsights 
                activeNodeId={selectedNodeId}
                blocks={simResult?.optimizedBlocks || blocks}
                simResult={simResult}
                isSimulating={isSimulating}
                onSimulate={handleRunSimulation}
                setTargetBlockId={setTargetBlockId}
                setExpertId={setExpertId}
                setStrategy={setStrategy}
            />
        </div>
    );
};

export default ControlCenter;
