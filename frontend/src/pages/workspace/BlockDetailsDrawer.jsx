import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Clock, AlertTriangle, Link2, ArrowRight, Zap, Shield, TrendingUp, 
    History, Activity, ChevronRight, Edit3, UserPlus, ZapOff, CheckCircle2,
    BarChart3, Layers, Settings, MessageSquare, Info
} from 'lucide-react';
import api from '../../api/axios';
import { 
    calculateSLA, calculateDependencyImpact, calculateHealth, calculateProgress,
    generateRecommendedAction, formatDuration, calculateBlockedState,
    calculateVelocity, calculateEfficiency
} from '../../utils/workflowEngine';
import { STAGES, HEALTH_STATES, BLOCK_TYPES, TECH_NODES, COMPLEXITY_LEVELS } from '../../constants/workflowStates';
import { useOrchestration } from '../../context/OrchestrationContext';

const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

const SectionHeader = ({ icon: Icon, title }) => (
    <div className="drawer-section-header">
        <Icon size={14} className="section-icon" />
        <span className="section-title">{title}</span>
    </div>
);

const BlockDetailsDrawer = ({ block, allBlocks = [], onClose, onReview, onEscalate, onAssign, isManager, startWithRejection = false, startInEditMode = false }) => {
    const { onUpdateBlock, engineers, fetchBlocks } = useOrchestration();
    const [isEditing, setIsEditing] = useState(startInEditMode);
    const [editData, setEditData] = useState({});

    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [rejectionActive, setRejectionActive] = useState(startWithRejection);
    const [rejectionReason, setRejectionReason] = useState('');

    // Sync edit mode if prop changes
    useEffect(() => {
        if (startInEditMode) setIsEditing(true);
    }, [startInEditMode]);

    useEffect(() => {
        if (!block?._id) return;
        setLogsLoading(true);
        api.get(`/blocks/${block._id}/logs?limit=50`)
            .then(res => setLogs(res.data.data || []))
            .catch(() => setLogs([]))
            .finally(() => setLogsLoading(false));
        
        setEditData({
            name: block.name,
            type: block.type,
            techNode: block.techNode,
            complexity: block.complexity,
            baseHours: block.baseHours || 0,
            estimatedHours: block.estimatedHours || 0,
            estimatedArea: block.estimatedArea || 0,
            priority: block.priority || 5,
            description: block.description || '',
            dependencies: (block.dependencies || []).map(d => d._id || d),
            assignedEngineer: block.assignedEngineer?._id || block.assignedEngineer || ''
        });
    }, [block?._id, block]);

    const { upstream, downstream } = useMemo(() => 
        calculateDependencyImpact(block, allBlocks),
        [block, allBlocks]
    );

    if (!block) return null;

    const sla = calculateSLA(block);
    const health = calculateHealth(block, allBlocks);
    const progress = calculateProgress(block);
    const isBlocked = calculateBlockedState(block, allBlocks);
    const velocity = calculateVelocity(block);
    const efficiency = calculateEfficiency(block);
    const rec = generateRecommendedAction(block, allBlocks);

    const getHealthColor = (h) => {
        switch(h) {
            case 'BOTTLENECK': return 'var(--amber)';
            case 'CRITICAL': return 'var(--red)';
            case 'HEALTHY': return 'var(--green)';
            default: return 'var(--text-tertiary)';
        }
    };

    // Group logs by action type for structured view
    const groupedLogs = useMemo(() => {
        const groups = {
            ASSIGNMENT: [],
            WORKFLOW: [],
            METADATA: [],
            SYSTEM: []
        };

        logs.forEach(log => {
            const action = log.action?.toUpperCase();
            if (action?.includes('ASSIGN') || action?.includes('UNASSIGN')) {
                groups.ASSIGNMENT.push(log);
            } else if (action?.includes('STATUS') || action?.includes('REVIEW') || action?.includes('APPROVE') || action?.includes('REJECT') || action?.includes('ESCALATE')) {
                groups.WORKFLOW.push(log);
            } else if (action?.includes('METADATA') || action?.includes('UPDATE') || action?.includes('EDIT')) {
                groups.METADATA.push(log);
            } else {
                groups.SYSTEM.push(log);
            }
        });

        return groups;
    }, [logs]);

    const renderActivityGroup = (title, logs) => {
        if (!logs || logs.length === 0) return null;
        return (
            <div className="activity-group">
                <div className="activity-group-title">{title}</div>
                <div className="activity-group-list">
                    {logs.map((log) => (
                        <div key={log._id} className="activity-item-compact">
                            <div className="activity-dot" />
                            <div className="activity-main">
                                <div className="activity-content">
                                    <span className="activity-action">{log.message || log.action?.replace(/_/g, ' ')}</span>
                                    <span className="activity-actor">by {log.userId?.displayName || 'System'}</span>
                                </div>
                                <div className="activity-time">
                                    {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="ws-drawer-overlay" onClick={onClose} />
            <div className={`ws-drawer-refined ${isEditing ? 'editing-mode' : ''}`}>
                
                {/* 1. STICKY HEADER */}
                <div className="drawer-sticky-header">
                    <div className="header-identity">
                        <div className="identity-top">
                            <span className="type-tag">{block.type || 'LAYOUT BLOCK'}</span>
                            <span className="node-tag">{block.techNode || '7NM'}</span>
                            <span className="complexity-tag">{block.complexity}</span>
                        </div>
                        <h2 className="block-name-display">{block.name}</h2>
                        <div className="identity-status-bar">
                            <div className={`status-badge-pill status-${block.status}`}>
                                {block.status.replace(/_/g, ' ')}
                            </div>
                            <div className="health-indicator">
                                <span className="health-dot" style={{ background: getHealthColor(health) }} />
                                <span className="health-label" style={{ color: getHealthColor(health) }}>{health}</span>
                            </div>
                            {block.assignedEngineer && (
                                <div className="assignee-pill">
                                    <div className="avatar-small">{block.assignedEngineer.displayName.charAt(0)}</div>
                                    <span>{block.assignedEngineer.displayName}</span>
                                </div>
                            )}
                            {block.isEscalated && <span className="escalated-badge">ESCALATED</span>}
                        </div>
                    </div>
                    
                    <div className="header-actions">
                        {!isEditing && (
                            <div className="action-button-group">
                                <button className="action-btn-refined" onClick={() => setIsEditing(true)}>
                                    <Edit3 size={14} /> <span>Edit</span>
                                </button>
                                <button className="action-btn-refined" onClick={() => onAssign?.(block._id, block.assignedEngineer?._id)}>
                                    <UserPlus size={14} /> <span>Reassign</span>
                                </button>
                                {!block.isEscalated && (
                                    <button className="action-btn-refined warning" onClick={() => onEscalate?.(block._id)}>
                                        <Zap size={14} /> <span>Escalate</span>
                                    </button>
                                )}
                            </div>
                        )}
                        <button onClick={onClose} className="header-close-btn">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="drawer-scroll-body">
                    
                    {/* 2. EXECUTION OVERVIEW */}
                    <div className="drawer-content-section">
                        <SectionHeader icon={BarChart3} title="Execution Metrics" />
                        <div className="metrics-grid-3">
                            <div className="metric-tile">
                                <span className="tile-label">Actual Hours</span>
                                <span className="tile-value" style={{ color: sla.delayHours > 0 ? 'var(--red)' : 'inherit' }}>
                                    {formatDuration(sla.actualHours)}
                                </span>
                                <span className="tile-sub">Logged Telemetry</span>
                            </div>
                            <div className="metric-tile">
                                <span className="tile-label">Expected SLA</span>
                                <span className="tile-value">{formatDuration(sla.expectedHours)}</span>
                                <span className="tile-sub">Target Window</span>
                            </div>
                            <div className="metric-tile">
                                <span className="tile-label">SLA Variance</span>
                                <span className="tile-value" style={{ color: sla.delayHours > 0 ? 'var(--red)' : 'var(--green)' }}>
                                    {sla.delayHours > 0 ? `+${formatDuration(sla.delayHours)}` : '0h'}
                                </span>
                                <span className="tile-sub">Drift / Overrun</span>
                            </div>
                            <div className="metric-tile">
                                <span className="tile-label">Efficiency</span>
                                <span className="tile-value">{efficiency}%</span>
                                <span className="tile-sub">SLA Accuracy</span>
                            </div>
                            <div className="metric-tile">
                                <span className="tile-label">Velocity</span>
                                <span className="tile-value">{velocity}</span>
                                <span className="tile-sub">Pts / Hour</span>
                            </div>
                            <div className="metric-tile">
                                <span className="tile-label">Rejections</span>
                                <span className="tile-value" style={{ color: block.rejectionCount > 0 ? 'var(--red)' : 'inherit' }}>
                                    {block.rejectionCount}
                                </span>
                                <span className="tile-sub">Quality Rollbacks</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. WORKFLOW TIMELINE */}
                    <div className="drawer-content-section">
                        <SectionHeader icon={Clock} title="Workflow Timeline" />
                        <div className="vertical-timeline-refined">
                            {WORKFLOW_ORDER.map((stage, i) => {
                                const history = block.stageHistory?.find(h => h.stage === stage);
                                const isCurrent = block.status === stage;
                                const isCompleted = WORKFLOW_ORDER.indexOf(block.status) > i || block.status === 'COMPLETED';
                                
                                const expected = history?.expectedHours || sla.expectedHours;
                                const actual = isCurrent ? sla.actualHours : (history?.durationHours || 0);
                                const isOverrun = actual > expected;

                                return (
                                    <div key={stage} className={`timeline-node-refined ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                        <div className="node-line-container">
                                            <div className="node-dot">
                                                {isCompleted ? <CheckCircle2 size={12} /> : (i + 1)}
                                            </div>
                                            {i < WORKFLOW_ORDER.length - 1 && <div className="node-line" />}
                                        </div>
                                        <div className="node-content">
                                            <div className="node-header">
                                                <span className="node-name">{stage.replace(/_/g, ' ')}</span>
                                                {isCurrent && <span className="active-indicator">ACTIVE</span>}
                                                {isCompleted && history?.completedAt && (
                                                    <span className="timestamp-hint">{new Date(history.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                )}
                                            </div>
                                            {(isCompleted || isCurrent) && (
                                                <div className="node-details">
                                                    <div className="detail-item">
                                                        <span className="lbl">TIME:</span>
                                                        <span className={`val ${isOverrun ? 'danger' : ''}`}>{formatDuration(actual)}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <span className="lbl">TARGET:</span>
                                                        <span className="val">{formatDuration(expected)}</span>
                                                    </div>
                                                    {history?.rejectionTriggered && (
                                                        <div className="rollback-pill">ROLLBACK</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. DEPENDENCY ORCHESTRATION */}
                    <div className="drawer-content-section">
                        <SectionHeader icon={Layers} title="Dependency Orchestration" />
                        <div className="dependency-visualizer-refined">
                            <div className="dep-stack">
                                <div className="dep-label">UPSTREAM BLOCKERS</div>
                                {upstream.length > 0 ? (
                                    upstream.map(dep => (
                                        <div key={dep._id} className="dep-item upstream">
                                            <Link2 size={12} />
                                            <span>{dep.name}</span>
                                            <span className={`mini-status ${dep.status}`}>{dep.status}</span>
                                        </div>
                                    ))
                                ) : <div className="empty-dep-hint">No Blockers</div>}
                            </div>
                            
                            <div className="dep-connector">
                                <div className="connector-line" />
                                <div className="connector-arrow" />
                            </div>

                            <div className="dep-current-node">
                                <Zap size={14} />
                                <span>{block.name}</span>
                            </div>

                            <div className="dep-connector">
                                <div className="connector-line" />
                                <div className="connector-arrow" />
                            </div>

                            <div className="dep-stack">
                                <div className="dep-label">DOWNSTREAM IMPACT</div>
                                {downstream.length > 0 ? (
                                    downstream.map(ds => (
                                        <div key={ds._id} className="dep-item downstream">
                                            <TrendingUp size={12} />
                                            <span>{ds.name}</span>
                                            <span className={`mini-status ${isBlocked ? 'BLOCKED' : 'QUEUED'}`}>
                                                {isBlocked ? 'BLOCKED' : 'QUEUED'}
                                            </span>
                                        </div>
                                    ))
                                ) : <div className="empty-dep-hint">No Impact</div>}
                            </div>
                        </div>
                        <div className="cascading-risk-banner">
                            <AlertTriangle size={14} />
                            <span>Cascading Risk: <strong>{(block.propagationRisk * 100).toFixed(0)}%</strong> • Critical Path Involved</span>
                        </div>
                    </div>

                    {/* 5. OPERATIONAL INTELLIGENCE */}
                    <div className="drawer-content-section">
                        <SectionHeader icon={Info} title="Operational Intelligence" />
                        <div className="intel-card-refined">
                            <div className="intel-main">
                                <div className="intel-header">
                                    <Shield size={16} />
                                    <span>System Recommendation</span>
                                    {rec?.priority && <span className={`prio-badge ${rec.priority.toLowerCase()}`}>{rec.priority}</span>}
                                </div>
                                <p className="intel-text">"{rec?.text || 'Analyzing execution telemetry for recovery suggestions...'}"</p>
                            </div>
                            <div className="intel-stats">
                                <div className="intel-stat-item">
                                    <span className="lbl">SLA RISK</span>
                                    <span className={`val ${sla.delayHours > 0 ? 'danger' : 'success'}`}>
                                        {sla.delayHours > 0 ? 'HIGH' : 'LOW'}
                                    </span>
                                </div>
                                <div className="intel-stat-item">
                                    <span className="lbl">RECOVERY</span>
                                    <span className="val">EST. 4.5h</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 6. EVENT ACTIVITY FEED */}
                    <div className="drawer-content-section activity-section">
                        <SectionHeader icon={MessageSquare} title="Execution Event Log" />
                        {logsLoading ? (
                            <div className="skeleton-activity" />
                        ) : (
                            <div className="activity-feed-refined">
                                {renderActivityGroup('WORKFLOW EVENTS', groupedLogs.WORKFLOW)}
                                {renderActivityGroup('ASSIGNMENT EVENTS', groupedLogs.ASSIGNMENT)}
                                {renderActivityGroup('METADATA UPDATES', groupedLogs.METADATA)}
                                {renderActivityGroup('SYSTEM ACTIONS', groupedLogs.SYSTEM)}
                                
                                {logs.length === 0 && (
                                    <div className="empty-feed-hint">No historical orchestration events found for this block.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* EDIT BLOCK DRAWER OVERLAY */}
                {isEditing && (
                    <div className="edit-overlay-panel fade-in">
                        <div className="edit-panel-header">
                            <div className="header-icon"><Settings size={18} /></div>
                            <div className="header-text">
                                <h3>Edit Block Specifications</h3>
                                <p>Modify hardware metadata and orchestration constraints</p>
                            </div>
                        </div>
                        
                        <div className="edit-panel-body">
                            <div className="edit-form-grid">
                                <div className="form-field">
                                    <label>Block Name</label>
                                    <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                                </div>
                                <div className="form-field">
                                    <label>Block Type</label>
                                    <select value={editData.type} onChange={e => setEditData({...editData, type: e.target.value})}>
                                        {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Complexity</label>
                                    <select value={editData.complexity} onChange={e => setEditData({...editData, complexity: e.target.value})}>
                                        {COMPLEXITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Estimated Hours</label>
                                    <input type="number" value={editData.estimatedHours} onChange={e => setEditData({...editData, estimatedHours: e.target.value})} />
                                </div>
                                <div className="form-field">
                                    <label>Technology Node</label>
                                    <select value={editData.techNode} onChange={e => setEditData({...editData, techNode: e.target.value})}>
                                        {TECH_NODES.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Priority (1-10)</label>
                                    <input type="number" min="1" max="10" value={editData.priority} onChange={e => setEditData({...editData, priority: e.target.value})} />
                                </div>
                                <div className="form-field full-width">
                                    <label>Assigned Engineer</label>
                                    <select value={editData.assignedEngineer} onChange={e => setEditData({...editData, assignedEngineer: e.target.value})}>
                                        <option value="">Unassigned</option>
                                        {engineers.map(eng => <option key={eng._id} value={eng._id}>{eng.displayName}</option>)}
                                    </select>
                                </div>
                                <div className="form-field full-width">
                                    <label>Dependencies</label>
                                    <select 
                                        multiple 
                                        className="multi-select"
                                        value={editData.dependencies} 
                                        onChange={e => setEditData({...editData, dependencies: Array.from(e.target.selectedOptions, opt => opt.value)})}
                                    >
                                        {allBlocks.filter(b => b._id !== block._id).map(b => (
                                            <option key={b._id} value={b._id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field full-width">
                                    <label>Description</label>
                                    <textarea value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div className="edit-panel-footer">
                            <button className="footer-btn secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                            <button className="footer-btn primary" onClick={async () => {
                                await onUpdateBlock(block._id, editData);
                                setIsEditing(false);
                            }}>Save Changes</button>
                        </div>
                    </div>
                )}

                {/* REJECTION PANEL OVERLAY */}
                {rejectionActive && (
                    <div className="edit-overlay-panel fade-in rejection">
                         <div className="edit-panel-header">
                            <div className="header-icon danger"><AlertTriangle size={18} /></div>
                            <div className="header-text">
                                <h3>Technical Rejection</h3>
                                <p>Provide specific feedback for workflow rollback</p>
                            </div>
                        </div>
                        <div className="edit-panel-body">
                            <textarea 
                                className="rejection-textarea"
                                placeholder="Specify technical reasons for rejection..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                        <div className="edit-panel-footer">
                            <button className="footer-btn secondary" onClick={() => setRejectionActive(false)}>Cancel</button>
                            <button 
                                className="footer-btn danger"
                                disabled={!rejectionReason.trim()}
                                onClick={() => { onReview?.(block._id, 'REJECT', rejectionReason); setRejectionActive(false); }}
                            >Confirm Rejection</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default BlockDetailsDrawer;
