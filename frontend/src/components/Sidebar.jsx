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
    healthFilter,
    stageFilter,
    setFilter,
    clearFilters,
    onNewBlock,
    onLoadDemo,
    isManager,
}) => {
    // Compute counts from raw blocks
    const counts = {
        total: blocks.length,
        healthy: blocks.filter(b => b.healthStatus === 'HEALTHY').length,
        risk: blocks.filter(b => b.healthStatus === 'RISK').length,
        critical: blocks.filter(b => b.healthStatus === 'CRITICAL').length,
    };

    const stageCounts = {};
    WORKFLOW_STAGES.forEach(s => {
        stageCounts[s.id] = blocks.filter(b => b.status === s.id).length;
    });

    const isAllActive = healthFilter === 'ALL' && !stageFilter;

    return (
        <aside className="sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <span className="sidebar-logo">◆</span>
                <span>Analog Layout</span>
            </div>

            <div className="sidebar-scroll">
                {/* Quick Actions */}
                {isManager && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-label">Actions</div>
                        <button className="sidebar-action" onClick={onNewBlock}>
                            <span className="sidebar-action-icon">+</span>
                            New Block
                        </button>
                        <button className="sidebar-action sidebar-action--muted" onClick={onLoadDemo}>
                            <span className="sidebar-action-icon">↻</span>
                            Load Demo Data
                        </button>
                    </div>
                )}

                {/* Health Filters */}
                <div className="sidebar-section">
                    <div className="sidebar-section-label">Filter</div>

                    <button
                        className={`sidebar-filter-item ${isAllActive ? 'sidebar-filter-item--active' : ''}`}
                        onClick={clearFilters}
                    >
                        <span className="sidebar-filter-dot sidebar-filter-dot--all"></span>
                        <span>All Blocks</span>
                        <span className="sidebar-filter-count">{counts.total}</span>
                    </button>

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

                {/* Workflow Stages */}
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
                        <div className="sidebar-section-label">Insight</div>
                        <button
                            className="sidebar-insight"
                            onClick={() => setFilter('stage', analytics.bottleneckStage)}
                        >
                            <div className="sidebar-insight-icon">⚠</div>
                            <div className="sidebar-insight-body">
                                <div className="sidebar-insight-title">Bottleneck</div>
                                <div className="sidebar-insight-text">
                                    {analytics.bottleneckStage} — avg {analytics.maxAvgHours?.toFixed(1)}h
                                </div>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
