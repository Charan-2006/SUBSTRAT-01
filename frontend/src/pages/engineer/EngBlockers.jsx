import React, { useMemo, useState } from 'react';
import { 
    AlertTriangle, Clock, Link2, Zap, ShieldAlert, 
    CheckCircle2, User, ExternalLink, Bell, Info,
    ShieldCheck, MessageSquare, ChevronRight, X,
    ArrowUpRight, AlertCircle, Layers, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateSLA, formatDuration, calculateDependencyImpact } from '../../utils/workflowEngine';
import { useOrchestration } from '../../context/OrchestrationContext';

const NotifyModal = ({ blocker, onNotify, onClose }) => {
    const [sending, setSending] = useState(false);
    const message = `${blocker.name} is currently blocked waiting for ${blocker.type.toLowerCase()} completion.`;
    
    const handleNotify = async () => {
        setSending(true);
        try {
            await onNotify(blocker);
            toast.success(`Notification sent successfully.`);
            onClose();
        } catch (err) {
            toast.error('Failed to send notification');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="eb-modal-overlay" onClick={onClose}>
            <div className="eb-modal" onClick={e => e.stopPropagation()}>
                <div className="eb-modal-header">
                    <h3>Notify {blocker.type === 'REVIEW' ? 'Reviewer' : blocker.type === 'DEPENDENCY' ? 'Owner' : 'Manager'}</h3>
                    <button className="eb-close-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="eb-modal-body">
                    <div className="eb-modal-section">
                        <label>Workflow</label>
                        <p>{blocker.name}</p>
                    </div>
                    <div className="eb-modal-section">
                        <label>Recipient</label>
                        <p>{blocker.waitingOn}</p>
                    </div>
                    <div className="eb-modal-section">
                        <label>Message Preview</label>
                        <div className="eb-message-preview">
                            "{message}"
                        </div>
                    </div>
                </div>
                <div className="eb-modal-footer">
                    <button className="eb-btn eb-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="eb-btn eb-btn-primary" onClick={handleNotify} disabled={sending}>
                        {sending ? 'Sending...' : 'Send Notification'}
                    </button>
                </div>
            </div>
            <style>{`
                .eb-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .eb-modal {
                    background: white;
                    width: 100%;
                    max-width: 400px;
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                }
                .eb-modal-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .eb-modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #1e293b; }
                .eb-close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
                .eb-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
                .eb-modal-section label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
                .eb-modal-section p { margin: 0; font-size: 14px; color: #334155; font-weight: 500; }
                .eb-message-preview { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-style: italic; }
                .eb-modal-footer { padding: 16px 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px; }
                .eb-btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
                .eb-btn-secondary { background: white; border-color: #e2e8f0; color: #64748b; }
                .eb-btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
                .eb-btn-primary { background: #2563eb; color: white; }
                .eb-btn-primary:hover { background: #1d4ed8; }
                .eb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

const EngBlockers = ({ active = [], onSelectBlock, blocks = [] }) => {
    const { notifyBlocker } = useOrchestration();
    const [notifyBlockerItem, setNotifyBlockerItem] = useState(null);

    const blockers = useMemo(() => {
        const list = [];
        active.forEach(b => {
            const sla = calculateSLA(b);
            const { upstream, allDownstream = [] } = calculateDependencyImpact(b, blocks);
            
            const stalledUpstream = upstream.filter(u => u.status !== 'COMPLETED' || u.health === 'WARNING' || u.health === 'CRITICAL');
            if (stalledUpstream.length > 0) {
                const primaryDep = stalledUpstream[0];
                list.push({
                    id: `dep-${b._id}`,
                    name: b.name,
                    block: b,
                    type: 'DEPENDENCY',
                    stage: b.status,
                    assigned: b.assignedEngineer?.displayName || 'Unassigned',
                    reason: `Waiting for upstream module: ${primaryDep.name}`,
                    waitingOn: primaryDep.assignedEngineer?.displayName || 'Module Owner',
                    waitingOnId: primaryDep.assignedEngineer?._id || primaryDep.assignedEngineer,
                    stalled: sla.actualHours,
                    blocksDownstream: allDownstream.length > 0,
                    color: 'orange'
                });
                return; 
            }

            if (b.status === 'REVIEW') {
                list.push({
                    id: `rev-${b._id}`,
                    name: b.name,
                    block: b,
                    type: 'REVIEW',
                    stage: b.status,
                    assigned: b.assignedEngineer?.displayName || 'Unassigned',
                    reason: 'Awaiting reviewer sign-off',
                    waitingOn: b.approvedBy?.displayName || 'Senior Reviewer',
                    waitingOnId: b.approvedBy?._id || b.createdBy,
                    stalled: sla.actualHours,
                    blocksDownstream: allDownstream.length > 0,
                    color: 'blue'
                });
                return;
            }

            if (b.escalated || b.escalationState === 'ESCALATED') {
                list.push({
                    id: `esc-${b._id}`,
                    name: b.name,
                    block: b,
                    type: 'ESCALATED',
                    stage: b.status,
                    assigned: b.assignedEngineer?.displayName || 'Unassigned',
                    reason: 'High-priority escalation clearance required',
                    waitingOn: 'Operations Manager',
                    waitingOnId: b.createdBy,
                    stalled: sla.actualHours,
                    blocksDownstream: allDownstream.length > 0,
                    color: 'red'
                });
            }
        });
        return list;
    }, [active, blocks]);
    const handleNotify = async (item) => {
        try {
            await notifyBlocker?.(item.block._id, item.waitingOnId);
            return true;
        } catch (err) {
            console.error("Notification failed:", err);
            throw err;
        }
    };

    const getSeverity = (item) => {
        if (item.stalled > 12 || item.blocksDownstream) return 'CRITICAL';
        if (item.stalled > 6) return 'HIGH';
        if (item.stalled > 2) return 'MEDIUM';
        return 'LOW';
    };

    const stats = {
        total: blockers.length,
        review: blockers.filter(b => b.type === 'REVIEW').length,
        dependency: blockers.filter(b => b.type === 'DEPENDENCY').length,
        escalated: blockers.filter(b => b.type === 'ESCALATED').length
    };

    return (
        <div className="eb-page-v3">
            <header className="eb-header-v3">
                <div className="eb-title-v3">
                    <h1>Execution Blockers</h1>
                    <p>Current interruptions preventing workflow progression</p>
                </div>
                <div className="eb-stats-v3">
                    <div className="eb-stat-v3">
                        <span className="eb-stat-label">Total</span>
                        <span className="eb-stat-value">{stats.total}</span>
                    </div>
                    <div className="eb-stat-v3">
                        <span className="eb-stat-label">Review</span>
                        <span className="eb-stat-value">{stats.review}</span>
                    </div>
                    <div className="eb-stat-v3">
                        <span className="eb-stat-label">Dependency</span>
                        <span className="eb-stat-value">{stats.dependency}</span>
                    </div>
                    <div className="eb-stat-v3">
                        <span className="eb-stat-label text-red">Escalated</span>
                        <span className="eb-stat-value text-red">{stats.escalated}</span>
                    </div>
                </div>
            </header>

            <div className="eb-content-v3">
                {blockers.length > 0 ? (
                    <div className="eb-grid-v3">
                        {blockers.map(b => {
                            const sev = getSeverity(b);
                            return (
                                <div key={b.id} className="eb-card-v3">
                                    <div className="eb-card-header-v3">
                                        <div className="eb-card-title-v3">
                                            <h3>{b.name}</h3>
                                            <div className="eb-card-meta-v3">
                                                <span>{b.stage}</span>
                                                <span className="eb-dot">•</span>
                                                <span>{b.assigned}</span>
                                            </div>
                                        </div>
                                        <div className={`eb-badge-v3 eb-badge-${sev.toLowerCase()}`}>
                                            {sev}
                                        </div>
                                    </div>
                                    <div className="eb-card-body-v3">
                                        <div className="eb-info-v3">
                                            <label>Reason</label>
                                            <p>{b.reason}</p>
                                        </div>
                                        <div className="eb-details-v3">
                                            <div className="eb-detail-v3">
                                                <label>Waiting On</label>
                                                <div className="eb-val-v3"><User size={12} /> {b.waitingOn}</div>
                                            </div>
                                            <div className="eb-detail-v3">
                                                <label>Duration</label>
                                                <div className="eb-val-v3"><Clock size={12} /> {formatDuration(b.stalled)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="eb-card-footer-v3">
                                        <button className="eb-action-btn-v3" onClick={() => setNotifyBlockerItem(b)}>
                                            <Bell size={14} /> Notify
                                        </button>
                                        <button className="eb-action-btn-v3 eb-primary-v3" onClick={() => onSelectBlock?.(b.block)}>
                                            <ExternalLink size={14} /> Open
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="eb-empty-v3">
                        <div className="eb-empty-icon-v3"><CheckCircle2 size={32} /></div>
                        <h3>No active blockers</h3>
                        <p>All workflows are progressing within SLA targets.</p>
                    </div>
                )}
            </div>

            {notifyBlockerItem && (
                <NotifyModal 
                    blocker={notifyBlockerItem} 
                    onNotify={handleNotify}
                    onClose={() => setNotifyBlockerItem(null)} 
                />
            )}

            <style>{`
                .eb-page-v3 { padding: 0; }
                .eb-header-v3 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 1px solid #f1f5f9; padding-bottom: 24px; }
                .eb-title-v3 h1 { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
                .eb-title-v3 p { font-size: 13px; color: #64748b; margin: 0; }
                
                .eb-stats-v3 { display: flex; gap: 24px; }
                .eb-stat-v3 { display: flex; flex-direction: column; align-items: flex-end; }
                .eb-stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .eb-stat-value { font-size: 18px; font-weight: 800; color: #1e293b; }
                
                .eb-grid-v3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
                .eb-card-v3 { background: white; border: 1px solid #e2e8f0; border-radius: 8px; transition: all 0.2s; display: flex; flex-direction: column; }
                .eb-card-v3:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                
                .eb-card-header-v3 { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
                .eb-card-title-v3 h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #334155; }
                .eb-card-meta-v3 { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #94a3b8; font-weight: 500; }
                .eb-dot { font-size: 8px; }
                
                .eb-badge-v3 { padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid transparent; }
                .eb-badge-critical { background: #fef2f2; color: #ef4444; border-color: #fee2e2; }
                .eb-badge-high { background: #fff7ed; color: #f97316; border-color: #ffedd5; }
                .eb-badge-medium { background: #fffbeb; color: #f59e0b; border-color: #fef3c7; }
                .eb-badge-low { background: #f0fdf4; color: #16a34a; border-color: #dcfce7; }
                
                .eb-card-body-v3 { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 16px; }
                .eb-info-v3 label, .eb-detail-v3 label { display: block; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.02em; }
                .eb-info-v3 p { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; font-weight: 500; }
                
                .eb-details-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .eb-val-v3 { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; }
                
                .eb-card-footer-v3 { padding: 12px 16px; background: #f8fafc; border-top: 1px solid #f1f5f9; border-radius: 0 0 8px 8px; display: flex; gap: 8px; }
                .eb-action-btn-v3 { flex: 1; height: 32px; border-radius: 4px; border: 1px solid #e2e8f0; background: white; color: #64748b; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s; }
                .eb-action-btn-v3:hover { background: #f1f5f9; border-color: #cbd5e1; color: #334155; }
                .eb-action-btn-v3.eb-primary-v3 { background: #2563eb; border-color: #2563eb; color: white; }
                .eb-action-btn-v3.eb-primary-v3:hover { background: #1d4ed8; }
                
                .eb-empty-v3 { padding: 80px 0; text-align: center; color: #94a3b8; }
                .eb-empty-icon-v3 { width: 64px; height: 64px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #22c55e; border: 1px solid #f1f5f9; }
                .eb-empty-v3 h3 { font-size: 16px; font-weight: 700; color: #475569; margin: 0 0 4px; }
                .eb-empty-v3 p { font-size: 13px; color: #94a3b8; margin: 0; }
                
                .text-red { color: #ef4444 !important; }
            `}</style>
        </div>
    );
};

export default EngBlockers;
