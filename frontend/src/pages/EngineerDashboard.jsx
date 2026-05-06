import React, { useState, useMemo } from 'react';
import SummaryDashboard from './SummaryDashboard';
import WorkflowTimeline from './WorkflowTimeline';
import RequestsTab from './RequestsTab';
import ExecutionTab from './ExecutionTab';

const EngineerDashboard = ({ user, blocks = [], filteredBlocks = [], analytics, engineers = [], requests = [], onCreateRequest, onUpdateStatus, selectedBlockId, onSelectBlock }) => {
    const workflowOrder = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [activeTab, setActiveTab] = useState('my-work');

    // Filter to only my assignments
    const myBlocks = useMemo(() => {
        return blocks.filter(b => b.assignedEngineer?._id === user?._id || b.assignedEngineer === user?._id);
    }, [blocks, user]);

    const myFilteredBlocks = useMemo(() => {
        return filteredBlocks.filter(b => b.assignedEngineer?._id === user?._id || b.assignedEngineer === user?._id);
    }, [filteredBlocks, user]);

    const calculateUpcomingStatus = (currentStatus) => {
        const index = workflowOrder.indexOf(currentStatus);
        if (index !== -1 && index < workflowOrder.length - 1) {
            return workflowOrder[index + 1];
        }
        return null;
    };

    const getPriority = (complexity) => {
        if (complexity === 'CRITICAL' || complexity === 'COMPLEX') return { label: 'High', color: '#ef4444' };
        if (complexity === 'MEDIUM') return { label: 'Medium', color: '#f59e0b' };
        return { label: 'Low', color: '#3b82f6' };
    };

    const getDueDate = (block) => {
        if (!block.stageStartTime || !block.estimatedHours) return '—';
        const start = new Date(block.stageStartTime);
        const due = new Date(start.getTime() + block.estimatedHours * 60 * 60 * 1000);
        return due.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getNextAction = (status) => {
        const actions = {
            'NOT_STARTED': 'Begin Setup',
            'IN_PROGRESS': 'Run Layout',
            'DRC': 'Fix Violations',
            'LVS': 'Resolve LVS',
            'REVIEW': 'Apply Feedback',
            'COMPLETED': 'Archived'
        };
        return actions[status] || 'Proceed';
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const sortedBlocks = [...myFilteredBlocks].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'status') {
            valA = workflowOrder.indexOf(a.status);
            valB = workflowOrder.indexOf(b.status);
        } else if (sortField === 'health') {
            const healthOrder = ['CRITICAL', 'RISK', 'HEALTHY'];
            valA = healthOrder.indexOf(a.healthStatus);
            valB = healthOrder.indexOf(b.healthStatus);
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
                    <h1>Engineer Workspace</h1>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        {myBlocks.length} Assigned Blocks • {myBlocks.filter(b => b.healthStatus === 'CRITICAL').length} Blocked
                    </div>
                </div>
                <div className="header-bar-tabs">
                    <div 
                        className={`header-tab ${activeTab === 'my-work' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my-work')}
                    >My Work</div>
                    <div 
                        className={`header-tab ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >Summary</div>
                    <div 
                        className={`header-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                        onClick={() => setActiveTab('timeline')}
                    >Timeline</div>
                    <div 
                        className={`header-tab ${activeTab === 'execution' ? 'active' : ''}`}
                        onClick={() => setActiveTab('execution')}
                    >Execution</div>
                    <div 
                        className={`header-tab ${activeTab === 'blockers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('blockers')}
                    >Blockers</div>
                    <div 
                        className={`header-tab ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >Requests</div>
                </div>
            </div>

            <div className="page-content">
                {activeTab === 'my-work' && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Assigned Blocks ({sortedBlocks.length})
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th className="sortable" onClick={() => handleSort('name')}>Name {renderSortIcon('name')}</th>
                                    <th className="sortable" onClick={() => handleSort('status')}>Stage {renderSortIcon('status')}</th>
                                    <th style={{ width: 120 }}>Status</th>
                                    <th style={{ width: 100 }}>Priority</th>
                                    <th style={{ width: 100 }}>Due Date</th>
                                    <th style={{ width: 120, textAlign: 'right', paddingRight: 24 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBlocks.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                            No active assignments matching current filters.
                                        </td>
                                    </tr>
                                )}
                                {sortedBlocks.map(block => {
                                    const priority = getPriority(block.complexity);
                                    return (
                                        <tr
                                            key={block._id}
                                            className={`hover-row ${selectedBlockId === block._id ? 'row-selected' : ''} ${block.healthStatus === 'CRITICAL' ? 'row-critical' : ''}`}
                                            onClick={() => onSelectBlock(block)}
                                        >
                                            <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{block.name}</td>
                                            <td>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{block.status.replace('_', ' ')}</span>
                                            </td>
                                            <td>
                                                <div className="health-status">
                                                    <span className={`health-dot health-dot-${block.healthStatus}`}></span>
                                                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{block.healthStatus}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: priority.color }}>{priority.label}</span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{getDueDate(block)}</td>
                                            <td style={{ paddingRight: 24 }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                                    <button className="btn btn-sm" onClick={() => onSelectBlock(block)}>View</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'summary' && (
                    <SummaryDashboard 
                        blocks={myBlocks} 
                        analytics={analytics} 
                        isEngineerView={true}
                        onSelectBlock={onSelectBlock}
                    />
                )}

                {activeTab === 'timeline' && (
                    <WorkflowTimeline 
                        blocks={myBlocks} 
                        onSelectBlock={onSelectBlock}
                        onUpdateStatus={onUpdateStatus}
                    />
                )}

                {activeTab === 'execution' && (
                    <ExecutionTab blocks={myBlocks} onSelectBlock={onSelectBlock} />
                )}

                {activeTab === 'blockers' && (
                    <div className="card">
                        <div className="card-header">
                            <h3>Active Blockers & Risks</h3>
                        </div>
                        <div className="card-content">
                            {myBlocks.filter(b => b.healthStatus !== 'HEALTHY').length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
                                    Great work! No active blockers detected in your workflow.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {myBlocks.filter(b => b.healthStatus !== 'HEALTHY').map(block => (
                                        <div key={block._id} className={`bl-item bl-item-${block.healthStatus.toLowerCase()}`} onClick={() => onSelectBlock(block)}>
                                            <div className="bl-item-main">
                                                <div className="bl-item-title">{block.name}</div>
                                                <div className="bl-item-meta">{block.status.replace('_', ' ')} • {getDueDate(block)}</div>
                                            </div>
                                            <div className="bl-item-reason">
                                                {block.healthReasons?.[0] || 'Manual flag: Check health status'}
                                            </div>
                                            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onSelectBlock(block); }}>Fix Blocker</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <RequestsTab 
                        requests={requests}
                        onCreateRequest={onCreateRequest}
                        engineers={engineers}
                        isManager={false}
                    />
                )}
            </div>
        </div>
    );
};

export default EngineerDashboard;
