import React, { useState } from 'react';

const ManagerDashboard = ({
    blocks,
    filteredBlocks,
    engineers,
    analytics,
    healthFilter,
    stageFilter,
    showForm,
    setShowForm,
    onCreateBlock,
    onAssign,
    onReview,
    selectedBlockId,
    onSelectBlock,
}) => {
    const [formData, setFormData] = useState({
        name: '', type: '', description: '', techNode: '', complexity: 'SIMPLE', baseHours: 0
    });
    const [rejectionReason, setRejectionReason] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onCreateBlock(formData);
        setFormData({ name: '', type: '', description: '', techNode: '', complexity: 'SIMPLE', baseHours: 0 });
    };

    const handleReview = (blockId, action) => {
        onReview(blockId, action, rejectionReason);
        setRejectionReason('');
    };

    const stats = {
        total: blocks.length,
        healthy: blocks.filter(b => b.healthStatus === 'HEALTHY').length,
        risk: blocks.filter(b => b.healthStatus === 'RISK').length,
        critical: blocks.filter(b => b.healthStatus === 'CRITICAL').length
    };

    const activeFilterLabel = stageFilter
        ? `Stage: ${stageFilter}`
        : healthFilter !== 'ALL'
            ? `Health: ${healthFilter}`
            : null;

    return (
        <div>
            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Blocks</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Manage analog layout blocks and assignments
                    </p>
                </div>
            </div>

            {/* Insight banner */}
            {analytics?.bottleneckStage && !stageFilter && healthFilter === 'ALL' && (
                <div className="alert alert-warning">
                    <strong>Insight:</strong> Bottleneck detected in <strong>{analytics.bottleneckStage}</strong> stage
                    — avg. {analytics.maxAvgHours.toFixed(1)}h per block.
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-4" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card-label">Total Blocks</div>
                    <div className="stat-card-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-label">Healthy</div>
                    <div className="stat-card-value" style={{ color: 'var(--green)' }}>{stats.healthy}</div>
                    <div className="stat-card-indicator" style={{ background: 'var(--green)' }}></div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-label">At Risk</div>
                    <div className="stat-card-value" style={{ color: 'var(--amber)' }}>{stats.risk}</div>
                    <div className="stat-card-indicator" style={{ background: 'var(--amber)' }}></div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-label">Critical</div>
                    <div className="stat-card-value" style={{ color: 'var(--red)' }}>{stats.critical}</div>
                    <div className="stat-card-indicator" style={{ background: 'var(--red)' }}></div>
                </div>
            </div>

            {/* Block form */}
            {showForm && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>New Block</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-2">
                            <div className="form-group">
                                <label>Block Name</label>
                                <input className="form-control" required placeholder="e.g. Bandgap_Ref" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <input className="form-control" placeholder="e.g. Analog Core" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Tech Node</label>
                                <input className="form-control" placeholder="e.g. 7nm" value={formData.techNode} onChange={e => setFormData({...formData, techNode: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Complexity</label>
                                <select className="form-control" value={formData.complexity} onChange={e => setFormData({...formData, complexity: e.target.value})}>
                                    <option value="SIMPLE">Simple</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="COMPLEX">Complex</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Base Hours</label>
                                <input type="number" className="form-control" required placeholder="0" value={formData.baseHours} onChange={e => setFormData({...formData, baseHours: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input className="form-control" placeholder="Brief description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button type="submit" className="btn btn-primary">Save Block</button>
                            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Block table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {filteredBlocks.length} block{filteredBlocks.length !== 1 ? 's' : ''}
                    </span>
                    {activeFilterLabel && (
                        <span style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'var(--accent-subtle)',
                            color: 'var(--accent)'
                        }}>
                            {activeFilterLabel}
                        </span>
                    )}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Health</th>
                            <th>Est. Hours</th>
                            <th>Assigned To</th>
                            <th style={{ width: 200 }}>Actions</th>
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
                        {filteredBlocks.map(block => (
                            <tr
                                key={block._id}
                                className={`${block.healthStatus === 'CRITICAL' ? 'row-critical' : ''} ${selectedBlockId === block._id ? 'row-selected' : ''}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onSelectBlock(block)}
                            >
                                <td style={{ fontWeight: 500 }}>{block.name}</td>
                                <td><span className={`status-badge status-${block.status}`}>{block.status}</span></td>
                                <td>
                                    <div className="health-status" title={block.healthReasons?.join('\n') || 'Healthy'}>
                                        <span className={`health-dot health-dot-${block.healthStatus}`}></span>
                                        {block.healthStatus}
                                    </div>
                                </td>
                                <td>{block.estimatedHours}</td>
                                <td style={{ color: block.assignedEngineer ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                    {block.assignedEngineer ? block.assignedEngineer.displayName : '—'}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                        <button
                                            className={`btn btn-sm ${selectedBlockId === block._id ? 'btn-primary' : ''}`}
                                            onClick={() => onSelectBlock(block)}
                                        >
                                            Details
                                        </button>

                                        {block.status === 'REVIEW' && (
                                            <>
                                                <button className="btn btn-sm btn-success" onClick={() => handleReview(block._id, 'APPROVE')}>
                                                    Approve
                                                </button>
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <input
                                                        className="form-control"
                                                        placeholder="Reason..."
                                                        value={rejectionReason}
                                                        onChange={e => setRejectionReason(e.target.value)}
                                                        style={{ width: 100, padding: '3px 6px', fontSize: 11 }}
                                                    />
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleReview(block._id, 'REJECT')}>Reject</button>
                                                </div>
                                            </>
                                        )}

                                        {!block.assignedEngineer && (
                                            <select
                                                className="form-control"
                                                style={{ width: 120, padding: '4px 8px', fontSize: 12 }}
                                                onChange={(e) => {
                                                    const engId = e.target.value;
                                                    if (engId) onAssign(block._id, engId);
                                                }}
                                            >
                                                <option value="">Assign...</option>
                                                {engineers.map(eng => (
                                                    <option key={eng._id} value={eng._id}>{eng.displayName}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManagerDashboard;
