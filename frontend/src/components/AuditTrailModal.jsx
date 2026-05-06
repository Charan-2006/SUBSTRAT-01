import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import './AuditTrailModal.css';

const AuditTrailModal = ({ onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get('/blocks/logs/all');
                setLogs(res.data.data);
            } catch (err) {
                console.error("Frontend error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content audit-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">System Audit Trail</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                
                <div className="modal-body">
                    {loading ? (
                        <div className="modal-loading">Loading activity logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="modal-empty">No activity logs found.</div>
                    ) : (
                        <div className="audit-table-wrapper">
                            <table className="audit-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Action</th>
                                        <th>Block</th>
                                        <th>Performed By</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log._id}>
                                            <td className="audit-time">
                                                {new Date(log.timestamp).toLocaleString(undefined, { 
                                                    month: 'short', day: 'numeric', 
                                                    hour: '2-digit', minute: '2-digit' 
                                                })}
                                            </td>
                                            <td>
                                                <span className={`audit-action-badge action-${log.action}`}>
                                                    {log.action.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="audit-block-name">{log.blockId?.name || '—'}</td>
                                            <td className="audit-user">{log.userId?.displayName || 'System'}</td>
                                            <td className="audit-message">
                                                {log.message}
                                                {log.action === 'STATUS_UPDATE' && (
                                                    <div className="audit-change-preview">
                                                        {log.previousValue} → {log.newValue}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default AuditTrailModal;
