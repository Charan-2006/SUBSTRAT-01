import React, { useMemo } from 'react';
import { AlertTriangle, Link2, Users, Zap, Clock, BarChart3, TrendingUp, Layers } from 'lucide-react';
import { 
    calculateBottleneck, calculateHealth, calculateDependencyImpact, 
    calculateEngineerLoad, calculateSLA
} from '../../utils/workflowEngine';
import { HEALTH_STATES, STAGES, HEALTH_LABELS } from '../../constants/workflowStates';
import { useOrchestration } from '../../context/OrchestrationContext';

const IntelligencePanel = ({ collapsed, onToggle }) => {
    const { 
        blocks: contextBlocks = [], 
        kpis = {} 
    } = useOrchestration();
    const blocks = contextBlocks;

    const bottlenecks = useMemo(() => {
        return blocks
            .filter(b => b.health === HEALTH_STATES.BOTTLENECK)
            .map(b => {
                return {
                    id: b.id, 
                    name: b.name, 
                    stage: b.currentStage,
                    delayHours: b.delayHours,
                    impactCount: b.downstream?.length || 0,
                    risk: b.telemetry?.propagationRisk || 0
                };
            })
            .sort((a, b) => b.risk - a.risk)
            .slice(0, 5);
    }, [blocks]);

    const slaRisks = useMemo(() => {
        return blocks
            .filter(b => b.health === HEALTH_STATES.CRITICAL && b.health !== HEALTH_STATES.BOTTLENECK)
            .map(b => {
                return {
                    id: b.id,
                    name: b.name,
                    stage: b.currentStage,
                    stagnation: b.telemetry?.stagnationIndex || 0,
                    rejections: b.rejectionCount || 0,
                    pressure: b.telemetry?.executionPressure || 0
                };
            })
            .sort((a, b) => b.stagnation - a.stagnation)
            .slice(0, 5);
    }, [blocks]);

    const depAlerts = useMemo(() => {
        const alerts = [];
        blocks.forEach(block => {
            if (block.health === 'CRITICAL' || block.health === 'BOTTLENECK' || block.inheritedRisk > 0.3) {
                const blockers = (block.inheritedBlockers || []).map(id => blocks.find(x => x.id === id)).filter(Boolean);
                blockers.forEach(blocker => {
                    alerts.push({
                        id: `${block.id}_${blocker.id}`,
                        blocked: block.name, 
                        blocker: blocker.name,
                        risk: Math.round(block.inheritedRisk * 100),
                        severity: blocker.health,
                    });
                });
            }
        });
        return alerts.slice(0, 5);
    }, [blocks]);

    const escalations = useMemo(() => {
        return blocks
            .filter(b => b.isEscalated)
            .map(b => {
                return {
                    id: b.id,
                    name: b.name,
                    state: b.escalationState,
                    priority: b.priorityScore,
                    impactReduction: b.telemetry?.propagationRisk ? Math.round(b.telemetry.propagationRisk * 0.4) : 0
                };
            });
    }, [blocks]);

    return (
        <div className={`ws-intel-panel ${collapsed ? 'collapsed' : ''}`}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        Intelligence
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 0. Effort Metrics Summary */}
                <div className="intel-section" style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Effort Orchestration</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Effort</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{kpis.totalEstimatedHours || 0}h</div>
                            <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>Est. Project Work</div>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Actual Logged</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{(kpis.totalActualHours || 0).toFixed(1)}h</div>
                            <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>Execution Time</div>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Remaining</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--amber)' }}>{kpis.totalRemainingEffort || 0}h</div>
                            <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>Work to Complete</div>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Utilization</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: kpis.avgUtilization > 85 ? 'var(--red)' : 'var(--green)' }}>{kpis.avgUtilization || 0}%</div>
                            <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>Team Bandwidth</div>
                        </div>
                    </div>
                    
                    {kpis.overdueCount > 0 && (
                        <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)' }}>{kpis.overdueCount} BLOCKS OVERDUE SLA</span>
                        </div>
                    )}
                </div>

                {/* 0.5. Resource Alerts */}
                {(kpis.totalUnassigned > 0 || kpis.overloadedEngineers > 0) && (
                    <div className="intel-section" style={{ border: '1px solid var(--red)', background: 'rgba(239, 68, 68, 0.05)' }}>
                        <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--red)', letterSpacing: '0.04em' }}>
                            <Users size={12} style={{ color: 'var(--red)' }} />
                            <span>Resource Alerts</span>
                        </div>
                        {kpis.totalUnassigned > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--surface)', borderRadius: 4, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Unassigned Blocks</span>
                                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>{kpis.totalUnassigned}</span>
                            </div>
                        )}
                        {kpis.overloadedEngineers > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--surface)', borderRadius: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Overloaded Eng.</span>
                                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)' }}>{kpis.overloadedEngineers}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* 0.7. Pending Approvals Queue */}
                {blocks.some(b => b.status === 'REVIEW') && (
                    <div className="intel-section" style={{ border: '1px solid var(--purple)', background: 'rgba(124, 58, 237, 0.05)' }}>
                        <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple)', letterSpacing: '0.04em' }}>
                            <Clock size={12} style={{ color: 'var(--purple)' }} />
                            <span>Approval Queue</span>
                        </div>
                        {blocks.filter(b => b.status === 'REVIEW').slice(0, 3).map(b => (
                            <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--surface)', borderRadius: 4, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{b.name}</span>
                                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '2px 6px', borderRadius: 4 }}>REVIEW</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 0.8. Workflow Distribution */}
                <div className="intel-section">
                    <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                        <Layers size={12} style={{ color: 'var(--text-tertiary)' }} />
                        <span>Workflow Distribution</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'].map(s => {
                            const count = blocks.filter(b => b.status === s).length;
                            const percent = blocks.length > 0 ? (count / blocks.length) * 100 : 0;
                            return (
                                <div key={s} style={{ marginBottom: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                        <span>{s.replace('_', ' ')}</span>
                                        <span>{count}</span>
                                    </div>
                                    <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${percent}%`, background: s === 'COMPLETED' ? 'var(--green)' : s === 'REVIEW' ? 'var(--purple)' : 'var(--accent)' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 1. True Bottlenecks */}
                <div className="intel-section">
                    <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--amber)', letterSpacing: '0.04em' }}>
                        <AlertTriangle size={12} style={{ color: 'var(--amber)' }} />
                        <span>Systemic Bottlenecks ({bottlenecks.length})</span>
                    </div>
                    {bottlenecks.length > 0 ? bottlenecks.map(b => (
                        <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderLeft: '3px solid var(--amber)', borderRadius: '4px', padding: '10px 12px', marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{b.name}</div>
                                <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--amber-bg)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 4 }}>RISK {b.risk}%</span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {b.stage} stage • Affects {b.impactCount} nodes
                            </div>
                        </div>
                    )) : (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 4, border: '1px dashed var(--border)' }}>No bottlenecks active</div>
                    )}
                </div>

                {/* 2. Critical Signals */}
                <div className="intel-section">
                    <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--red)', letterSpacing: '0.04em' }}>
                        <Clock size={12} style={{ color: 'var(--red)' }} />
                        <span>Execution Criticality ({slaRisks.length})</span>
                    </div>
                    {slaRisks.length > 0 ? slaRisks.map(r => (
                        <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderLeft: '3px solid var(--red)', borderRadius: '4px', padding: '10px 12px', marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</div>
                                <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--red-bg)', color: 'var(--red)', padding: '2px 6px', borderRadius: 4 }}>{r.rejections}x REJ</span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                Stagnation: {r.stagnation}% • Pressure: {r.pressure}%
                            </div>
                        </div>
                    )) : (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 4, border: '1px dashed var(--border)' }}>No critical risks</div>
                    )}
                </div>

                {/* 3. Propagation Alerts */}
                <div className="intel-section">
                    <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                        <Link2 size={12} style={{ color: 'var(--text-tertiary)' }} />
                        <span>Propagation Alerts ({depAlerts.length})</span>
                    </div>
                    {depAlerts.length > 0 ? depAlerts.map(a => (
                        <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '10px 12px', marginBottom: 6 }}>
                            <div style={{ fontSize: 10.5, color: 'var(--text-primary)', fontWeight: 600 }}>
                                {a.blocker} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>impacting</span> {a.blocked}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>
                                Inherited Risk: {a.risk}% • Upstream {a.severity}
                            </div>
                        </div>
                    )) : (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px 12px', background: 'var(--surface)', borderRadius: 4, border: '1px dashed var(--border)' }}>No propagation active</div>
                    )}
                </div>

                {/* 4. Escalated Priority */}
                {escalations.length > 0 && (
                    <div className="intel-section">
                        <div className="intel-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple)', letterSpacing: '0.04em' }}>
                            <Zap size={12} style={{ color: 'var(--purple)' }} />
                            <span>Escalated Priority ({escalations.length})</span>
                        </div>
                        {escalations.map(e => (
                            <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderLeft: '3px solid var(--purple)', borderRadius: '4px', padding: '10px 12px', marginBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{e.name}</div>
                                    <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--purple-bg)', color: 'var(--purple)', padding: '2px 6px', borderRadius: 4 }}>P-SCORE {e.priority}</span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                    Systemic Relief: -{e.impactReduction}% propagation risk
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntelligencePanel;
