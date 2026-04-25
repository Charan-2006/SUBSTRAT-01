import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import './Timeline.css';

const Timeline = ({ blockId }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get(`/blocks/${blockId}/logs`);
                setLogs(res.data.data);
            } catch (err) {
                console.error("Frontend error:", err);
                alert(err.response?.data?.message || "Something went wrong fetching logs");
            } finally {
                setLoading(false);
            }
        };

        if (blockId) {
            fetchLogs();
        }
    }, [blockId]);

    if (loading) return <div>Loading timeline...</div>;

    if (logs.length === 0) return <div>No history found for this block.</div>;

    return (
        <div className="timeline-container">
            <h4>Audit History</h4>
            <div className="timeline">
                {logs.map((log, index) => (
                    <div key={log._id} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                            <span className="timeline-date">
                                {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <div className="timeline-header">
                                <strong>{log.action}</strong> by {log.userId?.displayName || 'Unknown'} ({log.userRole})
                            </div>
                            {log.message && <div className="timeline-body">{log.message}</div>}
                            {log.action === 'STATUS_UPDATE' && (
                                <div className="timeline-changes">
                                    <span className="old-val">{log.previousValue}</span> ➔ <span className="new-val">{log.newValue}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Timeline;
