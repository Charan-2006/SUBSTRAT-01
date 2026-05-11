import React, { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle, MessageSquare, Play, Activity, Layers } from 'lucide-react';
import { calculateSLA, formatDuration } from '../../utils/workflowEngine';

const EngReviews = ({ myBlocks = [], onSelectBlock }) => {
    const awaiting = useMemo(() => myBlocks.filter(b => b.status === 'REVIEW'), [myBlocks]);
    const rejected = useMemo(() => myBlocks.filter(b => b.rejectionCount > 0 && b.status !== 'COMPLETED' && b.status !== 'REVIEW'), [myBlocks]);
    const approved = useMemo(() => myBlocks.filter(b => b.status === 'COMPLETED'), [myBlocks]);
    
    const totalProcessed = approved.length + rejected.length;
    const approvalRate = totalProcessed ? Math.round((approved.length / totalProcessed) * 100) : 100;

    const sections = [
        { id: 'aw', label: 'Technical Review: Awaiting Approval', items: awaiting, icon: Clock, colorClass: 't-pur', empty: 'No active reviews pending.' },
        { id: 'rj', label: 'Review Failed: Action Required', items: rejected, icon: AlertTriangle, colorClass: 't-red', empty: 'No rejected workflows detected.' },
        { id: 'ok', label: 'Verification History', items: approved.slice(0, 8), icon: CheckCircle2, colorClass: 't-grn', empty: 'No completed verifications yet.' },
    ];

    return (
        <div className="ew-page-content fade-in">
            <div className="ew-grid">
                <div className="ew-col">
                    {sections.map(section => (
                        <div key={section.id} style={{ marginBottom: 24 }}>
                            <div className="ew-sh" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 8, marginBottom: 12 }}>
                                <section.icon size={14} /> {section.label} ({section.items.length})
                            </div>
                            
                            {!section.items.length && (
                                <div className="ew-empty" style={{ padding: 24 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{section.empty}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {section.items.map(b => {
                                    const sla = calculateSLA(b);
                                    return (
                                        <div key={b._id} className="ew-wf" onClick={() => onSelectBlock?.(b)}>
                                            <div className="ew-wf-header">
                                                <div className="ew-wf-name">{b.name}</div>
                                                <div className="ew-wf-badges">
                                                    <span className={`ew-t ${section.colorClass}`}>
                                                        {section.id === 'rj' ? `${b.rejectionCount}× REJECTED` : section.id === 'ok' ? 'APPROVED' : 'PENDING'}
                                                    </span>
                                                    <span className="ew-t t-gry">{b.complexity || 'STANDARD'}</span>
                                                </div>
                                            </div>
                                            <div className="ew-wf-body" style={{ padding: '12px 18px' }}>
                                                {b.rejectionReason && (
                                                    <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: 6, marginBottom: 12 }}>
                                                        <MessageSquare size={14} className="text-danger" style={{ flexShrink: 0, marginTop: 2 }} />
                                                        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                            <strong>Rejection Feedback:</strong> {b.rejectionReason}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="ew-wf-meta">
                                                    <span><Clock size={11} /> Effort: {formatDuration(sla.actualHours)}</span>
                                                    {section.id === 'aw' && <span className="text-purple"><Activity size={11} /> Priority Review Queue</span>}
                                                </div>
                                            </div>
                                            {section.id !== 'ok' && (
                                                <div className="ew-wf-footer" onClick={e => e.stopPropagation()}>
                                                    <button className="ew-b" onClick={() => onSelectBlock?.(b)}><MessageSquare size={12} /> Discussion</button>
                                                    {section.id === 'rj' ? (
                                                        <button className="ew-b b-pri" onClick={() => onSelectBlock?.(b)}><Play size={12} /> Resolve & Resubmit</button>
                                                    ) : (
                                                        <button className="ew-b" style={{ opacity: 0.7 }} disabled><Clock size={12} /> Awaiting Signal</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="ew-side">
                    <div className="ew-sp">
                        <div className="ew-sp-title"><Activity size={12} /> Review Intelligence</div>
                        <div className="ew-sp-content">
                            <div className="ew-sp-row">
                                <span>Approval Rate</span>
                                <span className={approvalRate > 80 ? 'text-success' : 'text-warning'} style={{ fontWeight: 800 }}>{approvalRate}%</span>
                            </div>
                            <div className="ew-sp-row">
                                <span>Avg Cycle Time</span>
                                <span style={{ fontWeight: 800 }}>1.4h</span>
                            </div>
                        </div>
                    </div>

                    <div className="ew-sp" style={{ background: 'var(--bg)', borderStyle: 'dashed' }}>
                        <div className="ew-sp-title"><Layers size={12} /> Verification Standard</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                            All layout verifications must pass DRC/LVS before submission. Reviewers focus on parasitic integrity and thermal constraints.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngReviews;
