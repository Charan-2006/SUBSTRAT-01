import React from 'react';
import { ChevronDown, ChevronRight, Link2, AlertTriangle, UserPlus, CheckCircle, XCircle, Search, ArrowRight } from 'lucide-react';
import { STAGES, STAGE_COLORS, HEALTH_STATES } from '../../constants/workflowStates';
import { 
    calculateHealth, calculateDependencyImpact, calculateSLA, calculateProgress,
    formatDuration, calculateBlockedState,
    generateRecommendedAction, calculateBottleneck, calculateEngineerLoad
} from '../../utils/workflowEngine';

const AssignPopover = ({ block, engineers, allBlocks, onAssign, onClose }) => {
    const [search, setSearch] = React.useState('');
    const filtered = engineers.filter(e => e.displayName.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="assign-popover side" onClick={e => e.stopPropagation()}>
            <div className="popover-header">
                <span>Assign Engineer</span>
                <button className="popover-close" onClick={onClose}><XCircle size={14} /></button>
            </div>
            
            <div className="popover-search-wrap">
                <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
                <input 
                    autoFocus
                    placeholder="Search engineers..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="popover-list">
                {block.assignedEngineer && (
                    <button 
                        className="engineer-item unassign" 
                        style={{ borderBottom: '1px solid var(--border)', borderRadius: 0, marginBottom: 8, color: 'var(--red)' }}
                        onClick={() => { onAssign(block._id, null); onClose(); }}
                    >
                        <XCircle size={14} />
                        <span style={{ fontWeight: 700 }}>Remove Assignment</span>
                    </button>
                )}
                {filtered.map(eng => {
                    const load = calculateEngineerLoad(eng._id, allBlocks);
                    const overCapacity = load.activeCount >= 5;
                    const initials = eng.displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

                    return (
                        <button 
                            key={eng._id} 
                            className="engineer-item"
                            disabled={overCapacity}
                            onClick={() => { onAssign(block._id, eng._id); onClose(); }}
                        >
                            <div className="engineer-avatar">{initials}</div>
                            <div className="engineer-info">
                                <span className="engineer-name">{eng.displayName}</span>
                                <div className="engineer-load">
                                    <span className="load-dot" style={{ background: overCapacity ? 'var(--red)' : 'var(--green)' }} />
                                    {load.activeCount} active • {load.criticalCount} critical
                                    {overCapacity && <span style={{ color: 'var(--red)', fontWeight: 700, marginLeft: 4 }}>(Over)</span>}
                                </div>
                            </div>
                            <div className="engineer-assign-icon">
                                <ArrowRight size={14} />
                            </div>
                        </button>
                    )
                })}
                {filtered.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 8px' }}>
                        No engineers found
                    </div>
                )}
            </div>
        </div>
    );
};

const HEALTH_STYLES = {
    [HEALTH_STATES.HEALTHY]: { dot: 'var(--green)', label: 'Healthy', class: '' },
    [HEALTH_STATES.WARNING]: { dot: 'var(--amber)', label: 'Warning', class: 'health-warning' },
    [HEALTH_STATES.CRITICAL]: { dot: 'var(--red)', label: 'Critical', class: 'health-critical' },
    [HEALTH_STATES.BOTTLENECK]: { dot: 'var(--red)', label: 'Bottleneck', class: 'health-bottleneck' },
};

