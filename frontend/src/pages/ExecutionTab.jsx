import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import './AdvancedViews.css';

const STAGE_ORDER = ['IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
const STAGE_COLORS = {
    IN_PROGRESS: '#2563eb',
    DRC: '#f59e0b',
    LVS: '#eab308',
    REVIEW: '#8b5cf6',
    COMPLETED: '#22c55e',
};
const STAGE_LABELS = {
    IN_PROGRESS: 'In Progress',
    DRC: 'DRC',
    LVS: 'LVS',
    REVIEW: 'Review',
    COMPLETED: 'Completed',
};

const ExecutionTab = ({ blocks = [], onSelectBlock }) => {
    const [collapsed, setCollapsed] = useState({});

    const toggleSection = (stage) => {
        setCollapsed(prev => ({ ...prev, [stage]: !prev[stage] }));
    };

    const grouped = useMemo(() => {
        const result = {};
        STAGE_ORDER.forEach(s => { result[s] = []; });
        blocks.forEach(block => {
            if (result[block.status]) {
                result[block.status].push(block);
            }
        });
        return result;
    }, [blocks]);

    const getProgress = (block) => {
        const idx = STAGE_ORDER.indexOf(block.status);
        if (idx === -1) return 0;
        return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
    };

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getExpectedFinish = (block) => {
        if (!block.stageStartTime || !block.estimatedHours) return '—';
        const start = new Date(block.stageStartTime);
        const finish = new Date(start.getTime() + block.estimatedHours * 60 * 60 * 1000);
        return formatDate(finish);
    };

    return (
        <div className="av-container">
            <div className="av-header">
                <div>
                    <h2>Execution</h2>
                    <p>Active work grouped by workflow stage</p>
                </div>
                <div className="av-controls">
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {blocks.filter(b => !['NOT_STARTED', 'COMPLETED'].includes(b.status)).length} in-flight
                    </span>
                </div>
            </div>

            {STAGE_ORDER.map(stage => {
                const stageBlocks = grouped[stage] || [];
                if (stageBlocks.length === 0 && stage !== 'COMPLETED') return null;
                const isOpen = !collapsed[stage];

                return (
                    <div key={stage} className="execution-section">
                        <div className="execution-section-header" onClick={() => toggleSection(stage)}>
                            <div
                                className="execution-section-dot"
                                style={{ background: STAGE_COLORS[stage] }}
                            />
                            <span className="execution-section-title">
                                {STAGE_LABELS[stage]}
                            </span>
                            <span className="execution-section-count">
                                {stageBlocks.length}
                            </span>
                            <ChevronRight
                                size={16}
                                className={`execution-section-chevron ${isOpen ? 'open' : ''}`}
                            />
                        </div>

                        {isOpen && stageBlocks.length > 0 && (
                            <div className="execution-table-wrap">
                                <table className="execution-table">
                                    <thead>
                                        <tr>
                                            <th>Block</th>
                                            <th>Next Step</th>
                                            <th>Health</th>
                                            <th>Started</th>
                                            <th>Est. Finish</th>
                                            <th style={{ width: 140 }}>Progress</th>
                                            <th style={{ width: 100, textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stageBlocks.map(block => {
                                            const progress = getProgress(block);
                                            const getActionHint = (status) => {
                                                const hints = {
                                                    'IN_PROGRESS': 'Finalize Layout',
                                                    'DRC': 'Clear Violations',
                                                    'LVS': 'Resolve Netlist',
                                                    'REVIEW': 'Submit Changes',
                                                    'COMPLETED': 'No action'
                                                };
                                                return hints[status] || 'Proceed';
                                            };
                                            return (
                                                <tr
                                                    key={block._id}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => onSelectBlock?.(block)}
                                                >
                                                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                                        {block.name}
                                                    </td>
                                                    <td style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                        {getActionHint(block.status)}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <span className={`av-health-dot av-health-dot-${block.healthStatus}`} />
                                                            <span style={{ fontSize: 11, fontWeight: 600 }}>
                                                                {block.healthStatus}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                        {formatDate(block.stageStartTime)}
                                                    </td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                        {getExpectedFinish(block)}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div className="av-progress-bar" style={{ flex: 1 }}>
                                                                <div
                                                                    className="av-progress-fill"
                                                                    style={{
                                                                        width: `${progress}%`,
                                                                        background: STAGE_COLORS[stage]
                                                                    }}
                                                                />
                                                            </div>
                                                            <span style={{
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                color: 'var(--text-tertiary)',
                                                                minWidth: 30
                                                            }}>
                                                                {progress}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); onSelectBlock?.(block); }}>Continue</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {isOpen && stageBlocks.length === 0 && (
                            <div className="execution-table-wrap" style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                                No blocks in this stage.
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ExecutionTab;
