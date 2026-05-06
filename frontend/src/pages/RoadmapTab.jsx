import React, { useState, useMemo } from 'react';
import './AdvancedViews.css';

const COLUMNS = [
    { id: 'now', label: 'Now', color: '#2563eb' },
    { id: 'next', label: 'Next', color: '#8b5cf6' },
    { id: 'later', label: 'Later', color: '#f59e0b' },
    { id: 'backlog', label: 'Backlog', color: '#94a3b8' },
];

const getDefaultColumn = (block) => {
    if (['DRC', 'LVS', 'REVIEW'].includes(block.status)) return 'now';
    if (block.status === 'IN_PROGRESS') return 'now';
    if (block.status === 'COMPLETED') return 'backlog';
    if (block.healthStatus === 'CRITICAL') return 'next';
    if (block.complexity === 'SIMPLE' || block.complexity === 'MEDIUM') return 'next';
    return 'later';
};

const RoadmapTab = ({ blocks = [], onSelectBlock }) => {
    const [overrides, setOverrides] = useState({});
    const [dragOver, setDragOver] = useState(null);

    const columnBlocks = useMemo(() => {
        const result = { now: [], next: [], later: [], backlog: [] };
        blocks.forEach(block => {
            const col = overrides[block._id] || getDefaultColumn(block);
            if (result[col]) result[col].push(block);
        });
        return result;
    }, [blocks, overrides]);

    const handleDragStart = (e, blockId) => {
        e.dataTransfer.setData('text/plain', blockId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, colId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(colId);
    };

    const handleDragLeave = () => setDragOver(null);

    const handleDrop = (e, colId) => {
        e.preventDefault();
        const blockId = e.dataTransfer.getData('text/plain');
        if (blockId) {
            setOverrides(prev => ({ ...prev, [blockId]: colId }));
        }
        setDragOver(null);
    };

    return (
        <div className="av-container">
            <div className="av-header">
                <div>
                    <h2>Roadmap</h2>
                    <p>What is happening Now, Next, and Later — drag to reprioritize</p>
                </div>
            </div>

            <div className="roadmap-columns">
                {COLUMNS.map(col => (
                    <div
                        key={col.id}
                        className={`roadmap-column ${dragOver === col.id ? 'drag-over' : ''}`}
                        onDragOver={e => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, col.id)}
                    >
                        <div className="roadmap-column-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                                <span className="roadmap-column-title">{col.label}</span>
                            </div>
                            <span className="roadmap-column-count">{columnBlocks[col.id].length}</span>
                        </div>

                        <div className="roadmap-column-body">
                            {columnBlocks[col.id].map(block => (
                                <div
                                    key={block._id}
                                    className="roadmap-card"
                                    draggable
                                    onDragStart={e => handleDragStart(e, block._id)}
                                    onClick={() => onSelectBlock?.(block)}
                                >
                                    <div className="roadmap-card-title">{block.name}</div>
                                    <div className="roadmap-card-meta">
                                        <span className={`av-badge av-badge-${block.status}`}>
                                            {block.status.replace('_', ' ')}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className={`av-health-dot av-health-dot-${block.healthStatus}`} />
                                        </span>
                                        <span className="roadmap-card-assignee">
                                            {block.assignedEngineer?.displayName?.split(' ')[0] || 'Unassigned'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {columnBlocks[col.id].length === 0 && (
                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>
                                    No blocks — drag items here
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RoadmapTab;
