import React, { useMemo, useState } from 'react';
import { 
    BookOpen, Shield, Link2, Zap, AlertTriangle, 
    CheckCircle2, Clock, Info, ChevronRight, MessageSquare,
    Layers, ExternalLink, Activity
} from 'lucide-react';

// --- GUIDANCE REPOSITORY ---
const STAGE_GUIDANCE = {
    IN_PROGRESS: {
        title: 'Layout Routing Guidelines',
        checklist: [
            'Verify metal layer constraints and power grid integrity.',
            'Check for electromigration (EM) risk on high-toggle nets.',
            'Ensure shielding for sensitive analog/clock signals.',
            'Standard cell alignment and substrate tap verification.'
        ],
        commonViolations: ['Metal overlap', 'Missing substrate taps', 'Incorrect via sizing'],
        icon: Activity,
        color: '#2563eb'
    },
    DRC: {
        title: 'DRC Execution & Verification',
        checklist: [
            'Load latest 7nm/5nm sign-off rule deck.',
            'Verify antenna rule compliance on long metal runs.',
            'Run density analysis for metal fill requirements.',
            'Check spacing and width violations in dense routing regions.'
        ],
        commonViolations: ['Antenna violations', 'Metal density (min/max)', 'Spacing errors'],
        icon: Shield,
        color: '#d97706'
    },
    LVS: {
        title: 'LVS Sign-off Methodology',
        checklist: [
            'Synchronize CDL/Verilog netlist with physical layout.',
            'Verify device recognition (W/L matching).',
            'Check for shorted nets and floating pins.',
            'Resolve power-to-ground shorts in global mesh.'
        ],
        commonViolations: ['Device mismatch', 'Global mesh shorts', 'Floating substrate'],
        icon: Layers,
        color: '#f97316'
    },
    REVIEW: {
        title: 'Final Technical Review Sign-off',
        checklist: [
            'Confirm DRC/LVS "Clean" status reports.',
            'Verify management approval comments are addressed.',
            'Ensure all ECO (Engineering Change Orders) are merged.',
            'Reviewer checklist completion.'
        ],
        commonViolations: ['Unaddressed manager feedback', 'Outdated netlist', 'Missing ECO documentation'],
        icon: CheckCircle2,
        color: '#7c3aed'
    }
};

