import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, AlertTriangle, Link2, ArrowRight, Zap, Shield, TrendingUp, History, Activity, ChevronRight } from 'lucide-react';
import api from '../../api/axios';
import { 
    calculateSLA, calculateDependencyImpact, calculateHealth, calculateProgress,
    generateRecommendedAction, formatDuration, calculateBlockedState,
    calculateVelocity, calculateEfficiency
} from '../../utils/workflowEngine';
import { STAGES, STAGE_COLORS, HEALTH_STATES, BLOCK_TYPES, TECH_NODES, COMPLEXITY_LEVELS } from '../../constants/workflowStates';
import { useOrchestration } from '../../context/OrchestrationContext';

const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

const BlockDetailsDrawer = ({ block, allBlocks = [], onClose, onReview, isManager, startWithRejection = false }) => {
    const { onUpdateBlock, engineers, fetchBlocks } = useOrchestration();
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});

    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [rejectionActive, setRejectionActive] = useState(startWithRejection);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        if (!block?._id) return;
        setLogsLoading(true);
        api.get(`/blocks/${block._id}/logs?limit=20`)
            .then(res => setLogs(res.data.data || []))
            .catch(() => setLogs([]))
            .finally(() => setLogsLoading(false));
        
        setEditData({
            name: block.name,
            type: block.type,
            techNode: block.techNode,
            complexity: block.complexity,
            baseHours: block.baseHours || 0,
            estimatedArea: block.estimatedArea || 0,

            priority: block.priority || 5,
            description: block.description || '',
            dependencies: (block.dependencies || []).map(d => d._id || d),
            assignedEngineer: block.assignedEngineer?._id || block.assignedEngineer || ''
        });
    }, [block?._id, block]);


    const { upstream, downstream } = useMemo(() => 
        calculateDependencyImpact(block, allBlocks),
        [block, allBlocks]
    );

    if (!block) return null;

    const sla = calculateSLA(block);
    const health = calculateHealth(block, allBlocks);
    const progress = calculateProgress(block);
    const isBlocked = calculateBlockedState(block, allBlocks);
    const velocity = calculateVelocity(block);
    const efficiency = calculateEfficiency(block);
    const rec = generateRecommendedAction(block, allBlocks);

    const getHealthColor = (h) => {
        switch(h) {
            case 'BOTTLENECK': return 'var(--amber)';
            case 'CRITICAL': return 'var(--red)';
            default: return 'var(--green)';
        }
    };

    const getHealthBg = (h) => {
        switch(h) {
            case 'BOTTLENECK': return 'var(--amber-bg)';
            case 'CRITICAL': return 'var(--red-bg)';
            default: return 'var(--green-bg)';
        }
    };

    return (
        <>
            <div className="ws-drawer-overlay" onClick={onClose} />
            <div className="ws-drawer">
                {/* 1. Workflow Identity */}
                <div className="ws-drawer-header">
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                            {block.type || 'Standard Block'} • {block.techNode || 'N/A'}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{block.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <span className={`status-badge status-${block.status}`} style={{ fontSize: 9, padding: '2px 8px', fontWeight: 700 }}>
                                {block.status.replace('_', ' ')}
                            </span>
                            {block.isEscalated && (
                                <span className="priority-badge escalated">
                                    ESCALATED
                                </span>
                            )}
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                fontSize: 10, fontWeight: 800,
                                color: getHealthColor(health),
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                {health}
                            </span>
                        </div>
                    </div>
                        {!isEditing && (
                            <button className="btn btn-sm" onClick={() => setIsEditing(true)}>Edit Block</button>
                        )}
                        {block.status === 'REVIEW' && !isEditing && isManager && (
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-sm btn-primary" style={{ padding: '6px 12px' }} onClick={() => onReview?.(block._id, 'APPROVE')}>
                                    Approve Stage
                                </button>
                                <button className="btn btn-sm" style={{ padding: '6px 12px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setRejectionActive(true)}>
                                    Reject
                                </button>
                            </div>
                        )}
                        <button onClick={onClose} className="popover-close" style={{ padding: 6 }}>
                            <X size={16} />
                        </button>
                    </div>

                {isEditing && (
                    <div className="rejection-inline-panel fade-in" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <History size={14} />
                            EDIT BLOCK SPECIFICATIONS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Name</label>
                                <input className="form-control" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Type</label>
                                <select className="form-control" value={editData.type} onChange={e => setEditData({...editData, type: e.target.value})}>
                                    {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tech Node</label>
                                <select className="form-control" value={editData.techNode} onChange={e => setEditData({...editData, techNode: e.target.value})}>
                                    {TECH_NODES.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Base Effort (Hrs)</label>
                                <input type="number" className="form-control" value={editData.baseHours} onChange={e => setEditData({...editData, baseHours: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Complexity</label>
                                <select className="form-control" value={editData.complexity} onChange={e => setEditData({...editData, complexity: e.target.value})}>
                                    {COMPLEXITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Manual Est. Override</label>
                                <input type="number" className="form-control" value={editData.estimatedHours} onChange={e => setEditData({...editData, estimatedHours: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Priority (1-10)</label>
                                <input type="number" min="1" max="10" className="form-control" value={editData.priority} onChange={e => setEditData({...editData, priority: e.target.value})} />
                            </div>

                            <div>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Area (µm²)</label>
                                <input type="number" className="form-control" value={editData.estimatedArea} onChange={e => setEditData({...editData, estimatedArea: e.target.value})} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Assignee</label>
                                <select className="form-control" value={editData.assignedEngineer} onChange={e => setEditData({...editData, assignedEngineer: e.target.value})}>
                                    <option value="">Unassigned</option>
                                    {engineers.map(eng => <option key={eng._id} value={eng._id}>{eng.displayName}</option>)}
                                </select>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Dependencies</label>
                                <select 
                                    multiple 
                                    className="form-control" 
                                    style={{ height: 80 }}
                                    value={editData.dependencies} 
                                    onChange={e => setEditData({...editData, dependencies: Array.from(e.target.selectedOptions, opt => opt.value)})}
                                >
                                    {allBlocks.filter(b => b._id !== block._id).map(b => (
                                        <option key={b._id} value={b._id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Description</label>
                                <textarea className="form-control" style={{ minHeight: 60 }} value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            <button className="btn btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                            <button className="btn btn-sm btn-primary" onClick={async () => {
                                await onUpdateBlock(block._id, editData);
                                setIsEditing(false);
                            }}>Save Specifications</button>
                        </div>
                    </div>
                )}


                {rejectionActive && (
                    <div className="rejection-inline-panel fade-in">
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={14} />
                            TECHNICAL REJECTION FEEDBACK
                        </div>
                        <textarea 
                            className="form-control"
                            placeholder="Specify technical reasons for rejection (e.g., LVS mismatch in power grid, DRC violations in metal 2)..."
                            style={{ minHeight: 100, fontSize: 12, resize: 'none', background: 'var(--red-bg)', borderColor: 'var(--red)' }}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                            <button className="btn btn-sm" onClick={() => setRejectionActive(false)}>Cancel</button>
                            <button 
                                className="btn btn-sm btn-danger"
                                disabled={!rejectionReason.trim()}
                                onClick={() => { onReview?.(block._id, 'REJECT', rejectionReason); setRejectionActive(false); }}
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                )}

                <div className="ws-drawer-body">
                    {/* 2. Telemetry Summary */}
                    <div className="ws-drawer-section">
                        <div className="ws-drawer-section-title">Orchestration Telemetry</div>
                        <div style={{
                            padding: '10px 12px', borderRadius: 8,
                            background: getHealthBg(health),
                            border: '1px solid',
                            borderColor: getHealthColor(health),
                            display: 'flex', alignItems: 'center', gap: 10
                        }}>
                            <div style={{ 
                                width: 32, height: 32, borderRadius: '50%', 
                                background: getHealthColor(health),
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                            }}>
                                {health === 'HEALTHY' ? <Shield size={16} /> : <AlertTriangle size={16} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{health}</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>• {progress}% Complete</span>
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500, lineHeight: 1.3 }}>
                                    {block.isEscalated ? 'Workflow under management escalation. Priority path enforced.' : 
                                     health === 'BOTTLENECK' ? 'Critical path bottleneck detected - actively blocking downstream workflows.' :
                                     health === 'CRITICAL' ? 'SLA violation or upstream blockage detected. Monitoring for bottleneck state.' :
                                     'Execution proceeding within established SLA parameters.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Performance Metrics Grid */}
                    <div className="ws-drawer-section">
                        <div className="ws-drawer-section-title">Performance Metrics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            <div className="ws-metric-card">
                                <div className="ws-metric-label">Actual Time</div>
                                <div className="ws-metric-value" style={{ color: sla.delayHours > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                                    {formatDuration(sla.actualHours)}
                                </div>
                                <div className="ws-metric-sub">Current Stage</div>
                            </div>
                            <div className="ws-metric-card">
                                <div className="ws-metric-label">Expected SLA</div>
                                <div className="ws-metric-value">{formatDuration(sla.expectedHours)}</div>
                                <div className="ws-metric-sub">Target Window</div>
                            </div>
                            <div className="ws-metric-card">
                                <div className="ws-metric-label">SLA Overrun</div>
                                <div className="ws-metric-value" style={{ color: sla.delayHours > 0 ? 'var(--red)' : 'var(--green)' }}>
                                    {sla.delayHours > 0 ? `+${formatDuration(sla.delayHours)}` : '0h'}
                                </div>
                                <div className="ws-metric-sub">Variance</div>
                            </div>
                            <div className="ws-metric-card">
                                <div className="ws-metric-label">Efficiency</div>
                                <div className="ws-metric-value" style={{ color: efficiency < 70 ? 'var(--amber)' : 'var(--text-primary)' }}>
                                    {efficiency}%
                                </div>
                                <div className="ws-metric-sub">SLA Accuracy</div>
                            </div>
                            <div className="ws-metric-card">
                                <div className="ws-metric-label">Velocity</div>
                                <div className="ws-metric-value">{velocity}</div>
                                <div className="ws-metric-sub">Pts/Hour</div>
                            </div>
                            <div className="ws-metric-card">
                                <div className="ws-metric-label">Rejections</div>
                                <div className="ws-metric-value" style={{ color: block.rejectionCount > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                                    {block.rejectionCount}
                                </div>
                                <div className="ws-metric-sub">Rollbacks</div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Execution Timeline */}
                    <div className="ws-drawer-section">
                        <div className="ws-drawer-section-title">Execution Progression Timeline</div>
                        <div className="ws-stage-timeline">
                            {WORKFLOW_ORDER.map((stage, i) => {
                                const history = block.stageHistory?.find(h => h.stage === stage);
                                const isCurrent = block.status === stage;
                                const isCompleted = WORKFLOW_ORDER.indexOf(block.status) > i || block.status === 'COMPLETED';
                                const isFuture = !isCurrent && !isCompleted;

                                // Mock expected for history stages if not present
                                const expected = history?.expectedHours || sla.expectedHours;
                                const isOverrun = history?.durationHours > expected || (isCurrent && sla.delayHours > 0);
                                const overrunAmt = isCurrent ? sla.delayHours : (history?.durationHours - expected);

                                return (
                                    <div key={stage} className="ws-stage-item" style={{ opacity: isFuture ? 0.5 : 1 }}>
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div className={`ws-stage-dot ${isCurrent ? 'active' : ''}`} style={{
                                                background: isCurrent ? 'var(--accent)' : isCompleted ? 'var(--green)' : 'var(--border)',
                                            }} />
                                            {i < WORKFLOW_ORDER.length - 1 && <div className="ws-stage-line" style={{ background: isCompleted ? 'var(--green)' : 'var(--border-light)' }} />}
                                        </div>
                                        <div className="ws-stage-content">
                                            <div className="ws-stage-header">
                                                <span className="ws-stage-name" style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                                                    {stage.replace('_', ' ')}
                                                </span>
                                                <span className="ws-stage-time">
                                                    {isCompleted ? 'Completed' : isCurrent ? 'Active' : 'Pending'}
                                                </span>
                                            </div>
                                            {(isCompleted || isCurrent) && (
                                                <div className="ws-stage-meta">
                                                    <span>{formatDuration(isCurrent ? sla.actualHours : (history?.durationHours || 0))}</span>
                                                    <span style={{ opacity: 0.5 }}>/</span>
                                                    <span>Target: {formatDuration(expected)}</span>
                                                    {isOverrun && (
                                                        <span className="ws-overrun-badge">+{formatDuration(overrunAmt)} Overrun</span>
                                                    )}
                                                    {history?.rejectionTriggered && (
                                                        <span className="ws-rejection-badge">Rollback</span>
                                                    )}
                                                </div>
                                            )}
                                            {isCompleted && history?.completedAt && (
                                                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                                    Finalized {new Date(history.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 5. Orchestration Graph */}
                    <div className="ws-drawer-section">
                        <div className="ws-drawer-section-title">Dependency Orchestration</div>
                        <div className="ws-graph-container">
                            {/* Upstream */}
                            {upstream.length > 0 ? upstream.map((dep, idx) => (
                                <React.Fragment key={dep._id || dep}>
                                    <div className="ws-graph-node">
                                        <Link2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700 }}>{dep.name || 'Upstream Block'}</div>
                                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>{dep.status} • {dep.type || 'Dependency'}</div>
                                        </div>
                                        <div style={{ fontSize: 9, fontWeight: 800, color: dep.status === 'COMPLETED' ? 'var(--green)' : 'var(--amber)' }}>
                                            {dep.status === 'COMPLETED' ? 'READY' : 'WAITING'}
                                        </div>
                                    </div>
                                    <div className="ws-graph-connector">
                                        <div className="ws-graph-line" />
                                        <div className="ws-graph-arrow" />
                                    </div>
                                </React.Fragment>
                            )) : (
                                <>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8, marginBottom: 8 }}>
                                        No Upstream Blockers
                                    </div>
                                    <div className="ws-graph-connector">
                                        <div className="ws-graph-line" />
                                        <div className="ws-graph-arrow" />
                                    </div>
                                </>
                            )}

                            {/* Current */}
                            <div className="ws-graph-node current">
                                <Zap size={14} style={{ color: 'var(--accent)' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)' }}>{block.name} (Executing)</div>
                                    <div style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 600, opacity: 0.8 }}>{block.status} Stage</div>
                                </div>
                                <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)' }}>CURRENT</div>
                            </div>

                            {/* Downstream */}
                            <div className="ws-graph-connector">
                                <div className="ws-graph-line" />
                                <div className="ws-graph-arrow" />
                            </div>
                            
                            {downstream.length > 0 ? downstream.map(ds => (
                                <div key={ds._id} className="ws-graph-node" style={{ marginBottom: 6 }}>
                                    <TrendingUp size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700 }}>{ds.name}</div>
                                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>{ds.status} • Impacted</div>
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: isBlocked ? 'var(--red)' : 'var(--text-tertiary)' }}>
                                        {isBlocked ? 'BLOCKED' : 'QUEUED'}
                                    </div>
                                </div>
                            )) : (
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
                                    No Downstream Impact
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 6. Recommendations */}
                    <div className="ws-drawer-section">
                        <div className="ws-drawer-section-title">Operational Intelligence</div>
                        <div style={{ 
                            padding: '12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'flex-start', gap: 12
                        }}>
                            <div style={{ 
                                width: 28, height: 28, borderRadius: 6, 
                                background: rec?.priority === 'HIGH' ? 'var(--red-bg)' : rec?.priority === 'MEDIUM' ? 'var(--amber-bg)' : 'var(--accent-subtle)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Shield size={16} style={{ color: rec?.priority === 'HIGH' ? 'var(--red)' : rec?.priority === 'MEDIUM' ? 'var(--amber)' : 'var(--accent)' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)' }}>System Recommendation</span>
                                    {rec?.priority && (
                                        <span className={`priority-tag priority-${rec.priority.toLowerCase()}`}>{rec.priority}</span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, fontWeight: 500 }}>
                                    "{rec?.text || 'Analyzing workflow data...'}"
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 6.5 Review History */}
                    {(block.rejectionHistory?.length > 0 || block.approvalHistory?.length > 0) && (
                        <div className="ws-drawer-section">
                            <div className="ws-drawer-section-title">Review & Approval History</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[...(block.rejectionHistory || []), ...(block.approvalHistory || [])]
                                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                    .map((entry, i) => {
                                        const isRejection = !!entry.reason;
                                        return (
                                            <div key={i} style={{ 
                                                padding: '10px', 
                                                background: isRejection ? 'rgba(239, 68, 68, 0.03)' : 'rgba(34, 197, 94, 0.03)', 
                                                border: `1px solid ${isRejection ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'}`,
                                                borderRadius: 6
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 800, color: isRejection ? 'var(--red)' : 'var(--green)', textTransform: 'uppercase' }}>
                                                        {isRejection ? 'REJECTED' : 'APPROVED'}
                                                    </span>
                                                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                                                        {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
                                                    "{entry.reason || entry.comments || 'No comment provided'}"
                                                </div>
                                                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                                    Reviewer: {entry.reviewer?.displayName || 'Technical Lead'} • Stage: {entry.stage}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* 7. Activity History */}
                    <div className="ws-drawer-section" style={{ borderBottom: 'none' }}>
                        <div className="ws-drawer-section-title">Event-Driven Activity Feed</div>
                        <div className="activity-feed" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {logsLoading ? (
                                <div className="ws-skeleton ws-skeleton-row" style={{ height: 120 }} />
                            ) : logs.length === 0 ? (
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px', background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                                    No historical orchestration events found.
                                </div>
                            ) : logs.map((log, idx) => (
                                <div key={log._id} style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ 
                                            width: 22, height: 22, borderRadius: '50%', 
                                            background: 'var(--bg)', border: '1px solid var(--border)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                        }}>
                                            <Activity size={10} style={{ color: 'var(--text-tertiary)' }} />
                                        </div>
                                        {idx < logs.length - 1 && <div style={{ flex: 1, width: 1, background: 'var(--border-light)', margin: '4px 0' }} />}
                                    </div>
                                    <div style={{ flex: 1, paddingBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                                {log.action?.toLowerCase().replace(/_/g, ' ')}
                                            </span>
                                            <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 700 }}>
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, fontWeight: 500 }}>
                                            {log.message || `Orchestration event ${log.action} recorded.`}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--border)', fontSize: 7, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                                {log.userId?.displayName?.charAt(0) || 'S'}
                                            </div>
                                            <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                                {log.userId?.displayName || 'System Orchestrator'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BlockDetailsDrawer;
