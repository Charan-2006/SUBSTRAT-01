import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import BlockDocsPanel from './BlockDocsPanel';
import { useOrchestration } from '../context/OrchestrationContext';
import { calculateSLA, formatDuration } from '../utils/workflowEngine';
import { AlertTriangle, Clock, Activity, ShieldAlert, CheckCircle2, User, ChevronRight, Layers } from 'lucide-react';
import './TimelinePanel.css';

const TimelinePanel = ({ block: initialBlock, onClose, onUpdateStatus, onReview, onResumeWorkflow, onEscalate, isManager, user }) => {
    const { blocks: contextBlocks } = useOrchestration();
    const block = contextBlocks.find(b => b._id === initialBlock?._id) || initialBlock;
    
    // Resolve dependencies with full block data
    const resolvedDependencies = React.useMemo(() => {
        return (block.dependencies || []).map(d => {
            const depId = typeof d === 'string' ? d : d._id;
            const found = contextBlocks.find(b => b._id === depId);
            return found || (typeof d === 'object' ? d : { _id: depId, name: 'Unknown Node', status: 'UNKNOWN' });
        });
    }, [block.dependencies, contextBlocks]);
    
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const canManage = isManager || (block?.assignedEngineer?._id === user?._id || block?.assignedEngineer === user?._id);

    useEffect(() => {
        if (!block?._id) return;
        setLoading(true);
        const fetchLogs = async () => {
            try {
                const res = await api.get(`/blocks/${block._id}/logs`);
                setLogs(res.data.data);
            } catch (err) {
                console.error("Frontend error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [block?._id]);

    if (!block) return null;

    const formatDate = (ts) => {
        return new Date(ts).toLocaleString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <aside className="timeline-panel fade-in">
            {/* Header */}
            <div className="timeline-header">
                <div className="timeline-header-content">
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Block Details</span>
                    <h2>{block.name}</h2>
                </div>
                <button className="timeline-close" onClick={onClose} title="Close Panel">
                    ✕
                </button>
            </div>

            {/* Body */}
            <div className="timeline-body">
                {/* Status & Health Section */}
                <div className="timeline-section">
                    <div className="timeline-section-title">Status & Health</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <span className={`status-badge status-${block.status}`}>{block.status.replace('_', ' ')}</span>
                        <div className="health-status" style={{ background: 'var(--bg)', padding: '2px 10px', borderRadius: 20 }}>
                            <span className={`health-dot health-dot-${block.health}`}></span>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{block.healthLabel || block.health}</span>
                        </div>
                    </div>
                    
                    {(block.health !== 'HEALTHY' || block.isBottleneck) && (
                        <div className={`health-box health-box--${block.health}`}>
                            <div className="health-box-title">
                                Orchestration Analysis
                            </div>
                            <div className="health-box-reason">
                                {block.isBottleneck && <div style={{ marginBottom: 4 }}>• Detected as system bottleneck</div>}
                                {block.delayHours > 0 && <div style={{ marginBottom: 4 }}>• SLA Overrun: +{block.delayHours?.toFixed(1) || '0.0'}h</div>}
                                {block.propagationRisk > 0.3 && <div style={{ marginBottom: 4 }}>• High Propagation Risk: {((block.propagationRisk || 0) * 100).toFixed(0)}%</div>}
                                {block.isBlocked && <div style={{ marginBottom: 4 }}>• Execution blocked by upstream</div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Execution Control */}
                {canManage && block.status !== 'COMPLETED' && (
                    <div className="timeline-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                        <div className="timeline-section-title">Execution Control</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {block.status !== 'REVIEW' && (
                                <button 
                                    className="ew-b b-pri"
                                    onClick={() => onResumeWorkflow?.(block._id)}
                                    disabled={block.executionState === 'BLOCKED'}
                                    style={{ flex: 1, minWidth: 120 }}
                                >
                                    {block.executionState === 'READY' ? 'Start execution' : 'Resume execution'}
                                </button>
                            )}

                            {isManager && !block.escalated && (
                                <button 
                                    className="ew-b b-red"
                                    onClick={() => onEscalate?.(block._id)}
                                    style={{ flex: 1, minWidth: 100 }}
                                >
                                    Escalate
                                </button>
                            )}

                            {isManager && block.status === 'REVIEW' && (
                                <>
                                    <button 
                                        className="ew-b b-grn"
                                        onClick={() => onReview?.(block._id, 'APPROVE')}
                                        style={{ flex: 1, minWidth: 100 }}
                                    >
                                        Approve
                                    </button>
                                    <button 
                                        className="ew-b b-red"
                                        onClick={() => onReview?.(block._id, 'REJECT')}
                                        style={{ flex: 1, minWidth: 100 }}
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                        {block.executionState === 'BLOCKED' && (
                            <div style={{ marginTop: 10, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                ⚠️ Execution locked until upstream dependencies are cleared.
                            </div>
                        )}
                    </div>
                )}

                {/* Dependencies Section */}
                {resolvedDependencies.length > 0 && (
                    <div className="timeline-section" style={{ marginTop: 24 }}>
                        <div className="timeline-section-title">Dependency Impact</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {resolvedDependencies.map(dep => {
                                const isBlocking = dep.status !== 'COMPLETED';
                                const sev = dep.healthStatus === 'CRITICAL' ? 'critical' : (isBlocking ? 'blocking' : 'healthy');
                                
                                return (
                                    <div 
                                        key={dep._id} 
                                        className={`dep-card dep-${sev}`}
                                        style={{ cursor: dep.status !== 'UNKNOWN' ? 'pointer' : 'default' }}
                                    >
                                        <div className="dep-card-header">
                                            <span className="dep-name">{dep.name}</span>
                                            <div className="dep-badges">
                                                <span className={`ew-t ${dep.status === 'COMPLETED' ? 't-grn' : 't-blu'}`} style={{ fontSize: 9 }}>
                                                    {dep.status?.replace('_', ' ') || 'UNKNOWN'}
                                                </span>
                                                <span className={`ew-t ${dep.healthStatus === 'CRITICAL' ? 't-red' : dep.healthStatus === 'RISK' ? 't-amb' : 't-grn'}`} style={{ fontSize: 9 }}>
                                                    {dep.healthStatus || 'HEALTHY'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="dep-card-body">
                                            <div className="dep-meta">
                                                <span><User size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {dep.assignedEngineer?.displayName || 'Unassigned'}</span>
                                                {isBlocking && <span style={{ color: 'var(--red)', fontWeight: 800, fontSize: 10 }}>BLOCKING</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={12} /> These modules must complete before this block can progress.
                        </div>
                    </div>
                )}

                {/* Metadata Grid */}
                <div className="timeline-section">
                    <div className="timeline-section-title">Metadata</div>
                    <div className="timeline-grid">
                        <span className="timeline-grid-label">Type</span>
                        <span className="timeline-grid-value">{block.type || 'N/A'}</span>
                        
                        <span className="timeline-grid-label">Node</span>
                        <span className="timeline-grid-value">{block.techNode || 'N/A'}</span>
                        
                        <span className="timeline-grid-label">Complexity</span>
                        <span className="timeline-grid-value" style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontSize: 11 }}>{block.complexity}</span>
                        
                        <span className="timeline-grid-label">Estimated</span>
                        <span className="timeline-grid-value">{(block.slaTargetHours || 0)}h</span>

                        <span className="timeline-grid-label">Actual</span>
                        <span className="timeline-grid-value">{(block.elapsedHours || 0).toFixed(1)}h</span>

                        <span className="timeline-grid-label">Confidence</span>
                        <span className="timeline-grid-value">{block.confidenceScore}%</span>

                        <span className="timeline-grid-label">Risk</span>
                        <span className="timeline-grid-value">{((block.propagationRisk || 0) * 100).toFixed(0)}%</span>

                        <span className="timeline-grid-label">Owner</span>
                        <span className="timeline-grid-value" style={{ color: block.assignedEngineer ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                            {block.assignedEngineer?.displayName || 'Unassigned'}
                        </span>
                    </div>
                </div>

                {/* Context & Notes Panel (Manager Only) */}
                {isManager && <BlockDocsPanel blockId={block._id} blockName={block.name} />}

                {/* Activity History */}
                <div className="timeline-section" style={{ marginTop: '24px' }}>
                    <div className="timeline-section-title">Activity History</div>
                    
                    {loading && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading activity...</div>}
                    
                    {!loading && logs.length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No activity recorded yet.</div>
                    )}

                    {!loading && logs.length > 0 && (
                        <div className="activity-list">
                            {logs.map((log, index) => (
                                <div key={log._id} className="activity-item">
                                    <div className="activity-dot"></div>
                                    <div className="activity-content">
                                        <div className="activity-header">
                                            <span className="activity-action">{log.action.replace('_', ' ')}</span>
                                            <span className="activity-time">{formatDate(log.timestamp)}</span>
                                        </div>
                                        <div className="activity-desc">
                                            {log.userId?.displayName && <strong>{log.userId.displayName} </strong>}
                                            {log.message}
                                        </div>
                                        {log.action === 'STATUS_UPDATE' && (
                                            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', gap: 8 }}>
                                                <span style={{ color: 'var(--red-text)', textDecoration: 'line-through', opacity: 0.6 }}>{log.previousValue}</span>
                                                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                                                <span style={{ color: 'var(--green-text)' }}>{log.newValue}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default TimelinePanel;
