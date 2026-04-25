import React, { useState, useEffect } from 'react';
import api from '../api/axios';
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

    return (
        <aside className="detail-panel">
            {/* Header */}
            <div className="detail-panel-header">
                <div className="detail-panel-title">Block Detail</div>
                <button className="detail-panel-close" onClick={onClose}>✕</button>
            </div>

            {/* Block info */}
            <div className="detail-panel-section">
                <h3 className="detail-panel-block-name">{block.name}</h3>
                <div className="detail-panel-meta">
                    <div className="detail-panel-meta-row">
                        <span className="detail-panel-label">Status</span>
                        <span className={`status-badge status-${block.status}`}>{block.status}</span>
                    </div>
                    <div className="detail-panel-meta-row">
                        <span className="detail-panel-label">Health</span>
                        <span className={`health-badge health-${block.healthStatus}`}>● {block.healthStatus}</span>
                    </div>
                    {block.techNode && (
                        <div className="detail-panel-meta-row">
                            <span className="detail-panel-label">Tech Node</span>
                            <span className="detail-panel-value">{block.techNode}</span>
                        </div>
                    )}
                    <div className="detail-panel-meta-row">
                        <span className="detail-panel-label">Complexity</span>
                        <span className="detail-panel-value">{block.complexity}</span>
                    </div>
                    <div className="detail-panel-meta-row">
                        <span className="detail-panel-label">Est. Hours</span>
                        <span className="detail-panel-value">{block.estimatedHours}h</span>
                    </div>
                    <div className="detail-panel-meta-row">
                        <span className="detail-panel-label">Assigned</span>
                        <span className="detail-panel-value">{block.assignedEngineer?.displayName || '—'}</span>
                    </div>
                    {block.healthReasons?.length > 0 && (
                        <div className="detail-panel-reasons">
                            {block.healthReasons.map((r, i) => (
                                <div key={i} className="detail-panel-reason">⚬ {r}</div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Divider */}
            <div className="detail-panel-divider"></div>

            {/* Timeline */}
            <div className="detail-panel-section detail-panel-timeline-section">
                <div className="detail-panel-section-title">Audit History</div>

                {loading && (
                    <div className="detail-panel-empty">Loading...</div>
                )}

                {!loading && logs.length === 0 && (
                    <div className="detail-panel-empty">No history recorded yet.</div>
                )}

                {!loading && logs.length > 0 && (
                    <div className="detail-panel-timeline">
                        {logs.map((log) => (
                            <div key={log._id} className="dp-timeline-item">
                                <div className="dp-timeline-dot"></div>
                                <div className="dp-timeline-content">
                                    <div className="dp-timeline-date">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </div>
                                    <div className="dp-timeline-action">
                                        <strong>{log.action}</strong>
                                        <span> by {log.userId?.displayName || 'System'}</span>
                                    </div>
                                    {log.message && (
                                        <div className="dp-timeline-message">{log.message}</div>
                                    )}
                                    {log.action === 'STATUS_UPDATE' && (
                                        <div className="dp-timeline-change">
                                            <span className="dp-old">{log.previousValue}</span>
                                            <span className="dp-arrow">→</span>
                                            <span className="dp-new">{log.newValue}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};

export default TimelinePanel;