const EngKnowledge = ({ myBlocks = [], blocks = [], requests = [] }) => {
    const [expandedIds, setExpandedIds] = useState({});

    const toggleExpand = (id) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- INTELLIGENCE ENGINE ---
    const intelligence = useMemo(() => {
        const items = [];

        // 0. Pending Requests Status
        const myRequests = (requests || []).filter(r => r.status === 'PENDING');
        myRequests.forEach(req => {
            const block = blocks.find(b => b._id === req.blockId);
            items.push({
                id: `req_status_${req._id}`,
                block: block?.name || 'Global',
                blockId: req.blockId,
                type: 'request_pending',
                title: `Pending Management Review: ${req.type || req.title}`,
                stage: block?.status || 'GENERAL',
                severity: 'medium',
                content: {
                    reason: req.reason || req.description,
                    status: 'Manager is currently reviewing your request.'
                },
                summary: `Action dispatched: "${req.reason || req.description || ''}". Waiting for manager approval.`,
                icon: Clock,
                color: '#f59e0b'
            });
        });

        myBlocks.forEach(b => {
            // 1. Stage Guidance (Active stages)
            if (STAGE_GUIDANCE[b.status]) {
                const guide = STAGE_GUIDANCE[b.status];
                items.push({
                    id: `guide_${b._id}`,
                    block: b.name,
                    blockId: b._id,
                    type: 'guidance',
                    title: `${b.name}: ${guide.title}`,
                    stage: b.status,
                    severity: 'nominal',
                    content: {
                        checklist: guide.checklist,
                        violations: guide.commonViolations
                    },
                    summary: `Executing ${b.status} verification. Follow sign-off checklist.`,
                    icon: guide.icon,
                    color: guide.color
                });
            }

            // 2. Rejection & Manager Feedback
            if (b.rejectionCount > 0) {
                items.push({
                    id: `rej_${b._id}`,
                    block: b.name,
                    blockId: b._id,
                    type: 'feedback',
                    title: `${b.name}: Rejection Learning Record`,
                    stage: b.status,
                    severity: 'high',
                    content: {
                        comments: b.rejectionReason || 'Last review rejected due to technical non-compliance.',
                        count: b.rejectionCount
                    },
                    summary: `Critical: Resolved ${b.rejectionCount} prior rejections. Address manager comments before re-submission.`,
                    icon: AlertTriangle,
                    color: '#ef4444'
                });
            }

            // 3. Dependency Blockage Analysis
            const isBlocked = b.executionState === 'BLOCKED' || (b.dependencies || []).some(d => {
                const dep = typeof d === 'string' ? blocks.find(w => w._id === d) : d;
                return dep?.status !== 'COMPLETED';
            });

            if (isBlocked) {
                const pendingDeps = (b.dependencies || []).filter(d => {
                    const dep = typeof d === 'string' ? blocks.find(w => w._id === d) : d;
                    return dep?.status !== 'COMPLETED';
                }).map(d => (typeof d === 'string' ? blocks.find(w => w._id === d)?.name : d?.name) || 'Unknown');

                items.push({
                    id: `dep_${b._id}`,
                    block: b.name,
                    blockId: b._id,
                    type: 'dependency',
                    title: `${b.name}: Orchestration Blockage`,
                    stage: b.status,
                    severity: 'medium',
                    content: {
                        pending: pendingDeps,
                        warning: 'Execution stalled. Upstream dependencies must clear sign-off gate.'
                    },
                    summary: `Blocked by ${pendingDeps.length} upstream nodes: ${pendingDeps.join(', ')}.`,
                    icon: Link2,
                    color: '#3b82f6'
                });
            }

            // 4. Escalation Context
            if (b.escalated) {
                items.push({
                    id: `esc_${b._id}`,
                    block: b.name,
                    blockId: b._id,
                    type: 'escalation',
                    title: `${b.name}: Priority Escalation`,
                    stage: b.status,
                    severity: 'critical',
                    content: {
                        reason: 'Manually escalated by orchestration engine for immediate execution priority.'
                    },
                    summary: 'Management visibility triggered. Expedite verification sign-off.',
                    icon: Zap,
                    color: '#ef4444'
                });
            }
        });

        // Sort: Critical/High first, then by block name
        return items.sort((a, b) => {
            const sevWeight = { critical: 4, high: 3, medium: 2, nominal: 1 };
            return sevWeight[b.severity] - sevWeight[a.severity];
        });
    }, [myBlocks, blocks]);

    // --- SIDEBAR STATS ---
    const stats = useMemo(() => {
        const stages = new Set(myBlocks.map(b => b.status));
        return {
            guidance: intelligence.filter(i => i.type === 'guidance').length,
            alerts: intelligence.filter(i => ['feedback', 'dependency', 'escalation'].includes(i.type)).length,
            activeStages: stages.size
        };
    }, [intelligence, myBlocks]);

    return (
        <div className="ew-grid fade-in">
            <div className="ew-col">
                <div className="ew-sh">
                    <BookOpen size={14} /> Contextual Execution Support ({intelligence.length})
                </div>

                {intelligence.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {intelligence.map(item => {
                            const Icon = item.icon;
                            const isExpanded = expandedIds[item.id];
                            
                            return (
                                <div 
                                    key={item.id} 
                                    className={`kb-intel-card ${isExpanded ? 'expanded' : ''} sev-${item.severity}`}
                                    onClick={() => toggleExpand(item.id)}
                                >
                                    <div className="kb-intel-header">
                                        <div className="kb-intel-icon" style={{ background: `${item.color}15`, color: item.color }}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="kb-intel-main">
                                            <div className="kb-intel-title-row">
                                                <span className="kb-intel-title">{item.title}</span>
                                                <span className={`kb-intel-tag tag-${item.severity}`}>{item.severity}</span>
                                            </div>
                                            <div className="kb-intel-subtitle">
                                                <Activity size={10} /> {item.block}
                                                <span className="divider">•</span>
                                                <Clock size={10} /> {item.stage.replace('_', ' ')}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className={`kb-intel-chevron ${isExpanded ? 'open' : ''}`} />
                                    </div>

                                    <div className="kb-intel-summary">
                                        {item.summary}
                                    </div>

                                    {isExpanded && (
                                        <div className="kb-intel-details" onClick={e => e.stopPropagation()}>
                                            {item.type === 'guidance' && (
                                                <>
                                                    <div className="kb-detail-section">
                                                        <div className="kb-detail-lbl">Execution Checklist</div>
                                                        <div className="kb-checklist">
                                                            {item.content.checklist.map((c, i) => (
                                                                <div key={i} className="kb-check-item">
                                                                    <CheckCircle2 size={12} className="text-success" />
                                                                    <span>{c}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="kb-detail-section">
                                                        <div className="kb-detail-lbl">Common Sign-off Violations</div>
                                                        <div className="kb-tags-list">
                                                            {item.content.violations.map((v, i) => (
                                                                <span key={i} className="kb-violation-tag">{v}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {item.type === 'feedback' && (
                                                <div className="kb-detail-section">
                                                    <div className="kb-detail-lbl">Manager Review Feedback</div>
                                                    <div className="kb-feedback-bubble">
                                                        <MessageSquare size={14} />
                                                        <p>{item.content.comments}</p>
                                                    </div>
                                                    <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                                        This is the {item.content.count}x rejection for this node.
                                                    </div>
                                                </div>
                                            )}

                                            {item.type === 'dependency' && (
                                                <div className="kb-detail-section">
                                                    <div className="kb-detail-lbl">Dependency Resolution Path</div>
                                                    <div className="kb-warning-banner">
                                                        <AlertTriangle size={14} />
                                                        <span>{item.content.warning}</span>
                                                    </div>
                                                    <div className="kb-dep-list">
                                                        {item.content.pending.map((p, i) => (
                                                            <div key={i} className="kb-dep-node">
                                                                <Layers size={10} /> {p} — Sign-off Pending
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {item.type === 'escalation' && (
                                                <div className="kb-detail-section">
                                                    <div className="kb-detail-lbl">Escalation Rationale</div>
                                                    <p className="kb-intel-text">{item.content.reason}</p>
                                                </div>
                                            )}

                                            {item.type === 'request_pending' && (
                                                <div className="kb-detail-section">
                                                    <div className="kb-detail-lbl">Request Details</div>
                                                    <div className="kb-warning-banner" style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e' }}>
                                                        <Clock size={14} />
                                                        <span>{item.content.status}</span>
                                                    </div>
                                                    <div className="kb-feedback-bubble" style={{ marginTop: 12 }}>
                                                        <p><strong>Justification provided:</strong> {item.content.reason}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="kb-intel-actions">
                                                <button className="kb-intel-btn">
                                                    <ExternalLink size={12} /> Sign-off Documentation
                                                </button>
                                                <button className="kb-intel-btn">
                                                    <Info size={12} /> Technical Reference
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="ew-empty" style={{ padding: 64 }}>
                        <BookOpen size={32} style={{ opacity: 0.1, marginBottom: 12 }} />
                        <div>No active knowledge context detected.</div>
                        <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>Begin execution on a workflow to see context-aware guidance.</p>
                    </div>
                )}
            </div>

            <div className="ew-side">
                <div className="ew-sp">
                    <div className="ew-sp-title"><BookOpen size={10} /> Operational Reference</div>
                    <div className="ew-sp-row">
                        <div className="ew-sp-dot" style={{ background: 'var(--accent)' }} />
                        <div><strong>{stats.guidance}</strong> Stage Sign-off Docs</div>
                    </div>
                    <div className="ew-sp-row">
                        <div className="ew-sp-dot" style={{ background: 'var(--red)' }} />
                        <div><strong>{stats.alerts}</strong> Intelligence Alerts</div>
                    </div>
                    <div className="ew-sp-row">
                        <div className="ew-sp-dot" style={{ background: '#7c3aed' }} />
                        <div><strong>{stats.activeStages}</strong> Active Sign-off Stages</div>
                    </div>
                </div>

                <div className="ew-sp">
                    <div className="ew-sp-title"><Zap size={10} /> Active Workflows</div>
                    <div className="ew-sp-content">
                        {myBlocks.slice(0, 5).map(b => (
                            <div key={b._id} className="ew-sp-row">
                                <span>{b.name}</span>
                                <span className="ew-t t-blu">{b.status.replace('_', ' ')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ew-sp intelligence-footer" style={{ borderStyle: 'dashed', opacity: 0.8 }}>
                    <div className="ew-sp-title">System Status</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Intelligence engine synchronized with real-time orchestration state.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngKnowledge;
