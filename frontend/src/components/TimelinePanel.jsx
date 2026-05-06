import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import BlockDocsPanel from './BlockDocsPanel';
import './TimelinePanel.css';

const TimelinePanel = ({ block, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!block) return;
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
    }, [block]);

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
                            <span className={`health-dot health-dot-${block.healthStatus}`}></span>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{block.healthStatus}</span>
                        </div>
                    </div>
                    
                    {block.healthStatus !== 'HEALTHY' && block.healthReasons?.length > 0 && (
                        <div className={`health-box health-box--${block.healthStatus}`}>
                            <div className="health-box-title">
                                Health Analysis
                            </div>
                            <div className="health-box-reason">
                                {block.healthReasons.map((r, i) => (
                                    <div key={i} style={{ marginBottom: 4 }}>• {r}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

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
                        <span className="timeline-grid-value">{block.estimatedHours}h</span>

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
