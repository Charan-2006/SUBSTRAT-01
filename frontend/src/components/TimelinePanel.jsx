import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import BlockDocsPanel from './BlockDocsPanel';
import { useOrchestration } from '../context/OrchestrationContext';
import './TimelinePanel.css';

const TimelinePanel = ({ block: initialBlock, onClose, onUpdateStatus, onReview, onResumeWorkflow, onEscalate, isManager, user }) => {
    const { blocks: contextBlocks } = useOrchestration();
    const block = contextBlocks.find(b => b._id === initialBlock?._id) || initialBlock;
    
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
                {block.dependencies && block.dependencies.length > 0 && (
                    <div className="timeline-section" style={{ marginTop: 24 }}>
                        <div className="timeline-section-title">Dependency Impact</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {block.dependencies.map(dep => (
                                <div key={dep._id || dep} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                                        {dep.name || dep}
                                    </span>
                                    {dep.status && (
                                        <span className={`status-badge status-${dep.status}`} style={{ fontSize: 9 }}>
                                            {dep.status.replace('_', ' ')}
                                        </span>
                                    )}
                                    {dep.healthStatus && (
                                        <span className={`health-dot health-dot-${dep.healthStatus}`} title={dep.healthStatus} />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                            These blocks must complete specific verification stages before progression.
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

                {/* Context & Notes Panel */}
                <BlockDocsPanel blockId={block._id} blockName={block.name} />

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
