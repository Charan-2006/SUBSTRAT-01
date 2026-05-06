import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import './AdvancedViews.css';

const STAGES = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

const InsightsTab = ({ blocks = [], engineers = [], onSelectBlock, onUpdateStatus }) => {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const [stageFilter, setStageFilter] = useState('ALL');
    const [healthFilter, setHealthFilter] = useState('ALL');

    const getProgress = (block) => {
        const idx = STAGES.indexOf(block.status);
        return Math.round((idx / (STAGES.length - 1)) * 100);
    };

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
        return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
    };

    const filtered = useMemo(() => {
        let list = [...blocks];
        if (stageFilter !== 'ALL') list = list.filter(b => b.status === stageFilter);
        if (healthFilter !== 'ALL') list = list.filter(b => b.healthStatus === healthFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(b =>
                b.name.toLowerCase().includes(q) ||
                b.assignedEngineer?.displayName?.toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            let va, vb;
            switch (sortField) {
                case 'name': va = a.name; vb = b.name; break;
                case 'assignee': va = a.assignedEngineer?.displayName || ''; vb = b.assignedEngineer?.displayName || ''; break;
                case 'status': va = STAGES.indexOf(a.status); vb = STAGES.indexOf(b.status); break;
                case 'health': {
                    const ho = { CRITICAL: 0, RISK: 1, HEALTHY: 2 };
                    va = ho[a.healthStatus] ?? 3; vb = ho[b.healthStatus] ?? 3; break;
                }
                case 'progress': va = getProgress(a); vb = getProgress(b); break;
                case 'updated': va = new Date(a.updatedAt || 0); vb = new Date(b.updatedAt || 0); break;
                default: va = a.name; vb = b.name;
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }, [blocks, search, stageFilter, healthFilter, sortField, sortDir]);

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="av-container">
            <div className="av-header">
                <div>
                    <h2>Insights</h2>
                    <p>Quick overview of all blocks with key metrics</p>
                </div>
                <div className="av-controls">
                    <div className="av-search">
                        <Search size={14} className="av-search-icon" />
                        <input
                            placeholder="Search blocks..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="av-select" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
                        <option value="ALL">All Stages</option>
                        {STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <select className="av-select" value={healthFilter} onChange={e => setHealthFilter(e.target.value)}>
                        <option value="ALL">All Health</option>
                        <option value="HEALTHY">Healthy</option>
                        <option value="RISK">At Risk</option>
                        <option value="CRITICAL">Critical</option>
                    </select>
                </div>
            </div>

            <div className="insights-table-wrap">
                <table className="insights-table">
                    <thead>
                        <tr>
                            <th onClick={() => toggleSort('name')}>Block Name <SortIcon field="name" /></th>
                            <th onClick={() => toggleSort('assignee')}>Assignee <SortIcon field="assignee" /></th>
                            <th onClick={() => toggleSort('status')}>Stage <SortIcon field="status" /></th>
                            <th onClick={() => toggleSort('health')}>Health <SortIcon field="health" /></th>
                            <th onClick={() => toggleSort('progress')} style={{ width: 140 }}>Progress <SortIcon field="progress" /></th>
                            <th onClick={() => toggleSort('updated')}>Last Updated <SortIcon field="updated" /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>No blocks match your filters.</td></tr>
                        )}
                        {filtered.map(block => {
                            const progress = getProgress(block);
                            const initials = block.assignedEngineer?.displayName?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?';
                            return (
                                <tr key={block._id}>
                                    <td>
                                        <span className="insights-block-name" onClick={() => onSelectBlock?.(block)}>
                                            {block.name}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="insights-assignee">
                                            <div className="insights-avatar">{initials}</div>
                                            {block.assignedEngineer?.displayName || 'Unassigned'}
                                        </div>
                                    </td>
                                    <td>
                                        <select
                                            className="insights-inline-select"
                                            value={block.status}
                                            onChange={e => onUpdateStatus?.(block._id, e.target.value)}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {STAGES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className={`av-health-dot av-health-dot-${block.healthStatus}`} />
                                            <span style={{ fontSize: 12, fontWeight: 600 }}>{block.healthStatus}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="av-progress-bar" style={{ flex: 1 }}>
                                                <div className="av-progress-fill" style={{
                                                    width: `${progress}%`,
                                                    background: progress === 100 ? '#22c55e' : progress > 50 ? 'var(--accent)' : '#f59e0b'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 30 }}>{progress}%</span>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(block.updatedAt)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InsightsTab;