// --- Expanded Preview ---
const ExpandedPreview = ({ block }) => {
    const { upstream = [], downstream = [], slaTargetHours, elapsedHours, delayHours, activityLog = [] } = block;

    return (
        <div className="ws-expanded-content">
            {/* A. SLA Analysis */}
            <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>A. SLA Analysis</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Expected Duration: <strong>{formatDuration(slaTargetHours)}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Actual Time: <strong>{formatDuration(elapsedHours)}</strong>
                </div>
                <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: delayHours > 0 ? 'var(--red)' : 'var(--green)' }}>
                    Delay: {delayHours > 0 ? `+${formatDuration(delayHours)}` : 'None'}
                </div>
            </div>

            {/* B. Dependency Impact */}
            <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>B. Dependency Impact</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Upstream Blockers: {upstream.length > 0 ? upstream.map(d => d.name).join(', ') : 'None'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Downstream Affected: {downstream.length > 0 ? downstream.map(d => d.name).join(', ') : 'None'}
                </div>
            </div>

            {/* C. Execution Event Log */}
            <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>C. Orchestration Events</div>
                {activityLog && activityLog.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {activityLog.slice(0, 3).map(log => (
                            <div key={log.id} style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{log.action}</span> • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No recent events</div>
                )}
            </div>

            {/* D. Metadata */}
            <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>D. Node Intelligence</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Confidence Score: <strong>{block.confidenceScore}%</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Propagation Risk: <strong>{(block.propagationRisk * 100).toFixed(0)}%</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Pressure Index: <strong>{block.pressureScore}/100</strong>
                </div>
            </div>
        </div>
    );
};

// --- Main Table ---
const WorkflowTable = ({
    blocks = [],
    allBlocks = [],
    selectedIds = [],
    onToggleSelect,
    onSelectAll,
    expandedId,
    onToggleExpand,
    onOpenDrawer,
    onAssign,
    onReview,
    onEscalate,
    engineers = [],
    sortField,
    sortOrder,
    onSort,
}) => {
    const [assignPopoverId, setAssignPopoverId] = React.useState(null);
    const renderSortHeader = (field, label, width) => (
        <th className="sortable" style={{ width }} onClick={() => onSort(field)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {label}
                {sortField === field && <span style={{ fontSize: 8 }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
            </span>
        </th>
    );

    const allSelected = blocks.length > 0 && selectedIds.length === blocks.length;

    if (blocks.length === 0) {
        return (
            <div className="ws-table-wrap">
                <div className="ws-empty">
                    <div className="ws-empty-title">No workflows active</div>
                </div>
            </div>
        );
    }

    return (
        <div className="ws-table-wrap">
            <div className="ws-table-scroll">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th style={{ width: 32, paddingLeft: 12 }}>
                                <input type="checkbox" checked={allSelected} onChange={onSelectAll} style={{ cursor: 'pointer' }} />
                            </th>
                            <th style={{ width: 24 }} />
                            {renderSortHeader('name', 'Block', 220)}
                            {renderSortHeader('type', 'Type', 110)}
                            {renderSortHeader('techNode', 'Node', 80)}
                            {renderSortHeader('status', 'Stage', 90)}

                            {renderSortHeader('health', 'Health', 80)}
                            <th style={{ width: 180 }}>Dependency</th>
                            <th style={{ width: 100 }}>Progress</th>
                            <th style={{ width: 140 }}>Assignee</th>
                            <th style={{ width: 100 }}>Est. Effort</th>
                            <th style={{ width: 100 }}>Actual</th>
                            <th style={{ width: 100 }}>Variance</th>

                            <th style={{ width: 130, textAlign: 'right', paddingRight: 12 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {blocks.map(block => {
                            const isSelected = selectedIds.includes(block._id);
                            const isExpanded = expandedId === block._id;
                            
                            const { health, progress, slaTargetHours, elapsedHours, delayHours, upstream = [], downstream = [], isBottleneck, isBlocked, healthLabel, telemetry, inheritedRisk } = block || {};
                            const healthStyle = HEALTH_STYLES[health] || HEALTH_STYLES[HEALTH_STATES.HEALTHY];
                            
                            let depLabel = <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
                            if (upstream.length > 0 || downstream.length > 0 || inheritedRisk > 0) {
                                depLabel = (
                                    <div style={{ fontSize: 10, lineHeight: 1.2 }}>
                                        {inheritedRisk > 0 ? (
                                            <div style={{ color: 'var(--red)', fontWeight: 700 }}>
                                                Inherited Risk: {Math.round(inheritedRisk * 100)}%
                                            </div>
                                        ) : (
                                            upstream.length > 0 && <div style={{ color: 'var(--text-tertiary)' }}>{upstream.length} Dependencies</div>
                                        )}
                                        {downstream.length > 0 && (
                                            <div style={{ color: 'var(--accent)', fontWeight: 600, marginTop: 1 }}>Blocks {downstream.length} node(s)</div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <React.Fragment key={block._id}>
                                    <tr
                                        className={`${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded-parent' : ''} ${healthStyle.class} ${block.isEscalated ? 'escalated-row' : ''}`}
                                        onClick={() => onOpenDrawer?.(block)}
                                        style={{ zIndex: assignPopoverId === block._id ? 100 : 1, position: 'relative' }}
                                    >
                                        <td style={{ paddingLeft: 12 }} onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(block._id)} style={{ cursor: 'pointer' }} />
                                        </td>

                                        <td onClick={e => { e.stopPropagation(); onToggleExpand(block._id); }} style={{ cursor: 'pointer', padding: '8px 2px' }}>
                                            {isExpanded
                                                ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                                                : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                                            }
                                        </td>

                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>{block.name}</div>
                                                {block.isEscalated && (
                                                    <span className="priority-badge escalated">
                                                        ESCALATED
                                                    </span>
                                                )}
                                                {isBottleneck && (
                                                    <span className="priority-badge bottleneck">
                                                        BOTTLENECK
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{block.type || 'Standard'}</div>
                                        </td>
                                        
                                        <td>
                                            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)' }}>{block.techNode || 'N/A'}</div>
                                        </td>

                                        <td>
                                            <span className={`status-badge status-${block.status}`} style={{ fontSize: 9.5, padding: '3px 8px' }}>
                                                {block.status.replace('_', ' ')}
                                            </span>
                                        </td>

                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: healthStyle.dot, flexShrink: 0 }} />
                                                <span style={{ fontSize: 10.5, fontWeight: 700, color: healthStyle.dot }}>{healthStyle.label}</span>
                                            </div>
                                        </td>

                                        <td style={{ fontSize: 10.5 }}>{depLabel}</td>

                                        <td>
                                            <div className="ws-pipeline" style={{ display: 'flex', gap: 2, height: 6, width: '100%', background: 'var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                                                {['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'].map((s, i) => {
                                                    const order = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
                                                    const currIdx = order.indexOf(block.status);
                                                    const isDone = i <= currIdx;
                                                    const isCurrent = i === currIdx;
                                                    const color = s === 'COMPLETED' ? 'var(--green)' : s === 'REVIEW' ? 'var(--purple)' : s === 'DRC' || s === 'LVS' ? 'var(--amber)' : 'var(--accent)';
                                                    
                                                    return (
                                                        <div 
                                                            key={s} 
                                                            style={{ 
                                                                flex: 1, 
                                                                background: isDone ? color : 'transparent',
                                                                opacity: isCurrent ? 0.6 : 1,
                                                                boxShadow: isCurrent ? 'inset 0 0 0 1px rgba(255,255,255,0.3)' : 'none'
                                                            }} 
                                                            title={s.replace('_', ' ')}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </td>

                                        <td>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: block.assignedEngineer ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                                {block.assignedEngineer?.displayName || 'Unassigned'}
                                            </span>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{block.estimatedHours || 0}h</div>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{(block.totalTimeSpent || 0).toFixed(1)}h</div>
                                        </td>

                                        <td>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: block.variance > 0 ? 'var(--red)' : 'var(--green)' }}>
                                                {block.variance > 0 ? `+${block.variance.toFixed(1)}h` : `${block.variance.toFixed(1)}h`}
                                            </div>
                                        </td>

                                        <td style={{ textAlign: 'right', paddingRight: 12, position: 'relative' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', position: 'relative' }}>
                                                {block.status !== STAGES.COMPLETED && (
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-sm" style={{ padding: '4px 8px', fontSize: 10, gap: 4 }} onClick={() => setAssignPopoverId(assignPopoverId === block._id ? null : block._id)}>
                                                            <UserPlus size={10} /> {block.assignedEngineer ? 'Reassign' : 'Assign'}
                                                        </button>
                                                        {assignPopoverId === block._id && (
                                                            <AssignPopover block={block} engineers={engineers} allBlocks={allBlocks} onAssign={onAssign} onClose={() => setAssignPopoverId(null)} />
                                                        )}
                                                    </div>
                                                )}

                                                {block.status !== STAGES.COMPLETED && block.status !== STAGES.NOT_STARTED && !block.isEscalated && (
                                                    <button 
                                                        className="btn btn-sm" 
                                                        style={{ padding: '4px 8px', fontSize: 10, color: 'var(--amber)' }} 
                                                        onClick={(e) => { e.stopPropagation(); onEscalate?.(block._id); }}
                                                    >
                                                        Escalate
                                                    </button>
                                                )}

                                                {block.status === STAGES.REVIEW && (
                                                    <>
                                                        <button className="btn btn-sm btn-primary" style={{ padding: '4px 6px' }} onClick={(e) => { e.stopPropagation(); onReview?.(block._id, 'APPROVE'); }} title="Approve">
                                                            <CheckCircle size={12} />
                                                        </button>
                                                        <button className="btn btn-sm" style={{ padding: '4px 6px', color: 'var(--red)' }} onClick={(e) => { e.stopPropagation(); onOpenDrawer?.(block, true); }} title="Reject">
                                                            <XCircle size={12} />
                                                        </button>
                                                    </>
                                                )}
                                                
                                                <button className="btn btn-sm" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => onOpenDrawer?.(block)}>
                                                    Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Panel */}
                                    {isExpanded && (
                                        <tr className="ws-expanded-row">
                                            <td colSpan="12" style={{ padding: 0 }}>
                                                <ExpandedPreview block={block} allBlocks={allBlocks} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WorkflowTable;
