import React, { useMemo } from 'react';
import { AlertTriangle, Link2, Users, Zap, Clock, BarChart3, TrendingUp, Layers, ChevronRight } from 'lucide-react';
import { HEALTH_STATES } from '../../constants/workflowStates';
import { useOrchestration } from '../../context/OrchestrationContext';
import { formatDuration } from '../../utils/workflowEngine';

const IntelligencePanel = ({ collapsed, requests = [], onApproveRequest, onRejectRequest }) => {
    const { 
        blocks = [], 
        kpis = {} 
    } = useOrchestration();

    const pendingRequests = useMemo(() => {
        return (requests || []).filter(r => r.status === 'PENDING').map(r => {
            // Support both populated object and flat ID string
            const blockName = r.blockId?.name || blocks.find(b => b._id === r.blockId)?.name || 'Global Request';
            return { ...r, blockName };
        });
    }, [requests, blocks]);

    const bottlenecks = useMemo(() => {
// ... (rest of useMemo logic remains the same)
        return blocks
            .filter(b => b.health === HEALTH_STATES.BOTTLENECK)
            .map(b => ({
                id: b._id || b.id, 
                name: b.name, 
                stage: b.currentStage,
                delayHours: b.delayHours,
                impactCount: b.telemetry?.downstreamImpact || 0,
                risk: b.telemetry?.propagationRisk || 0
            }))
            .sort((a, b) => b.risk - a.risk)
            .slice(0, 5);
    }, [blocks]);

    const slaRisks = useMemo(() => {
        return blocks
            .filter(b => b.health === HEALTH_STATES.CRITICAL && b.health !== HEALTH_STATES.BOTTLENECK)
            .map(b => ({
                id: b._id || b.id,
                name: b.name,
                stage: b.currentStage,
                stagnation: b.telemetry?.stagnationIndex || 0,
                rejections: b.rejectionCount || 0,
                pressure: b.telemetry?.executionPressure || 0
            }))
            .sort((a, b) => b.pressure - a.pressure)
            .slice(0, 5);
    }, [blocks]);

    const depAlerts = useMemo(() => {
        const alerts = [];
        blocks.forEach(block => {
            if (block.inheritedRisk > 0.1) {
                const blockers = (block.inheritedBlockers || []).map(id => blocks.find(x => (x._id || x.id) === id)).filter(Boolean);
                blockers.forEach(blocker => {
                    alerts.push({
                        id: `${(block._id || block.id)}_${(blocker._id || blocker.id)}`,
                        blocked: block.name, 
                        blocker: blocker.name,
                        risk: Math.round(block.inheritedRisk * 100),
                        severity: blocker.health,
                    });
                });
            }
        });
        return alerts.sort((a, b) => b.risk - a.risk).slice(0, 5);
    }, [blocks]);

    const escalations = useMemo(() => {
        return blocks
            .filter(b => b.isEscalated)
            .map(b => ({
                id: b._id || b.id,
                name: b.name,
                state: b.escalationState,
                priority: b.priorityScore,
                impactReduction: Math.round((b.telemetry?.propagationRisk || 0) * 0.4)
            }))
            .sort((a, b) => b.priority - a.priority);
    }, [blocks]);

    const distribution = useMemo(() => {
        const stages = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
        return stages.map(s => {
            const count = blocks.filter(b => b.status === s).length;
            const percent = blocks.length > 0 ? (count / blocks.length) * 100 : 0;
            return { stage: s, count, percent };
        });
    }, [blocks]);

    return (
        <div className={`ws-intel-panel ${collapsed ? 'collapsed' : ''}`}>
            {/* Header */}
            <div className="intel-panel-header">
                <div className="header-main">
                    <Zap size={14} className="zap-icon" />
                    <span>Orchestration Intelligence</span>
                </div>
            </div>

            <div className="intel-scroll-area">
                {/* 1. EXECUTION EFFORT ENGINE */}
                <div className="intel-card effort-engine">
                    <div className="card-header">
                        <BarChart3 size={14} />
                        <span>Effort Telemetry</span>
                    </div>
                    
                    {(!blocks || blocks.length === 0) ? (
                        <div style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 11 }}>
                            Loading telemetry data...
                        </div>
                    ) : (
                        <>
                            <div className="metrics-compact-grid">
                                <div className="metric-box" title="Remaining Effort: Total estimated hours left across all unfinished blocks.">
                                    <label>Remaining</label>
                                    <value className="amber">{formatDuration(kpis.totalRemainingEffort)}</value>
                                    <subLabel>To Complete</subLabel>
                                </div>
                                <div className="metric-box" title="Actual Logged: Total cumulative engineering hours across all blocks.">
                                    <label>Actual Logged</label>
                                    <value className="accent">{formatDuration(kpis.totalActualHours)}</value>
                                    <subLabel>Real-time Dev</subLabel>
                                </div>
                                <div className="metric-box" title="SLA Variance: Difference between total actual effort and total estimated effort.">
                                    <label>SLA Variance</label>
                                    <value className={kpis.totalVariance <= 0 ? 'green' : kpis.totalVariance < 10 ? 'amber' : 'red'}>
                                        {kpis.totalVariance > 0 ? `+${formatDuration(kpis.totalVariance)}` : formatDuration(kpis.totalVariance)}
                                    </value>
                                    <subLabel>Project Drift</subLabel>
                                </div>
                                <div className="metric-box" title="Team Utilization: Percentage of active engineers out of total available capacity.">
                                    <label>Utilization</label>
                                    <value className={kpis.avgUtilization > 80 ? 'red' : kpis.avgUtilization > 40 ? 'green' : 'amber'}>
                                        {kpis.avgUtilization}%
                                    </value>
                                    <subLabel>Team Load</subLabel>
                                </div>
                            </div>
                            
                            {/* Dependency Pressure */}
                            {kpis.dependencyPressureScore > 0 && (
                                <div className="telemetry-subcard" title="Dependency-Aware Execution Pressure: Overall risk introduced by stalled downstream dependencies.">
                                    <div className="flex-row">
                                        <label>Dependency Pressure</label>
                                        <value className="amber">{kpis.dependencyPressureScore} pts</value>
                                    </div>
                                    {kpis.highestPropagationRiskBlock && (
                                        <div className="subtext">
                                            Highest Risk: {kpis.highestPropagationRiskBlock.name}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SLA Breach Detection */}
                            {kpis.overdueCount > 0 && (
                                <div className="critical-alert-bar pulse" title={`SLA Breach Detection: ${kpis.breachedPercentage}% of blocks have exceeded SLA.`}>
                                    <AlertTriangle size={12} />
                                    <span>{kpis.overdueCount} BLOCKS BREACHED SLA ({kpis.breachedPercentage}%)</span>
                                </div>
                            )}
                            {kpis.highestDriftWorkflow && (
                                <div className="subtext" style={{ padding: '0 12px 12px', fontSize: '9px', color: 'var(--red)', marginTop: '-8px' }}>
                                    Highest Drift: {kpis.highestDriftWorkflow.name}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 2. WORKFLOW DISTRIBUTION */}
                <div className="intel-card">
                    <div className="card-header">
                        <Layers size={14} />
                        <span>Workflow Distribution</span>
                    </div>
                    <div className="dist-list">
                        {distribution.map(d => (
                            <div key={d.stage} className="dist-item">
                                <div className="dist-info">
                                    <span className="stage-lbl">{d.stage.replace(/_/g, ' ')}</span>
                                    <span className="count-lbl">{d.count}</span>
                                </div>
                                <div className="progress-track">
                                    <div 
                                        className={`progress-fill ${d.stage}`} 
                                        style={{ width: `${d.percent}%` }} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 0. OPERATIONAL REQUESTS (New) */}
                <div className="intel-card requests-engine">
                    <div className="card-header purple">
                        <Users size={14} />
                        <span>Execution Requests ({pendingRequests.length})</span>
                    </div>
                    {pendingRequests.length > 0 ? (
                        <div className="requests-list">
                            {pendingRequests.map(req => (
                                <div key={req._id} className="request-item signal-item">
                                    <div className="signal-header">
                                        <span className="name">{req.type}</span>
                                        <span className="badge amber">PENDING</span>
                                    </div>
                                    <div className="request-body">
                                        <div className="request-meta">
                                            <div className="meta-row">
                                                <Users size={10} />
                                                <span>Requester: <strong>{req.requestedBy?.displayName || 'Engineer'}</strong></span>
                                            </div>
                                            <div className="meta-row">
                                                <Layers size={10} />
                                                <span>Target Block: <strong>{req.blockName}</strong></span>
                                            </div>
                                            <div className="meta-row">
                                                <Clock size={10} />
                                                <span>Submitted: <strong>{req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</strong></span>
                                            </div>
                                        </div>
                                        <div className="request-reason-box">
                                            <div className="reason-label">JUSTIFICATION:</div>
                                            <div className="reason-text">{req.reason || req.description || req.message || 'No technical justification provided.'}</div>
                                        </div>
                                    </div>
                                    <div className="request-actions">
                                        <button 
                                            className="req-btn approve"
                                            onClick={() => onApproveRequest(req._id)}
                                        >
                                            Approve
                                        </button>
                                        <button 
                                            className="req-btn reject"
                                            onClick={() => onRejectRequest(req._id)}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-signal">No pending engineer requests.</div>
                    )}
                </div>

                {/* 3. SYSTEMIC BOTTLENECKS */}
                <div className="intel-card">
                    <div className="card-header amber">
                        <AlertTriangle size={14} />
                        <span>Systemic Bottlenecks ({bottlenecks.length})</span>
                    </div>
                    {bottlenecks.length > 0 ? bottlenecks.map(b => (
                        <div key={b.id} className="signal-item bottleneck">
                            <div className="signal-header">
                                <span className="name">{b.name}</span>
                                <span className="badge">RISK {Math.round(b.risk)}%</span>
                            </div>
                            <div className="signal-meta">
                                {b.stage} • Impacts {b.impactCount} downstream nodes
                            </div>
                        </div>
                    )) : (
                        <div className="empty-signal">No active bottlenecks detected.</div>
                    )}
                </div>

                {/* 4. EXECUTION CRITICALITY */}
                <div className="intel-card">
                    <div className="card-header red">
                        <Clock size={14} />
                        <span>Execution Criticality ({slaRisks.length})</span>
                    </div>
                    {slaRisks.length > 0 ? slaRisks.map(r => (
                        <div key={r.id} className="signal-item critical">
                            <div className="signal-header">
                                <span className="name">{r.name}</span>
                                <span className="badge">{r.rejections}x REJ</span>
                            </div>
                            <div className="signal-meta">
                                Pressure: {r.pressure}% • Stagnation: {r.stagnation}%
                            </div>
                        </div>
                    )) : (
                        <div className="empty-signal">No critical execution risks.</div>
                    )}
                </div>

                {/* 5. PROPAGATION ALERTS */}
                <div className="intel-card">
                    <div className="card-header">
                        <Link2 size={14} />
                        <span>Propagation Alerts ({depAlerts.length})</span>
                    </div>
                    {depAlerts.length > 0 ? depAlerts.map(a => (
                        <div key={a.id} className="propagation-item">
                            <div className="prop-text">
                                <strong>{a.blocker}</strong> impacting <strong>{a.blocked}</strong>
                            </div>
                            <div className="prop-meta">
                                Inherited Risk: {a.risk}% • Upstream {a.severity}
                            </div>
                        </div>
                    )) : (
                        <div className="empty-signal">No cascading impact detected.</div>
                    )}
                </div>

                {/* 6. ESCALATED PRIORITY */}
                {escalations.length > 0 && (
                    <div className="intel-card">
                        <div className="card-header purple">
                            <Zap size={14} />
                            <span>Escalated Priority ({escalations.length})</span>
                        </div>
                        {escalations.map(e => (
                            <div key={e.id} className="signal-item escalated">
                                <div className="signal-header">
                                    <span className="name">{e.name}</span>
                                    <span className="badge">P-SCORE {e.priority}</span>
                                </div>
                                <div className="signal-meta">
                                    Strategic relief: -{e.impactReduction}% propagation risk
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
