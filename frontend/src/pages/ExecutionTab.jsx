import React, { useMemo } from 'react';
import { 
    PlayCircle, AlertTriangle, Clock, CheckCircle2, User, 
    ChevronRight, ArrowUpRight, MessageSquare, Shield, Activity,
    TrendingUp, Layout, HardDrive, Inbox
} from 'lucide-react';
import { useOrchestration } from '../context/OrchestrationContext';
import toast from 'react-hot-toast';
import './ExecutionConsole.css';

const STAGE_LABELS = {
    'NOT_STARTED': 'Pending',
    'IN_PROGRESS': 'Design',
    'DRC': 'DRC',
    'LVS': 'LVS',
    'REVIEW': 'Review',
    'COMPLETED': 'Tapeout Ready'
};

const ExecutionTab = ({ onSelectBlock }) => {
    const { 
        blocks = [], 
        engineers = [], 
        activityLog = [],
        reviewBlock,
        releaseBlock,
        escalateBlock,
        notifyBlocker,
        assignEngineer,
        updateBlockStatus
    } = useOrchestration();

    const [reassigningId, setReassigningId] = React.useState(null);

    // --- DATA PROCESSING ---
    const stats = useMemo(() => {
        const active = blocks.filter(b => b.status !== 'COMPLETED' && b.status !== 'NOT_STARTED').length;
        const blocked = blocks.filter(b => b.isBlocked || b.healthStatus === 'CRITICAL').length;
        const review = blocks.filter(b => b.status === 'REVIEW').length;
        const completed = blocks.filter(b => b.status === 'COMPLETED' && !b.isReleased).length;
        return { active, blocked, review, completed };
    }, [blocks]);

    const activeQueue = useMemo(() => {
        return blocks
            .filter(b => b.status !== 'COMPLETED' && b.status !== 'NOT_STARTED' && !b.isBlocked && b.healthStatus !== 'CRITICAL')
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }, [blocks]);

    const blockedWorkflows = useMemo(() => {
        return blocks.filter(b => b.isBlocked || b.healthStatus === 'CRITICAL');
    }, [blocks]);

    const reviewPending = useMemo(() => {
        return blocks.filter(b => b.status === 'REVIEW');
    }, [blocks]);

    const engineerProfiles = useMemo(() => {
        return engineers.map(eng => {
            const myBlocks = blocks.filter(b => b.assignedEngineer?._id === eng._id && b.status !== 'COMPLETED');
            const totalHours = myBlocks.reduce((acc, b) => acc + (b.estimatedDurationHours || 0), 0);
            return {
                ...eng,
                activeCount: myBlocks.length,
                totalHours: totalHours.toFixed(1)
            };
        }).sort((a, b) => b.activeCount - a.activeCount);
    }, [engineers, blocks]);

    // --- ACTIONS ---
    const handleApprove = async (blockId) => {
        const toastId = toast.loading('Approving signoff...');
        try {
            await reviewBlock(blockId, 'APPROVE');
            toast.success('Signoff approved', { id: toastId });
        } catch (err) {
            toast.error('Approval failed', { id: toastId });
        }
    };

    const handleReject = async (blockId) => {
        const reason = window.prompt("Enter rejection reason:");
        if (reason) {
            const toastId = toast.loading('Rejecting module...');
            try {
                await reviewBlock(blockId, 'REJECT', reason);
                toast.success('Module rejected and sent back', { id: toastId });
            } catch (err) {
                toast.error('Rejection failed', { id: toastId });
            }
        }
    };

    const handleNotify = async (block) => {
        const toastId = toast.loading('Dispatching notification...');
        try {
            await notifyBlocker(block._id, {
                type: 'URGENT',
                message: `Execution is stalled on ${block.name}. Please prioritize resolution.`
            });
            toast.success(`Notification sent to ${block.assignedEngineer?.displayName || 'owner'}`, { id: toastId });
        } catch (err) {
            toast.error('Failed to send notification', { id: toastId });
        }
    };

    const handleRelease = async (blockId) => {
        if (window.confirm("Are you sure you want to release this block to Tapeout?")) {
            const toastId = toast.loading('Releasing to tapeout...');
            try {
                await releaseBlock(blockId);
                toast.success('Block released to Tapeout!', { id: toastId });
            } catch (err) {
                toast.error('Release failed', { id: toastId });
            }
        }
    };

    return (
        <div className="exec-dashboard">
            {/* 1. EXECUTION OVERVIEW HEADER */}
            <div className="exec-summary-grid">
                <div className="summary-card active">
                    <span className="label">Active Blocks</span>
                    <span className="value">{stats.active}</span>
                </div>
                <div className="summary-card blocked">
                    <span className="label">Blocked Blocks</span>
                    <span className="value">{stats.blocked}</span>
                </div>
                <div className="summary-card review">
                    <span className="label">Pending Reviews</span>
                    <span className="value">{stats.review}</span>
                </div>
                <div className="summary-card completed">
                    <span className="label">Completed</span>
                    <span className="value">{stats.completed}</span>
                </div>
            </div>

            <div className="exec-main-grid">
                <div className="exec-content-left">
                    
                    {/* 2. ACTIVE EXECUTION QUEUE */}
                    <div className="exec-section">
                        <div className="section-header">
                            <h3 className="section-title"><PlayCircle size={16} /> Active Execution Queue</h3>
                        </div>
                        <table className="exec-table">
                            <thead>
                                <tr>
                                    <th>Block Name</th>
                                    <th>Assignee</th>
                                    <th>Current Stage</th>
                                    <th>Health</th>
                                    <th>Effort (Act/Est)</th>
                                    <th>Last Update</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeQueue.length > 0 ? activeQueue.map(block => (
                                    <tr key={block._id}>
                                        <td style={{ fontWeight: 700 }}>{block.name}</td>
                                        <td>
                                            {reassigningId === block._id ? (
                                                <select 
                                                    autoFocus
                                                    className="cc-select" 
                                                    style={{ padding: '4px 8px', fontSize: 12 }}
                                                    onChange={async (e) => {
                                                        const engId = e.target.value;
                                                        if (engId) await assignEngineer(block._id, engId);
                                                        setReassigningId(null);
                                                    }}
                                                    onBlur={() => setReassigningId(null)}
                                                >
                                                    <option value="">Select Engineer</option>
                                                    {engineers.map(e => <option key={e._id} value={e._id}>{e.displayName}</option>)}
                                                </select>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {block.assignedEngineer?.displayName || '—'}
                                                    <button className="nav-icon-btn" onClick={() => setReassigningId(block._id)} style={{ padding: 2 }} title="Reassign"><User size={10} /></button>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="exec-status status-healthy" style={{ background: '#f1f5f9', color: '#475569' }}>
                                                {STAGE_LABELS[block.status]}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`exec-status status-${block.healthStatus?.toLowerCase() || 'healthy'}`}>
                                                {block.healthStatus || 'HEALTHY'}
                                            </span>
                                        </td>
                                        <td>{block.actualDurationHours?.toFixed(1)}h / {block.estimatedDurationHours?.toFixed(1)}h</td>
                                        <td style={{ fontSize: 11, color: 'var(--exec-text-ter)' }}>
                                            {new Date(block.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td>
                                            <div className="action-group">
                                                <button className="btn-dash" onClick={() => onSelectBlock?.(block)}>View</button>
                                                <button className="btn-dash" onClick={() => escalateBlock(block._id)}>Escalate</button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="7" className="no-data">No active workflows currently in progress.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 3. BLOCKED WORKFLOWS */}
                    <div className="exec-section">
                        <div className="section-header">
                            <h3 className="section-title" style={{ color: 'var(--exec-orange)' }}><AlertTriangle size={16} /> Blocked Workflows</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {blockedWorkflows.length > 0 ? blockedWorkflows.map(block => (
                                <div key={block._id} className="block-card" style={{ borderLeft: '4px solid var(--exec-orange)' }}>
                                    <div className="block-card-header">
                                        <span className="block-card-name">{block.name}</span>
                                        <span className="exec-status status-blocked">STALLED</span>
                                    </div>
                                    <div className="block-card-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">Waiting On</span>
                                            <span className="meta-value">{block.upstream?.map(u => u.name).join(', ') || 'Upstream Data'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Blocked Reason</span>
                                            <span className="meta-value">{block.healthStatus === 'CRITICAL' ? 'Critical Failure' : 'Dependency Stall'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Stall Duration</span>
                                            <span className="meta-value">{(block.delayHours || 0).toFixed(1)}h</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Owner</span>
                                            <span className="meta-value">{block.assignedEngineer?.displayName || 'Unassigned'}</span>
                                        </div>
                                    </div>
                                    <div className="action-group">
                                        <button className="btn-dash primary" onClick={() => handleNotify(block)}><MessageSquare size={12} /> Notify Owner</button>
                                        <button className="btn-dash" onClick={() => onSelectBlock?.(block)}><Layout size={12} /> View Dependency</button>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ gridColumn: 'span 2' }} className="no-data">System state nominal. No blocked workflows detected.</div>
                            )}
                        </div>
                    </div>

                    {/* 4. REVIEW PENDING SECTION */}
                    <div className="exec-section">
                        <div className="section-header">
                            <h3 className="section-title" style={{ color: 'var(--exec-purple)' }}><Shield size={16} /> Review & Signoff Queue</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {reviewPending.length > 0 ? reviewPending.map(block => (
                                <div key={block._id} className="block-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span className="block-card-name">{block.name}</span>
                                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--exec-text-ter)' }}>
                                            <span>Submitted by: <strong>{block.assignedEngineer?.displayName}</strong></span>
                                            <span>Stage: <strong>{STAGE_LABELS[block.status]}</strong></span>
                                            <span>Rejections: <strong>{block.rejectionCount || 0}</strong></span>
                                        </div>
                                    </div>
                                    <div className="action-group">
                                        <button className="btn-dash" style={{ color: 'var(--exec-purple)', borderColor: 'var(--exec-purple)' }} onClick={() => onSelectBlock?.(block)}><HardDrive size={12} /> Verification Report</button>
                                        <button className="btn-dash danger" onClick={() => handleReject(block._id)}>Reject</button>
                                        <button className="btn-dash primary" onClick={() => handleApprove(block._id)}>Approve Signoff</button>
                                    </div>
                                </div>
                            )) : (
                                <div className="no-data">No modules currently awaiting signoff.</div>
                            )}
                        </div>
                    </div>

                    {/* Tapeout Release Section (Clean version of completed) */}
                    {stats.completed > 0 && (
                        <div className="exec-section">
                            <div className="section-header">
                                <h3 className="section-title" style={{ color: 'var(--exec-green)' }}><CheckCircle2 size={16} /> Release to Tapeout</h3>
                            </div>
                            {blocks.filter(b => b.status === 'COMPLETED' && !b.isReleased).map(block => (
                                <div key={block._id} className="block-card" style={{ borderLeft: '4px solid var(--exec-green)', background: '#f0fdf4' }}>
                                    <div className="block-card-header">
                                        <span className="block-card-name">{block.name}</span>
                                        <button className="btn-dash primary" style={{ background: 'var(--exec-green)', borderColor: 'var(--exec-green)' }} onClick={() => handleRelease(block._id)}>Final Release</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="exec-side-column">
                    <div className="exec-side-panel">
                        {/* 5. ENGINEER WORKLOAD PANEL */}
                        <div className="side-panel-section">
                            <div className="side-panel-title"><User size={14} /> Engineer Workload</div>
                            {engineerProfiles.slice(0, 6).map(eng => {
                                const percentage = Math.min(100, (eng.activeCount / 5) * 100); // Assume 5 is max
                                return (
                                    <div key={eng._id} className="workload-item">
                                        <div className="workload-info">
                                            <span className="workload-name">{eng.displayName}</span>
                                            <span className="workload-count">{eng.activeCount} blocks • {eng.totalHours}h</span>
                                        </div>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ 
                                                width: `${percentage}%`, 
                                                background: percentage > 80 ? 'var(--exec-red)' : percentage > 50 ? 'var(--exec-orange)' : 'var(--exec-blue)' 
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 6. RECENT EXECUTION ACTIVITY */}
                        <div className="side-panel-section" style={{ borderTop: '1px solid var(--exec-border)', paddingTop: 20 }}>
                            <div className="side-panel-title"><Activity size={14} /> Execution Activity</div>
                            <div className="activity-feed">
                                {activityLog.slice(0, 8).map(log => (
                                    <div key={log.id} className="activity-item">
                                        <div className="activity-icon" />
                                        <div className="activity-content">
                                            <span className="activity-text">
                                                <strong>{log.blockName}</strong> {log.action.replace('_', ' ')}
                                                {log.details?.status && ` to ${log.details.status}`}
                                            </span>
                                            <span className="activity-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                ))}
                                {activityLog.length === 0 && (
                                    <div className="no-data" style={{ padding: 0 }}>No recent activity.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionTab;
