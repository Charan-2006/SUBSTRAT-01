import React, { useState, useMemo } from 'react';
import './AdvancedViews.css';

const QUADRANTS = [
    { id: 'priority', label: 'Priority', emoji: '🔥', desc: 'High Impact · Low Effort', className: 'matrix-q-priority' },
    { id: 'strategic', label: 'Strategic', emoji: '🎯', desc: 'High Impact · High Effort', className: 'matrix-q-strategic' },
    { id: 'optional', label: 'Optional', emoji: '💡', desc: 'Low Impact · Low Effort', className: 'matrix-q-optional' },
    { id: 'avoid', label: 'Avoid', emoji: '⏸️', desc: 'Low Impact · High Effort', className: 'matrix-q-avoid' },
];

const HEALTH_COLORS = { HEALTHY: '#22c55e', RISK: '#f59e0b', CRITICAL: '#ef4444' };

const getDefaultQuadrant = (block) => {
    const effortMap = { SIMPLE: 1, MEDIUM: 2, COMPLEX: 3, CRITICAL: 4 };
    const effort = effortMap[block.complexity] || 2;
    const isActive = !['NOT_STARTED', 'COMPLETED'].includes(block.status);
    const isCritical = block.healthStatus === 'CRITICAL';

    if (isCritical || (isActive && effort <= 2)) return 'priority';
    if (isActive && effort > 2) return 'strategic';
    if (!isActive && effort <= 2) return 'optional';
    return 'avoid';
};

const PriorityMatrixTab = ({ blocks = [], onSelectBlock }) => {
    const [overrides, setOverrides] = useState({});
    const [dragOver, setDragOver] = useState(null);

    const quadrantBlocks = useMemo(() => {
        const result = { priority: [], strategic: [], optional: [], avoid: [] };
        blocks.forEach(block => {
            const q = overrides[block._id] || getDefaultQuadrant(block);
            if (result[q]) result[q].push(block);
        });
        return result;
    }, [blocks, overrides]);

    const handleDragStart = (e, blockId) => {
        e.dataTransfer.setData('text/plain', blockId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, quadrantId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(quadrantId);
    };

    const handleDragLeave = () => setDragOver(null);

    const handleDrop = (e, quadrantId) => {
        e.preventDefault();
        const blockId = e.dataTransfer.getData('text/plain');
        if (blockId) {
            setOverrides(prev => ({ ...prev, [blockId]: quadrantId }));
        }
        setDragOver(null);
    };

    return (
        <div className="av-container">
            <div className="av-header">
                <div>
                    <h2>Priority Matrix</h2>
                    <p>Impact vs Effort — drag blocks between quadrants to reprioritize</p>
                </div>
                <div className="av-controls">
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {blocks.length} blocks
                    </span>
                </div>
            </div>

            <div className="matrix-axis-labels">
                <span>← Low Effort</span>
                <span>High Effort →</span>
            </div>

            <div className="matrix-grid">
                {QUADRANTS.map(q => (
                    <div
                        key={q.id}
                        className={`matrix-quadrant ${q.className} ${dragOver === q.id ? 'drag-over' : ''}`}
                        onDragOver={e => handleDragOver(e, q.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, q.id)}
                    >
                        <div className="matrix-quadrant-label">
                            <span className="emoji">{q.emoji}</span>
                            {q.label}
                            <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                                {q.desc}
                            </span>
                        </div>

                        <div className="matrix-bubbles">
                            {quadrantBlocks[q.id].map(block => (
                                <div
                                    key={block._id}
                                    className="matrix-bubble"
                                    draggable
                                    onDragStart={e => handleDragStart(e, block._id)}
                                    onClick={() => onSelectBlock?.(block)}
                                    title={`${block.name} · ${block.status} · ${block.healthStatus}`}
                                >
                                    <span
                                        className="bubble-health"
                                        style={{ background: HEALTH_COLORS[block.healthStatus] || '#94a3b8' }}
                                    />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {block.name}
                                    </span>
                                </div>
                            ))}
                            {quadrantBlocks[q.id].length === 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: 8 }}>
                                    Drop blocks here
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PriorityMatrixTab;
