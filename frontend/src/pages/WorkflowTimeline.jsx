import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { 
    Search, User as UserIcon, Calendar, Filter, ChevronRight, 
    X, ArrowRight, CheckCircle2, AlertTriangle, Clock, Play,
    MessageSquare, Layers, Info, Film
} from 'lucide-react';
import './WorkflowTimeline.css';
import SmartReplay from '../components/SmartReplay';

// Hex to RGBA helper for soft backgrounds
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const STAGE_COLORS = {
    'NOT_STARTED': '#94a3b8',
    'IN_PROGRESS': '#2563eb',
    'DRC': '#f59e0b',
    'LVS': '#eab308',
    'REVIEW': '#8b5cf6',
    'COMPLETED': '#22c55e'
};

const WorkflowTimeline = ({ blocks = [], onUpdateStatus }) => {
    const [zoomLevel, setZoomLevel] = useState('DAYS'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [replayBlock, setReplayBlock] = useState(null);
    const [healthFilter, setHealthFilter] = useState('ALL');

    const containerRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- Timeline Range Configuration (Single Source of Truth) ---
    const { startDate, totalDays, dayWidth, todayOffset, gridWidth } = useMemo(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 30);
        start.setHours(0, 0, 0, 0);

        const end = new Date(today);
        end.setDate(today.getDate() + 90);
        end.setHours(0, 0, 0, 0);

        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        const tOffset = Math.max(0, (today - start) / (1000 * 60 * 60 * 24));

        let width = 40; // 1 day = 40px
        if (zoomLevel === 'WEEKS') width = 80 / 7; // ~11.4px
        if (zoomLevel === 'MONTHS') width = 4; // 4px

        return { 
            startDate: start, 
            totalDays: diffDays, 
            dayWidth: width, 
            todayOffset: tOffset,
            gridWidth: diffDays * width 
        };
    }, [zoomLevel]);

    const getX = useCallback((date) => {
        if (!date) return 0;
        const diffDays = (new Date(date) - startDate) / (1000 * 60 * 60 * 24);
        return Math.max(0, diffDays * dayWidth);
    }, [startDate, dayWidth]);

    const getW = useCallback((start, end) => {
        const s = new Date(start);
        const e = end ? new Date(end) : new Date();
        const diffDays = Math.max(0, (e - s) / (1000 * 60 * 60 * 24));
        return diffDays * dayWidth;
    }, [dayWidth]);

    // --- Header Generation (Grouping Logic) ---
    const { months, columns } = useMemo(() => {
        const mths = [];
        const cols = [];

        let currMonthStr = null;
        let currMonthDays = 0;

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);

            // Month logic
            const mStr = d.toLocaleDateString([], { month: 'short', year: 'numeric' });
            if (mStr !== currMonthStr) {
                if (currMonthStr) mths.push({ label: currMonthStr, width: currMonthDays * dayWidth });
                currMonthStr = mStr;
                currMonthDays = 1;
            } else {
                currMonthDays++;
            }
        }
        if (currMonthStr) mths.push({ label: currMonthStr, width: currMonthDays * dayWidth });

        // Columns logic
        if (zoomLevel === 'DAYS') {
            for (let i = 0; i < totalDays; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                cols.push({ label: d.getDate(), width: dayWidth });
            }
        } else if (zoomLevel === 'WEEKS') {
            let wDays = 0;
            let wLabel = '';
            for (let i = 0; i < totalDays; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                if (d.getDay() === 1 || wDays === 0) {
                    if (wDays > 0) cols.push({ label: wLabel, width: wDays * dayWidth });
                    wLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    wDays = 1;
                } else {
                    wDays++;
                }
            }
            if (wDays > 0) cols.push({ label: wLabel, width: wDays * dayWidth });
        }

        return { months: mths, columns: cols };
    }, [startDate, totalDays, dayWidth, zoomLevel]);

    // --- Filtering ---
    const filteredBlocks = useMemo(() => {
        return blocks.filter(b => {
            if (healthFilter !== 'ALL' && b.healthStatus !== healthFilter) return false;
            if (debouncedSearch) {
                const term = debouncedSearch.toLowerCase();
                return b.name.toLowerCase().includes(term) || 
                       b.assignedEngineer?.displayName?.toLowerCase().includes(term);
            }
            return true;
        });
    }, [blocks, debouncedSearch, healthFilter]);

    useEffect(() => {
        if (containerRef.current) {
            // Scroll to today offset, factoring in the left sticky panel (260px)
            containerRef.current.scrollLeft = (todayOffset * dayWidth) - 200;
        }
    }, [zoomLevel, todayOffset, dayWidth]);

    // --- Sidebar Panel ---
    const InsightPanel = ({ block }) => {
        if (!block) return null;
        const totalDuration = block.stageHistory?.reduce((acc, h) => acc + (h.durationHours || 0), 0) || 0;
        const activeDuration = block.stageStartTime ? (new Date() - new Date(block.stageStartTime)) / (1000 * 60 * 60) : 0;
        const grandTotal = totalDuration + activeDuration;
        const stages = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
        const currentIdx = stages.indexOf(block.status);

        return (
            <div className="timeline-insight-panel">
                <div className="insight-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{block.name}</h2>
                            <button 
                                className="btn btn-sm" 
                                style={{ marginTop: 8, background: 'var(--accent-subtle)', color: 'var(--accent)', border: 'none' }}
                                onClick={() => setReplayBlock(block)}
                            >
                                <Film size={12} style={{ marginRight: 4 }} /> Smart Replay
                            </button>
                        </div>
                        <button className="nav-icon-btn" onClick={() => setSelectedBlock(null)}><X size={18} /></button>
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Workflow Progress</div>
                        <div style={{ display: 'flex', height: 8, borderRadius: 4, background: 'var(--bg)', overflow: 'hidden', marginTop: 12 }}>
                            {stages.map((s, i) => (
                                <div key={s} style={{ 
                                    flex: 1, 
                                    background: i <= currentIdx ? STAGE_COLORS[s] : 'transparent',
                                    borderRight: '1px solid var(--surface)'
                                }} />
                            ))}
                        </div>
                    </div>

                    <div className="sidebar-section" style={{ marginTop: 24 }}>
                        <div className="sidebar-section-title">Block Details</div>
                        <div className="detail-row" style={{ marginTop: 12 }}>
                            <span className="detail-label">Assignee</span>
                            <span className="detail-value">{block.assignedEngineer?.displayName || 'Unassigned'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Status</span>
                            <span className="status-badge" style={{ 
                                background: hexToRgba(STAGE_COLORS[block.status], 0.15), 
                                color: STAGE_COLORS[block.status] 
                            }}>
                                {block.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Total Time</span>
                            <span className="detail-value">{grandTotal.toFixed(1)}h</span>
                        </div>
                    </div>

                    <div className="sidebar-section" style={{ marginTop: 24 }}>
                        <div className="sidebar-section-title">Actions</div>
                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
                            onClick={() => onUpdateStatus && onUpdateStatus(block._id, stages[currentIdx + 1] || block.status)}
                        >
                            Move to Next Stage <ArrowRight size={16} style={{ marginLeft: 8 }} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="workflow-timeline-wrapper">
            {/* Top Control Bar */}
            <div className="timeline-top-controls">
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ position: 'relative', width: 320 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input 
                            type="text" 
                            placeholder="Search blocks, engineers..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--surface)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <Filter size={14} color="var(--text-tertiary)" />
                        <select 
                            style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, outline: 'none', color: 'var(--text-secondary)' }}
                            value={healthFilter}
                            onChange={(e) => setHealthFilter(e.target.value)}
                        >
                            <option value="ALL">All Health</option>
                            <option value="HEALTHY">Healthy</option>
                            <option value="RISK">At Risk</option>
                            <option value="CRITICAL">Critical</option>
                        </select>
                    </div>
                </div>

                <div className="segmented-control">
                    {['DAYS', 'WEEKS', 'MONTHS'].map(lvl => (
                        <button 
                            key={lvl}
                            className={`segment-btn ${zoomLevel === lvl ? 'active' : ''}`}
                            onClick={() => setZoomLevel(lvl)}
                        >
                            {lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Gantt Area */}
            <div className="timeline-gantt-container" ref={containerRef}>
                <div className="gantt-scroll-content">
                    
                    {/* Header Row */}
                    <div className="timeline-header-row">
                        <div className="left-panel-cell">Blocks & Assignees</div>
                        <div className="timeline-grid-cell" style={{ width: gridWidth }}>
                            <div className="timeline-grid-header-content">
                                <div className="header-months-row">
                                    {months.map((m, i) => (
                                        <div key={i} className="header-month-block" style={{ width: m.width }}>{m.label}</div>
                                    ))}
                                </div>
                                {columns.length > 0 && (
                                    <div className="header-days-row">
                                        {columns.map((c, i) => (
                                            <div key={i} className="header-day-block" style={{ width: c.width }}>{c.label}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Block Rows */}
                    {filteredBlocks.map(block => (
                        <div key={block._id} className="timeline-row">
                            <div className="left-panel-cell" onClick={() => setSelectedBlock(block)} style={{ cursor: 'pointer' }}>
                                <div>
                                    <div className="block-name">{block.name}</div>
                                    <div className="block-assignee">{block.assignedEngineer?.displayName || 'Unassigned'}</div>
                                </div>
                                <span className="status-badge" style={{ 
                                    background: hexToRgba(STAGE_COLORS[block.status], 0.15), 
                                    color: STAGE_COLORS[block.status] 
                                }}>
                                    {block.status.split('_')[0]}
                                </span>
                            </div>
                            
                            <div className="timeline-grid-cell" style={{ width: gridWidth }} onClick={() => setSelectedBlock(block)}>
                                {block.stageHistory?.map((hist, idx) => {
                                    const color = STAGE_COLORS[hist.stage] || STAGE_COLORS.NOT_STARTED;
                                    return (
                                        <div 
                                            key={idx}
                                            className="task-bar"
                                            style={{
                                                left: getX(hist.startTime),
                                                width: getW(hist.startTime, hist.endTime),
                                                background: hexToRgba(color, 0.15),
                                                border: `1px solid ${color}`,
                                                color: color
                                            }}
                                            title={`${hist.stage}: ${hist.durationHours?.toFixed(1)}h`}
                                        />
                                    );
                                })}
                                {block.status !== 'NOT_STARTED' && block.status !== 'COMPLETED' && (
                                    <div 
                                        className={`task-bar ${block.healthStatus !== 'HEALTHY' ? 'critical-segment' : ''}`}
                                        style={{
                                            left: getX(block.stageStartTime || block.updatedAt),
                                            width: getW(block.stageStartTime || block.updatedAt, null),
                                            background: hexToRgba(STAGE_COLORS[block.status], 0.15),
                                            border: `1px solid ${STAGE_COLORS[block.status]}`,
                                            color: STAGE_COLORS[block.status]
                                        }}
                                        title={`Current: ${block.status}`}
                                    />
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Global Overlays */}
                    <div className="global-grid-overlays" style={{ left: 260, width: gridWidth }}>
                        {columns.map((c, i) => (
                            <div key={i} className="grid-line-vertical" style={{ left: columns.slice(0, i).reduce((a, b) => a + b.width, 0) }} />
                        ))}
                        <div className="today-line" style={{ left: todayOffset * dayWidth }} />
                    </div>

                </div>
            </div>

            {/* Sidebar */}
            {selectedBlock && <InsightPanel block={selectedBlock} />}

            {/* Smart Replay Overlay */}
            {replayBlock && <SmartReplay block={replayBlock} onClose={() => setReplayBlock(null)} />}
        </div>
    );
};

export default WorkflowTimeline;
