import React from 'react';
import { Search } from 'lucide-react';

const QUICK_VIEWS = [
    { id: 'all', label: 'All' },
    { id: 'healthy', label: 'Healthy' },
    { id: 'warning', label: 'Warning' },
    { id: 'critical', label: 'Critical' },
    { id: 'bottleneck', label: 'Bottleneck' },
    { id: 'unassigned', label: 'Unassigned' },
];

const STAGES = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

const WorkspaceToolbar = ({
    searchTerm,
    onSearchChange,
    stageFilter,
    onStageFilterChange,
    healthFilter,
    onHealthFilterChange,
    assigneeFilter,
    onAssigneeFilterChange,
    quickView,
    onQuickViewChange,
    engineers = [],
}) => {
    return (
        <div className="ws-toolbar">
            {/* Search */}
            <div className="ws-toolbar-search">
                <Search size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <input
                    type="text"
                    placeholder="Search blocks..."
                    value={searchTerm}
                    onChange={e => onSearchChange(e.target.value)}
                />
            </div>

            {/* Stage filter */}
            <select
                className="ws-toolbar-select"
                value={stageFilter}
                onChange={e => onStageFilterChange(e.target.value)}
            >
                <option value="">All Stages</option>
                {STAGES.map(s => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
            </select>

            {/* Health filter */}
            <select
                className="ws-toolbar-select"
                value={healthFilter}
                onChange={e => onHealthFilterChange(e.target.value)}
            >
                <option value="">All Health</option>
                <option value="HEALTHY">Healthy</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
                <option value="BOTTLENECK">Bottleneck</option>
            </select>

            {/* Assignee filter */}
            <select
                className="ws-toolbar-select"
                value={assigneeFilter}
                onChange={e => onAssigneeFilterChange(e.target.value)}
            >
                <option value="">All Assignees</option>
                <option value="__unassigned__">Unassigned</option>
                {engineers.map(eng => (
                    <option key={eng._id} value={eng._id}>{eng.displayName}</option>
                ))}
            </select>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Quick-view pills */}
            {QUICK_VIEWS.map(v => (
                <button
                    key={v.id}
                    className={`ws-pill ${quickView === v.id ? 'active' : ''}`}
                    onClick={() => onQuickViewChange(v.id === quickView ? 'all' : v.id)}
                >
                    {v.label}
                </button>
            ))}
        </div>
    );
};

export default WorkspaceToolbar;
