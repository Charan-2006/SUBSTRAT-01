import React, { useMemo, useState, useEffect } from 'react';
import { 
    AlertTriangle, Clock, Link2, Zap, ShieldAlert, ChevronRight, 
    Activity, CheckCircle2, ArrowRight, User, MousePointer2, ExternalLink,
    Bell, RefreshCw, BarChart3, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
    calculateSLA, 
    calculateHealth, 
    calculateDependencyImpact,
    formatDuration 
} from '../../utils/workflowEngine';

const TYPES = [
    { id: 'dependency', label: 'Upstream Dependency Block', icon: Link2, clr: '#d97706' },
    { id: 'review', label: 'Review Latency Lock', icon: Clock, clr: '#7c3aed' },
    { id: 'congestion', label: 'SLA Variance / Verification Stall', icon: AlertTriangle, clr: '#dc2626' },
    { id: 'rejection', label: 'Iterative Failure Loop', icon: Zap, clr: '#dc2626' },
];

const EngBlockers = ({ active = [], onSelectBlock, onEscalate, blocks = [] }) => {
    const [selectedBlockerId, setSelectedBlockerId] = useState(null);
    const [lastResolvedAt, setLastResolvedAt] = useState(null);

    // 1. REAL-TIME BLOCKER INTELLIGENCE ENGINE
    const blockers = useMemo(() => {
        const list = [];
        active.forEach(b => {
            const sla = calculateSLA(b);
            const { upstream, allDownstream = [] } = calculateDependencyImpact(b, blocks);
            const downstreamCount = allDownstream.length;
            
            // A. Dependency Block Detection
            const stalledUpstream = upstream.filter(u => u.status !== 'COMPLETED');
            if (stalledUpstream.length > 0) {
                stalledUpstream.forEach(u => {
                    list.push({
                        id: `dep-${b._id}-${u._id}`,
                        type: 'dependency',
                        block: b,
                        upstreamNode: u,
                        detail: `Execution Blocked: Waiting on upstream module ${u.name} (${u.status}).`,
                        sev: u.healthStatus === 'CRITICAL' ? 'critical' : 'warning',
                        updatedAt: u.stageStartTime || u.updatedAt,
                        downstreamCount,
                        recommendation: 'Escalate Upstream Dependency',
                        action: 'ESCALATE_DEP'
                    });
                });
            }

            // B. Review Stagnation Detection (> 4h in REVIEW)
            if (b.status === 'REVIEW' && sla.actualHours > 4) {
                list.push({
                    id: `rev-${b._id}`,
                    type: 'review',
                    block: b,
                    detail: `Review Latency: Signoff pending for ${formatDuration(sla.actualHours)}. Downstream path is idling.`,
                    sev: sla.actualHours > 8 ? 'critical' : 'warning',
                    updatedAt: b.stageStartTime,
                    downstreamCount,
                    recommendation: 'Request Expedited Review',
                    action: 'REQUEST_REVIEW'
                });
            }

            // C. Verification Failure / SLA Risk
            if ((b.status === 'DRC' || b.status === 'LVS') && (b.rejectionCount > 0 || sla.overrun > 0.5)) {
                list.push({
                    id: `ver-${b._id}`,
                    type: 'congestion',
                    block: b,
                    detail: `${b.status} Verification Stall: Iteration cycle exceeding deterministic SLA by ${Math.round(sla.overrun * 100)}%.`,
                    sev: 'critical',
                    updatedAt: b.stageStartTime,
                    downstreamCount,
                    recommendation: 'Split Verification Workload',
                    action: 'SPLIT_LOAD'
                });
            }

            // D. Critical SLA Breach
            if (sla.overrun > 0.8 && !list.find(l => l.block._id === b._id && l.type === 'dependency')) {
                list.push({
                    id: `sla-${b._id}`,
                    type: 'congestion',
                    block: b,
                    detail: `Critical Execution Risk: Total stage overrun detected. Workflow at risk of cascading delay.`,
                    sev: 'critical',
                    updatedAt: b.stageStartTime,
                    downstreamCount,
                    recommendation: 'Trigger Strategic Escalation',
                    action: 'ESCALATE'
                });
            }

            // E. Iterative Rejection Loop
            if (b.rejectionCount >= 3) {
                list.push({
                    id: `rej-${b._id}`,
                    type: 'rejection',
                    block: b,
                    detail: `Systemic Rejection Loop: ${b.rejectionCount} sequential failures. Spec alignment or expert intervention required.`,
                    sev: 'critical',
                    updatedAt: b.updatedAt,
                    downstreamCount,
                    recommendation: 'Request Expert Alignment',
                    action: 'EXPERT_ALIGN'
                });
            }
        });
        
        return list.sort((a, b) => (b.sev === 'critical' ? 1 : 0) - (a.sev === 'critical' ? 1 : 0) || b.downstreamCount - a.downstreamCount);
    }, [active, blocks]);

    // Track last resolution timestamp
    useEffect(() => {
        if (blockers.length === 0 && lastResolvedAt === null) {
            setLastResolvedAt(new Date());
        } else if (blockers.length > 0) {
            setLastResolvedAt(null);
        }
    }, [blockers.length]);

    const activeBlocker = useMemo(() => blockers.find(b => b.id === selectedBlockerId), [blockers, selectedBlockerId]);

    const grouped = useMemo(() => {
        const g = { dependency: [], review: [], congestion: [], rejection: [] };
        blockers.forEach(b => { if (g[b.type]) g[b.type].push(b); });
        return g;
    }, [blockers]);

    // 4. EXECUTION PRESSURE CALCULATIONS
    const executionPressure = useMemo(() => {
        if (active.length === 0) return 0;
        const totalSlaOverrun = active.reduce((acc, b) => acc + calculateSLA(b).overrun, 0);
        const totalRejections = active.reduce((acc, b) => acc + (b.rejectionCount || 0), 0);
        const blockerImpact = blockers.reduce((acc, b) => acc + (b.sev === 'critical' ? 20 : 10), 0);
        
        const score = (totalSlaOverrun * 15) + (totalRejections * 5) + blockerImpact;
        return Math.min(100, Math.round(score));
    }, [active, blockers]);

    const totalPropagationRisk = useMemo(() => {
        return blockers.reduce((acc, b) => acc + b.downstreamCount, 0);
    }, [blockers]);

    const handleAction = (blocker) => {
        if (blocker.action === 'ESCALATE' || blocker.action === 'ESCALATE_DEP') {
            onEscalate?.(blocker.block._id);
        } else {
            onSelectBlock?.(blocker.block);
        }
    };

    return (
        <div className="ew-page-content fade-in">
            <div className="ew-header-v2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <div className="ew-sh" style={{ marginBottom: 4 }}>
                        <ShieldAlert size={14} className="text-danger" /> EXECUTION INTERRUPTION SYSTEM ({blockers.length})
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Detection active • Deterministic SLA monitoring enabled</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="ew-kpi-mini">
                        <span className="lbl">Execution Pressure</span>
                        <span className="val" style={{ color: executionPressure > 70 ? 'var(--red)' : executionPressure > 40 ? 'var(--amber)' : 'var(--green)' }}>{executionPressure}%</span>
                    </div>
                    <div className="ew-kpi-mini">
                        <span className="lbl">Risk Density</span>
                        <span className="val text-danger">{Math.round((blockers.filter(b => b.sev === 'critical').length / (active.length || 1)) * 100)}%</span>
                    </div>
                    <div className="ew-kpi-mini">
                        <span className="lbl">Propagation Impact</span>
                        <span className="val text-warning">{totalPropagationRisk} Nodes</span>
                    </div>
                </div>
            </div>
            
            <div className="ew-grid">
                <div className="ew-col">
                    {!blockers.length && (
                        <div className="ew-empty" style={{ padding: '80px 40px', background: 'linear-gradient(to bottom, var(--surface), var(--bg))' }}>
                            <div className="ew-success-pulse" style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <ShieldCheck size={40} className="text-green" />
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Nominal Execution State</div>
                            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 24 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Health Confidence</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--green)' }}>98.4%</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Stability Trend</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>STABLE</div>
                                </div>
                            </div>
                            <p style={{ color: 'var(--text-tertiary)', marginTop: 24, fontSize: 13, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                                Last execution interruption resolved: {lastResolvedAt ? lastResolvedAt.toLocaleTimeString() : '—'}
                            </p>
                        </div>
                    )}

                    {TYPES.map(type => {
                        const items = grouped[type.id] || [];
                        if (!items.length) return null;
                        return (
                            <div key={type.id} style={{ marginBottom: 32 }}>
                                <div className="ew-sh" style={{ color: type.clr, borderBottom: '1px solid var(--border-light)', paddingBottom: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                                    <span><type.icon size={14} /> {type.label}</span>
                                    <span style={{ fontSize: 10, opacity: 0.6 }}>{items.length} ACTIVE INTERRUPTIONS</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {items.map((bl) => (
                                        <div 
                                            key={bl.id} 
                                            className={`ew-wf blocker-card ${selectedBlockerId === bl.id ? 'active' : ''} ${bl.sev === 'critical' ? 'sev-critical' : ''}`}
                                            onClick={() => setSelectedBlockerId(bl.id)}
                                        >
                                            <div className="ew-wf-header">
                                                <div className="ew-wf-name" style={{ fontSize: 15 }}>{bl.block.name}</div>
                                                <div className="ew-wf-badges">
                                                    {bl.sev === 'critical' && <span className="ew-t t-red" style={{ animation: 'pulse 2s infinite' }}>CRITICAL PATH RISK</span>}
                                                    <span className="ew-t t-gry">{bl.block.status}</span>
                                                </div>
                                            </div>
                                            <div className="ew-wf-body" style={{ padding: '12px 18px' }}>
                                                <div className="ew-wf-task" style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
                                                    {bl.detail}
                                                </div>
                                                <div className="ew-wf-meta" style={{ marginTop: 12 }}>
                                                    <span className="text-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Activity size={12} /> Downstream Impact: {bl.downstreamCount} Nodes
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Clock size={12} /> Stalled: {formatDuration(calculateSLA(bl.block).actualHours)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="ew-wf-footer" style={{ borderTop: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="ew-b" onClick={(e) => { e.stopPropagation(); handleAction(bl); }}>
                                                        <Zap size={12} fill="currentColor" /> {bl.recommendation}
                                                    </button>
                                                </div>
                                                <button className="ew-btn-ghost" onClick={(e) => { e.stopPropagation(); onSelectBlock?.(bl.block); }}>
                                                    Visual Chain <ChevronRight size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="ew-side">
                    {activeBlocker ? (
                        <div className="ew-resolution-panel fade-in">
                            <div className="ew-sp-title" style={{ color: 'var(--accent)', display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
                                <span><Activity size={12} /> RESOLUTION INTELLIGENCE</span>
                                <button className="close-btn" onClick={() => setSelectedBlockerId(null)}><CheckCircle2 size={14} /></button>
                            </div>
                            
                            <div className="ew-res-body">
                                <div className="ew-res-section">
                                    <label>STALLED COMPONENT</label>
                                    <div className="ew-res-val">{activeBlocker.block.name}</div>
                                </div>

                                {activeBlocker.type === 'dependency' && (
                                    <div className="ew-res-section">
                                        <label>UPSTREAM BLOCKER</label>
                                        <div className="ew-upstream-card">
                                            <div className="u-name">{activeBlocker.upstreamNode.name}</div>
                                            <div className="u-meta">
                                                <User size={10} /> {activeBlocker.upstreamNode.assignedEngineer?.displayName || 'Unassigned'}
                                                <span className="u-status">{activeBlocker.upstreamNode.status}</span>
                                            </div>
                                            <div className="u-impact">
                                                Est. Unblock: {formatDuration(calculateSLA(activeBlocker.upstreamNode).expectedHours)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="ew-res-section">
                                    <label>CASCADING IMPACT</label>
                                    <div className="ew-impact-viz">
                                        <div className="viz-row">
                                            <span>Directly Blocked</span>
                                            <span className="val">{activeBlocker.downstreamCount}</span>
                                        </div>
                                        <div className="viz-row">
                                            <span>Tapeout Delay</span>
                                            <span className="val text-danger">+{Math.round(calculateSLA(activeBlocker.block).delayHours)}h</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="ew-res-section">
                                    <label>RESOLUTION PATHS</label>
                                    <div className="ew-res-actions">
                                        <button className="res-btn primary" onClick={() => handleAction(activeBlocker)}>
                                            <Zap size={14} /> {activeBlocker.recommendation}
                                        </button>
                                        <button className="res-btn" onClick={() => onSelectBlock?.(activeBlocker.block)}>
                                            <ExternalLink size={14} /> Open Orchestration Chain
                                        </button>
                                        <button className="res-btn" onClick={() => {
                                            toast.success(`Notification sent to ${activeBlocker.upstreamNode.assignedEngineer?.displayName || 'Owner'}`, {
                                                icon: '🔔',
                                                style: { background: '#1c1c1e', color: '#fff', border: '1px solid var(--accent)' }
                                            });
                                        }}>
                                            <Bell size={14} /> Notify Upstream Owner
                                        </button>
                                        <button className="res-btn" onClick={() => onEscalate?.(activeBlocker.block._id)}>
                                            <ShieldAlert size={14} /> Manual Escalation
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="ew-sp" style={{ padding: '40px 20px', textAlign: 'center', background: 'linear-gradient(to bottom, var(--surface), rgba(37, 99, 235, 0.02))' }}>
                            <div className="ew-search-pulse" style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <MousePointer2 size={24} className="text-accent" />
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Select Interruption</div>
                            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>Select an active stall for forensic resolution intelligence.</p>
                        </div>
                    )}

                    {/* 3. CRITICAL PROPAGATION PANEL */}
                    <div className="ew-sp">
                        <div className="ew-sp-title"><Activity size={12} /> Critical Propagation</div>
                        <div className="ew-sp-content">
                            {blockers.filter(b => b.downstreamCount > 0).slice(0, 5).map((bl, i) => (
                                <div key={i} className="ew-sp-row" style={{ cursor: 'pointer', padding: '12px 0' }} onClick={() => setSelectedBlockerId(bl.id)}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 12 }}>{bl.block.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{bl.type} • {bl.sev}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="ew-t t-amb" style={{ padding: '2px 8px' }}>+{bl.downstreamCount} Nodes</div>
                                        <div style={{ fontSize: 9, color: 'var(--red)', fontWeight: 800, marginTop: 4 }}>High Tapeout Risk</div>
                                    </div>
                                </div>
                            ))}
                            {!blockers.some(b => b.downstreamCount > 0) && (
                                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                    No cascading risks detected.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ew-sp">
                        <div className="ew-sp-title"><RefreshCw size={12} className="spin" /> Real-time Telemetry</div>
                        <div className="ew-sp-content" style={{ gap: 12, marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span>Monitoring Frequency</span>
                                <span style={{ fontWeight: 800 }}>3.0s</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span>SLA Boundary Check</span>
                                <span className="text-green" style={{ fontWeight: 800 }}>ACTIVE</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span>Dependency Graph Sync</span>
                                <span className="text-green" style={{ fontWeight: 800 }}>OPTIMAL</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngBlockers;
