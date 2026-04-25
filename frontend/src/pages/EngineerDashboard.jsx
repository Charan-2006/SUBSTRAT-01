import React from 'react';

const EngineerDashboard = ({ blocks, filteredBlocks, onUpdateStatus, selectedBlockId, onSelectBlock }) => {
    const workflowOrder = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

    const calculateUpcomingStatus = (currentStatus) => {
        const index = workflowOrder.indexOf(currentStatus);
        if (index !== -1 && index < workflowOrder.length - 2) {
            return workflowOrder[index + 1];
        }
        return null;
    };

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>My Blocks</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Blocks assigned to you — advance them through the workflow.
                </p>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {filteredBlocks.length} block{filteredBlocks.length !== 1 ? 's' : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Complexity</th>
                            <th>Status</th>
                            <th>Health</th>
                            <th>Rejection Note</th>
                            <th style={{ width: 160 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBlocks.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
                                    No blocks match the current filter.
                                </td>
                            </tr>
                        )}
                        {filteredBlocks.map(block => {
                            const upcomingStatus = calculateUpcomingStatus(block.status);
                            return (
                                <tr
                                    key={block._id}
                                    className={`${block.healthStatus === 'CRITICAL' ? 'row-critical' : ''} ${selectedBlockId === block._id ? 'row-selected' : ''}`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => onSelectBlock(block)}
                                >
                                    <td style={{ fontWeight: 500 }}>{block.name}</td>
                                    <td>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{block.complexity}</span>
                                    </td>
                                    <td><span className={`status-badge status-${block.status}`}>{block.status}</span></td>
                                    <td>
                                        <div className="health-status" title={block.healthReasons?.join('\n') || 'Healthy'}>
                                            <span className={`health-dot health-dot-${block.healthStatus}`}></span>
                                            {block.healthStatus}
                                        </div>
                                    </td>
                                    <td style={{ color: block.rejectionReason ? 'var(--red)' : 'var(--text-tertiary)', fontSize: 12 }}>
                                        {block.rejectionReason || '—'}
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                className={`btn btn-sm ${selectedBlockId === block._id ? 'btn-primary' : ''}`}
                                                onClick={() => onSelectBlock(block)}
                                            >
                                                Details
                                            </button>
                                            {upcomingStatus && (
                                                <button className="btn btn-sm btn-primary" onClick={() => onUpdateStatus(block._id, upcomingStatus)}>
                                                    → {upcomingStatus}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EngineerDashboard;
