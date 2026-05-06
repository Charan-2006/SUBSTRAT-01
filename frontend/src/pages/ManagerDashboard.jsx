import React, { useState } from 'react';
import SummaryDashboard from './SummaryDashboard';
import WorkflowTimeline from './WorkflowTimeline';
import RequestsTab from './RequestsTab';
import ReportingTab from './ReportingTab';
import DocsTab from './DocsTab';
import InsightsTab from './InsightsTab';
import PriorityMatrixTab from './PriorityMatrixTab';
import RoadmapTab from './RoadmapTab';
import ExecutionTab from './ExecutionTab';

const ManagerDashboard = ({
    blocks = [],
    filteredBlocks = [],
    engineers = [],
    analytics,
    requests = [],
    healthFilter,
    stageFilter,
    showForm,
    setShowForm,
    onCreateBlock,
    onAssign,
    onReview,
    onUpdateStatus,
    onCreateRequest,
    onApproveRequest,
    onRejectRequest,
    selectedBlockId,
    onSelectBlock,
}) => {
    const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;
    const [formData, setFormData] = useState({
        name: '', type: '', description: '', techNode: '', complexity: 'SIMPLE', baseHours: 0
    });
    const [rejectionReason, setRejectionReason] = useState('');
    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [activeTab, setActiveTab] = useState('list');

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('[UI Event] Submit Create Block form');
        const payload = {
            ...formData,
            baseHours: Number(formData.baseHours)
        };
        onCreateBlock(payload);
        setFormData({ name: '', type: '', description: '', techNode: '', complexity: 'SIMPLE', baseHours: 0 });
    };

    const handleReviewAction = (blockId, action) => {
        console.log(`[UI Event] Click ${action} for block ${blockId}`);
        let reason = '';
        if (action === 'REJECT') {
            reason = window.prompt('Please enter a rejection reason:');
            if (reason === null) return; // Cancelled
        }
        onReview(blockId, action, reason);
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const sortedBlocks = [...filteredBlocks].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'status') {
            const statusOrder = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
            valA = statusOrder.indexOf(a.status);
            valB = statusOrder.indexOf(b.status);
        } else if (sortField === 'health') {
            const healthOrder = ['CRITICAL', 'RISK', 'HEALTHY'];
            valA = healthOrder.indexOf(a.healthStatus);
            valB = healthOrder.indexOf(b.healthStatus);
        } else if (sortField === 'estimatedHours') {
            valA = a.estimatedHours;
            valB = b.estimatedHours;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

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

    const renderSortIcon = (field) => {
        if (sortField !== field) return null;
        return <span style={{ marginLeft: 4, fontSize: 10 }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
    };

    return (
        <div className="dashboard-container">
            {/* Header Bar */}
            <div className="header-bar">
                <div className="header-bar-top">
                    <h1>SUBSTRAT Workspace</h1>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {activeFilterLabel && (
                            <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 12px',
                                borderRadius: 4,
                                background: 'var(--accent-subtle)',
                                color: 'var(--accent)',
                                textTransform: 'uppercase'
                            }}>
                                {activeFilterLabel}
                            </span>
                        )}
                        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Create Block</button>
                    </div>
                </div>
                <div className="header-bar-tabs">
                    <div 
                        className={`header-tab ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >List</div>
                    <div 
                        className={`header-tab ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >Overview</div>
                    <div 
                        className={`header-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                        onClick={() => setActiveTab('timeline')}
                    >Timeline</div>
                    <div 
                        className={`header-tab ${activeTab === 'reporting' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reporting')}
                    >Reporting</div>
                    <div 
                        className={`header-tab ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        Requests
                        {pendingRequestsCount > 0 && (
                            <span style={{
                                background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, 
                                padding: '2px 6px', borderRadius: 10
                            }}>
                                {pendingRequestsCount}
                            </span>
                        )}
                    </div>
                    <div 
                        className={`header-tab ${activeTab === 'docs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('docs')}
                    >Docs</div>
                    <div 
                        className={`header-tab ${activeTab === 'insights' ? 'active' : ''}`}
                        onClick={() => setActiveTab('insights')}
                    >Insights</div>
                    <div 
                        className={`header-tab ${activeTab === 'matrix' ? 'active' : ''}`}
                        onClick={() => setActiveTab('matrix')}
                    >Matrix</div>
                    <div 
                        className={`header-tab ${activeTab === 'roadmap' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roadmap')}
                    >Roadmap</div>
                    <div 
                        className={`header-tab ${activeTab === 'execution' ? 'active' : ''}`}
                        onClick={() => setActiveTab('execution')}
                    >Execution</div>
                </div>
            </div>

            <div className="page-content">
                {/* Insight Banner */}
                {analytics?.bottleneckStage && !stageFilter && healthFilter === 'ALL' && (
                    <div className="bottleneck-card fade-in">
                        <span className="stage-name">{analytics.bottleneckStage}</span>
                        <p style={{ margin: 0, fontSize: 13 }}>
                            detected as the current system bottleneck with an average duration of <strong>{analytics.maxAvgHours.toFixed(1)}h</strong>.
                        </p>
                    </div>
                )}

                {/* Dashboard Summary Cards */}
                {activeTab === 'list' && (
                    <div className="grid grid-4" style={{ marginBottom: 32 }}>
                        <div className="stat-card">
                            <div className="stat-card-label">Total Blocks</div>
                            <div className="stat-card-value">{stats.total}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">Healthy</div>
                            <div className="stat-card-value" style={{ color: 'var(--green)' }}>{stats.healthy}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">At Risk</div>
                            <div className="stat-card-value" style={{ color: 'var(--amber)' }}>{stats.risk}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label">Critical</div>
                            <div className="stat-card-value" style={{ color: 'var(--red)' }}>{stats.critical}</div>
                        </div>
                    </div>
                )}

                {/* Block form */}
                {showForm && (
                    <div className="card fade-in" style={{ marginBottom: 32 }}>
                        <h3 style={{ marginBottom: 20 }}>Create New Layout Block</h3>
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
                            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                                <button type="submit" className="btn btn-primary">Create Block</button>
                                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Block Table */}
                {activeTab === 'list' && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Table content remains same */}
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 40, paddingLeft: 20 }}><input type="checkbox" /></th>
                                    <th className="sortable" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</th>
                                    <th className="sortable" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</th>
                                    <th className="sortable" onClick={() => handleSort('health')}>Health {renderSortIcon('health')}</th>
                                    <th className="sortable" onClick={() => handleSort('estimatedHours')}>Estimated {renderSortIcon('estimatedHours')}</th>
                                    <th>Assignee</th>
                                    <th style={{ width: 180, textAlign: 'right', paddingRight: 24 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBlocks.length === 0 && (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                            No blocks found matching the current criteria.
                                        </td>
                                    </tr>
                                )}
                                {sortedBlocks.map(block => (
                                    <tr
                                        key={block._id}
                                        className={`${selectedBlockId === block._id ? 'row-selected' : ''}`}
                                        onClick={() => onSelectBlock(block)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td style={{ paddingLeft: 20 }} onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{block.name}</td>
                                        <td><span className={`status-badge status-${block.status}`}>{block.status.replace('_', ' ')}</span></td>
                                        <td>
                                            <div className="health-status">
                                                <span className={`health-dot health-dot-${block.healthStatus}`}></span>
                                                {block.healthStatus}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{block.estimatedHours}h</td>
                                        <td style={{ color: block.assignedEngineer ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}>
                                            {block.assignedEngineer ? block.assignedEngineer.displayName : 'Unassigned'}
                                        </td>
                                        <td style={{ paddingRight: 24 }}>
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                                {block.status === 'REVIEW' && (
                                                    <>
                                                        <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }} onClick={() => handleReviewAction(block._id, 'APPROVE')}>
                                                            Approve
                                                        </button>
                                                        <button className="btn btn-sm" style={{ background: 'var(--red-bg)', color: 'var(--red-text)' }} onClick={() => handleReviewAction(block._id, 'REJECT')}>
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                                {!block.assignedEngineer && block.status !== 'COMPLETED' && (
                                                    <select
                                                        className="form-control"
                                                        style={{ width: 140, padding: '4px 8px', fontSize: 12, height: 32 }}
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
                )}

                {activeTab === 'overview' && (
                    <SummaryDashboard 
                        blocks={blocks} 
                        analytics={analytics} 
                        engineers={engineers} 
                        onSelectBlock={onSelectBlock}
                    />
                )}

                {activeTab === 'timeline' && (
                    <WorkflowTimeline 
                        blocks={blocks} 
                        onSelectBlock={onSelectBlock}
                        onUpdateStatus={onUpdateStatus}
                    />
                )}

                {activeTab === 'reporting' && (
                    <ReportingTab 
                        blocks={blocks} 
                        engineers={engineers} 
                        analytics={analytics} 
                    />
                )}

                {activeTab === 'requests' && (
                    <RequestsTab 
                        requests={requests}
                        onCreateRequest={onCreateRequest}
                        onApproveRequest={onApproveRequest}
                        onRejectRequest={onRejectRequest}
                        engineers={engineers}
                        isManager={true}
                    />
                )}

                {activeTab === 'docs' && (
                    <DocsTab blocks={blocks} />
                )}

                {activeTab === 'insights' && (
                    <InsightsTab blocks={blocks} engineers={engineers} onSelectBlock={onSelectBlock} onUpdateStatus={onUpdateStatus} />
                )}

                {activeTab === 'matrix' && (
                    <PriorityMatrixTab blocks={blocks} onSelectBlock={onSelectBlock} />
                )}

                {activeTab === 'roadmap' && (
                    <RoadmapTab blocks={blocks} onSelectBlock={onSelectBlock} />
                )}

                {activeTab === 'execution' && (
                    <ExecutionTab blocks={blocks} onSelectBlock={onSelectBlock} />
                )}
            </div>
        </div>
    );
};

export default ManagerDashboard;
