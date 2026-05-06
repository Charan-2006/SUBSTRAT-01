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

const EngineerDashboard = ({ blocks = [], filteredBlocks = [], analytics, engineers = [], requests = [], onCreateRequest, onUpdateStatus, selectedBlockId, onSelectBlock }) => {
    const workflowOrder = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [activeTab, setActiveTab] = useState('list');

    const calculateUpcomingStatus = (currentStatus) => {
        const index = workflowOrder.indexOf(currentStatus);
        if (index !== -1 && index < workflowOrder.length - 2) {
            return workflowOrder[index + 1];
        }
        return null;
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
            valA = workflowOrder.indexOf(a.status);
            valB = workflowOrder.indexOf(b.status);
        } else if (sortField === 'health') {
            const healthOrder = ['CRITICAL', 'RISK', 'HEALTHY'];
            valA = healthOrder.indexOf(a.healthStatus);
            valB = healthOrder.indexOf(b.healthStatus);
        } else if (sortField === 'complexity') {
            const complexityOrder = ['SIMPLE', 'MEDIUM', 'COMPLEX'];
            valA = complexityOrder.indexOf(a.complexity);
            valB = complexityOrder.indexOf(b.complexity);
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const renderSortIcon = (field) => {
        if (sortField !== field) return null;
        return <span style={{ marginLeft: 4, fontSize: 10 }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
    };

    return (
        <div className="dashboard-container">
            {/* Header Bar */}
            <div className="header-bar">
                <div className="header-bar-top">
                    <h1>My Assignments</h1>
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
                        className={`header-tab ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >Requests</div>
                    <div 
                        className={`header-tab ${activeTab === 'reporting' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reporting')}
                    >Reporting</div>
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
                <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                        Manage your assigned layout blocks and advance them to the next stage upon completion.
                    </p>
                </div>

                {activeTab === 'list' && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {sortedBlocks.length} Result{sortedBlocks.length !== 1 ? 's' : ''}
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 40, paddingLeft: 20 }}><input type="checkbox" /></th>
                                    <th className="sortable" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</th>
                                    <th className="sortable" onClick={() => handleSort('complexity')}>Complexity {renderSortIcon('complexity')}</th>
                                    <th className="sortable" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</th>
                                    <th className="sortable" onClick={() => handleSort('health')}>Health {renderSortIcon('health')}</th>
                                    <th>Review Notes</th>
                                    <th style={{ width: 180, textAlign: 'right', paddingRight: 24 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBlocks.length === 0 && (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                            No blocks currently assigned to you.
                                        </td>
                                    </tr>
                                )}
                                {sortedBlocks.map(block => {
                                    const upcomingStatus = calculateUpcomingStatus(block.status);
                                    return (
                                        <tr
                                            key={block._id}
                                            className={`${selectedBlockId === block._id ? 'row-selected' : ''}`}
                                            onClick={() => onSelectBlock(block)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td style={{ paddingLeft: 20 }} onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                                            <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{block.name}</td>
                                            <td>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{block.complexity}</span>
                                            </td>
                                            <td><span className={`status-badge status-${block.status}`}>{block.status.replace('_', ' ')}</span></td>
                                            <td>
                                                <div className="health-status">
                                                    <span className={`health-dot health-dot-${block.healthStatus}`}></span>
                                                    {block.healthStatus}
                                                </div>
                                            </td>
                                            <td style={{ color: block.rejectionReason ? 'var(--red-text)' : 'var(--text-tertiary)', fontSize: 12, fontWeight: block.rejectionReason ? 700 : 400 }}>
                                                {block.rejectionReason || 'No notes available'}
                                            </td>
                                            <td style={{ paddingRight: 24 }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                                    {upcomingStatus && (
                                                        <button className="btn btn-sm btn-primary" onClick={() => {
                                                            console.log(`[UI Event] Click Advance Stage for block ${block._id}`);
                                                            onUpdateStatus(block._id, upcomingStatus);
                                                        }}>
                                                            Advance Stage
                                                         </button>
                                                    )}
                                                    <button className="btn btn-sm" onClick={() => onSelectBlock(block)}>
                                                        View
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
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
                        engineers={engineers}
                        isManager={false}
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

export default EngineerDashboard;
