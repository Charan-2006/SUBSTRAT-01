import React from 'react';
import './Sidebar.css';

const WORKFLOW_STAGES = [
    { id: 'NOT_STARTED', label: 'Not Started' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'DRC', label: 'DRC' },
    { id: 'LVS', label: 'LVS' },
    { id: 'REVIEW', label: 'Review' },
    { id: 'COMPLETED', label: 'Completed' },
];

const Sidebar = ({
    blocks = [],
    analytics,
    requests = [],
    healthFilter,
    stageFilter,
    setFilter,
    clearFilters,
    onNewBlock = () => {},
    onViewLogs = () => {},
    onLoadDemo = () => {},
    onResetDataset = () => {},
    isManager,
    isCollapsed,
    onToggleCollapse,
}) => {
    // Compute counts from raw blocks
    const counts = {
        total: blocks.length,
        healthy: blocks.filter(b => b.healthStatus === 'HEALTHY').length,
        risk: blocks.filter(b => b.healthStatus === 'RISK').length,
        critical: blocks.filter(b => b.healthStatus === 'CRITICAL').length,
        pendingRequests: requests.filter(r => r.status === 'PENDING').length
    };

    const stageCounts = {};
    WORKFLOW_STAGES.forEach(s => {
        stageCounts[s.id] = blocks.filter(b => b.status === s.id).length;
    });

    const isAllActive = healthFilter === 'ALL' && !stageFilter;

    return (
        <aside className="sidebar">
            {/* Brand Section */}
            <div className="sidebar-brand">
                {!isCollapsed && (
                    <div className="logo-tagline-container">
                        <img src="/logo-text.png" alt="Substrat tagline" className="logo-tagline" />
                    </div>
                )}
                <button 
                    onClick={onToggleCollapse}
                    className="sidebar-collapse-btn"
                >
                    {isCollapsed ? '→' : '←'}
                </button>
            </div>

            <div className="sidebar-scroll">
                {/* Workspace Section */}
                <div className="sidebar-section">
                    <div className="sidebar-section-label">Workspace</div>
                    <button
                        className={`sidebar-filter-item ${isAllActive ? 'sidebar-filter-item--active' : ''}`}
                        onClick={clearFilters}
                    >
                        <span className="sidebar-stage-marker"></span>
                        <span>All Blocks</span>
                        <span className="sidebar-filter-count">{counts.total}</span>
                    </button>
                    {isManager && (
                        <button className="sidebar-filter-item" onClick={onViewLogs}>
                            <span className="sidebar-stage-marker"></span>
                            <span>Audit Trail</span>
                        </button>
                    )}
                </div>

                {/* Filters Section */}
                <div className="sidebar-section">
                    <div className="sidebar-section-label">Filters</div>
                    <button
                        className={`sidebar-filter-item ${healthFilter === 'CRITICAL' ? 'sidebar-filter-item--active' : ''}`}
                        onClick={() => setFilter('health', 'CRITICAL')}
                    >
                        <span className="sidebar-filter-dot sidebar-filter-dot--critical"></span>
                        <span>Critical</span>
                        <span className="sidebar-filter-count">{counts.critical}</span>
                    </button>

                    <button
                        className={`sidebar-filter-item ${healthFilter === 'RISK' ? 'sidebar-filter-item--active' : ''}`}
                        onClick={() => setFilter('health', 'RISK')}
                    >
                        <span className="sidebar-filter-dot sidebar-filter-dot--risk"></span>
                        <span>At Risk</span>
                        <span className="sidebar-filter-count">{counts.risk}</span>
                    </button>

                    <button
                        className={`sidebar-filter-item ${healthFilter === 'HEALTHY' ? 'sidebar-filter-item--active' : ''}`}
                        onClick={() => setFilter('health', 'HEALTHY')}
                    >
                        <span className="sidebar-filter-dot sidebar-filter-dot--healthy"></span>
                        <span>Healthy</span>
                        <span className="sidebar-filter-count">{counts.healthy}</span>
                    </button>
                </div>

                {/* Workflow Section */}
                <div className="sidebar-section">
                    <div className="sidebar-section-label">Workflow</div>
                    {WORKFLOW_STAGES.map(stage => (
                        <button
                            key={stage.id}
                            className={`sidebar-filter-item ${stageFilter === stage.id ? 'sidebar-filter-item--active' : ''}`}
                            onClick={() => setFilter('stage', stage.id)}
                        >
                            <span className="sidebar-stage-marker"></span>
                            <span>{stage.label}</span>
                            <span className="sidebar-filter-count">{stageCounts[stage.id]}</span>
                        </button>
                    ))}
                </div>

                {/* Insights */}
                {analytics?.bottleneckStage && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-label">Insights</div>
                        <div className="sidebar-insight">
                            <div className="sidebar-insight-title">Bottleneck Detected</div>
                            <div className="sidebar-insight-text">
                                {analytics.bottleneckStage} — avg {analytics.maxAvgHours?.toFixed(1)}h
                            </div>
                        </div>
                    </div>
                )}

                {/* Requests Indicator */}
                {counts.pendingRequests > 0 && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-label">Intake</div>
                        <div className="sidebar-insight" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent)', cursor: 'pointer' }}>
                            <div className="sidebar-insight-title" style={{ color: 'var(--accent)' }}>Requests</div>
                            <div className="sidebar-insight-text" style={{ color: 'var(--accent)' }}>
                                {counts.pendingRequests} pending {counts.pendingRequests === 1 ? 'request' : 'requests'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions Section */}
                {isManager && (
                    <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: 24 }}>
                        <div className="sidebar-section-label">Management</div>
                        <button className="sidebar-action" onClick={() => {
                            console.log('[UI Event] Click Create Block in Sidebar');
                            onNewBlock();
                        }}>
                            + Create Block
                        </button>
                        <button className="sidebar-action sidebar-action--muted" onClick={() => {
                            console.log('[UI Event] Click Load Demo Data');
                            onLoadDemo();
                        }}>
                            Load Demo Data
                        </button>
                        <button className="sidebar-action sidebar-action--danger" onClick={() => {
                            console.log('[UI Event] Click Reset Dataset');
                            onResetDataset();
                        }}>
                            Reset Dataset
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
