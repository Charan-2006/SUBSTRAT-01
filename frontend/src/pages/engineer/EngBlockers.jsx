import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Link2, Zap, ShieldAlert, ChevronRight, Activity, CheckCircle2 } from 'lucide-react';
import { 
    calculateSLA, 
    calculateHealth, 
    calculateDependencyImpact,
    formatDuration 
} from '../../utils/workflowEngine';

const TYPES = [
    { id: 'dependency', label: 'Upstream Dependency Block', icon: Link2, clr: '#d97706' },
    { id: 'review', label: 'Execution Lock: Review Pending', icon: Clock, clr: '#7c3aed' },
    { id: 'congestion', label: 'Resource Congestion / SLA Breach', icon: AlertTriangle, clr: '#dc2626' },
    { id: 'rejection', label: 'Systemic Failure: Repeated Rejection', icon: Zap, clr: '#dc2626' },
];

const EngBlockers = ({ active = [], onSelectBlock, onEscalate, blocks = [] }) => {
    
    const blockers = useMemo(() => {
        const list = [];
        active.forEach(b => {
            const { upstream, allDownstream = [] } = calculateDependencyImpact(b, blocks);
            const critUpstream = upstream.filter(u => u.healthStatus === 'CRITICAL' || u.healthStatus === 'RISK');
            
            critUpstream.forEach(u => list.push({
                type: 'dependency',
                block: b,
                detail: `Waiting on ${u.name} (${u.healthStatus}). Upstream stall preventing execution.`,
                sev: u.healthStatus === 'CRITICAL' ? 'critical' : 'warning',
                updatedAt: b.updatedAt,
                downstreamCount: (allDownstream || []).length
            }));

            if (b.status === 'REVIEW' && b.healthStatus !== 'HEALTHY') {
                list.push({
                    type: 'review',
                    block: b,
                    detail: 'Technical review bottleneck. Workflow locked until reviewer approval.',
                    sev: 'warning',
                    updatedAt: b.stageStartTime || b.updatedAt,
                    downstreamCount: allDownstream.length
                });
            }

            const sla = calculateSLA(b);
            if (sla.delayHours > 2 && !critUpstream.length) {
                list.push({
                    type: 'congestion',
                    block: b,
                    detail: `Severe SLA deviation (+${formatDuration(sla.delayHours)}). Immediate resource redistribution required.`,
                    sev: 'critical',
                    updatedAt: b.stageStartTime || b.updatedAt,
                    downstreamCount: allDownstream.length
                });
            }

            if (b.rejectionCount >= 2) {
                list.push({
                    type: 'rejection',
                    block: b,
                    detail: `Critical failure loop: ${b.rejectionCount} sequential rejections detected.`,
                    sev: 'critical',
                    updatedAt: b.updatedAt,
                    downstreamCount: allDownstream.length
                });
            }
        });
        
        return list.sort((a, b) => (b.sev === 'critical' ? 1 : 0) - (a.sev === 'critical' ? 1 : 0) || b.downstreamCount - a.downstreamCount);
    }, [active, blocks]);

    const grouped = useMemo(() => {
        const g = { dependency: [], review: [], congestion: [], rejection: [] };
        blockers.forEach(b => { if (g[b.type]) g[b.type].push(b); });
        return g;
    }, [blockers]);

    return (
        <div className="ew-page-content fade-in">
            <div className="ew-sh"><ShieldAlert size={14} className="text-danger" /> Systemic Blockers ({blockers.length})</div>
            
            <div className="ew-grid">
                <div className="ew-col">
                    {!blockers.length && (
                        <div className="ew-empty" style={{ padding: 64 }}>
                            <CheckCircle2 size={32} className="text-success" style={{ marginBottom: 12, opacity: 0.5 }} />
                            <div style={{ fontSize: 14, fontWeight: 700 }}>Zero Execution Blockers</div>
                            <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>All assigned workflows are proceeding within nominal parameters.</p>
                        </div>
                    )}

                    {TYPES.map(type => {
                        const items = grouped[type.id] || [];
                        if (!items.length) return null;
                        return (
                            <div key={type.id} style={{ marginBottom: 24 }}>
                                <div className="ew-sh" style={{ color: type.clr, borderBottom: '1px solid var(--border-light)', paddingBottom: 8, marginBottom: 12 }}>
                                    <type.icon size={14} /> {type.label} ({items.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {items.map((bl, i) => (
                                        <div key={`${bl.block._id}_${i}`} className="ew-wf" onClick={() => onSelectBlock?.(bl.block)}>
                                            <div className="ew-wf-header">
                                                <div className="ew-wf-name">{bl.block.name}</div>
                                                <div className="ew-wf-badges">
                                                    <span className={`ew-t ${bl.sev === 'critical' ? 't-red' : 't-amb'}`}>{bl.sev}</span>
                                                    <span className="ew-t t-gry">{bl.block.status.replace('_', ' ')}</span>
                                                </div>
                                            </div>
                                            <div className="ew-wf-body">
                                                <div className="ew-wf-task" style={{ color: bl.sev === 'critical' ? '#dc2626' : 'var(--text-primary)' }}>
                                                    {bl.detail}
                                                </div>
                                                <div className="ew-wf-meta">
                                                    {bl.downstreamCount > 0 && <span className="text-warning"><Activity size={11} /> Impact: {bl.downstreamCount} Downstream Nodes</span>}
                                                    {bl.updatedAt && <span><Clock size={11} /> Stalled since {new Date(bl.updatedAt).toLocaleTimeString()}</span>}
                                                </div>
                                            </div>
                                            <div className="ew-wf-footer" onClick={e => e.stopPropagation()}>
                                                <button className="ew-b" onClick={() => onSelectBlock?.(bl.block)}><ChevronRight size={12} /> View Dependencies</button>
                                                {!bl.block.escalated ? (
                                                    <button className="ew-b b-red" onClick={() => onEscalate?.(bl.block._id)}><AlertTriangle size={12} /> Escalate</button>
                                                ) : (
                                                    <span className="ew-t t-red">Escalated</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="ew-side">
                    <div className="ew-sp">
                        <div className="ew-sp-title"><Activity size={12} /> Risk Density</div>
                        <div className="ew-sp-content">
                            <div className="ew-sp-row">
                                <span>Critical Blockers</span>
                                <span className="text-danger" style={{ fontWeight: 800 }}>{blockers.filter(b => b.sev === 'critical').length}</span>
                            </div>
                            <div className="ew-sp-row">
                                <span>Warnings</span>
                                <span className="text-warning" style={{ fontWeight: 800 }}>{blockers.filter(b => b.sev === 'warning').length}</span>
                            </div>
                            <div className="ew-sp-row">
                                <span>Unique Affected Nodes</span>
                                <span style={{ fontWeight: 800 }}>{new Set(blockers.map(b => b.block._id)).size}</span>
                            </div>
                        </div>
                    </div>

                    <div className="ew-sp">
                        <div className="ew-sp-title"><Link2 size={12} /> Top propagation Risks</div>
                        <div className="ew-sp-content">
                            {blockers.filter(b => b.downstreamCount > 0).slice(0, 5).map((bl, i) => (
                                <div key={i} className="ew-sp-row">
                                    <span>{bl.block.name}</span>
                                    <span className="ew-t t-amb">{bl.downstreamCount} Downstream</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngBlockers;
