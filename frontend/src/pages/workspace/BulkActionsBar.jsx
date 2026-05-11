import React, { useState } from 'react';
import { UserPlus, AlertTriangle, X, CheckCircle, XCircle, Search, ArrowRight } from 'lucide-react';
import { validateBulkAction, calculateEngineerLoad } from '../../utils/workflowEngine';

const BulkActionsBar = ({ selectedBlocks = [], allBlocks = [], engineers = [], onClear, onAction }) => {
    const [showAssign, setShowAssign] = useState(false);
    const [search, setSearch] = useState('');
    if (!selectedBlocks || selectedBlocks.length === 0) return null;

    const filteredEngs = engineers.filter(e => e.displayName.toLowerCase().includes(search.toLowerCase()));
    const canAssign = validateBulkAction('ASSIGN', selectedBlocks, allBlocks);
    const canEscalate = validateBulkAction('ESCALATE', selectedBlocks, allBlocks);
    const canApprove = validateBulkAction('APPROVE', selectedBlocks, allBlocks);
    const canReject = validateBulkAction('REJECT', selectedBlocks, allBlocks);

    return (
        <div className="ws-bulk-bar">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginRight: 4 }}>
                {selectedBlocks.length} selected
            </span>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)', margin: '0 8px' }} />
            
            {canAssign && (
                <div style={{ position: 'relative' }}>
                    <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', gap: 4 }} onClick={() => setShowAssign(!showAssign)}>
                        <UserPlus size={13} /> Assign
                    </button>
                    {showAssign && (
                        <div className="assign-popover up" onClick={e => e.stopPropagation()}>
                            <div className="popover-header">
                                <span>Assign Engineer</span>
                                <button className="popover-close" onClick={() => setShowAssign(false)}><XCircle size={14} /></button>
                            </div>

                            <div className="popover-search-wrap">
                                <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
                                <input 
                                    autoFocus
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="popover-list">
                                {filteredEngs.map(eng => {
                                    const load = calculateEngineerLoad(eng._id, allBlocks);
                                    const overCapacity = load.activeCount >= 5;
                                    const initials = eng.displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

                                    return (
                                        <button 
                                            key={eng._id} 
                                            className="engineer-item"
                                            disabled={overCapacity}
                                            onClick={() => { onAction('ASSIGN', { engineerId: eng._id }); setShowAssign(false); }}
                                        >
                                            <div className="engineer-avatar">{initials}</div>
                                            <div className="engineer-info">
                                                <span className="engineer-name">{eng.displayName}</span>
                                                <div className="engineer-load">
                                                    <span className="load-dot" style={{ background: overCapacity ? 'var(--red)' : 'var(--green)' }} />
                                                    {load.activeCount} active
                                                </div>
                                            </div>
                                            <div className="engineer-assign-icon">
                                                <ArrowRight size={14} />
                                            </div>
                                        </button>
                                    )
                                })}
                                {filteredEngs.length === 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 8px' }}>
                                        No engineers found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {canEscalate && (
                <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.25)', color: '#fff', border: 'none', gap: 4 }} onClick={() => onAction('ESCALATE')}>
                    <AlertTriangle size={13} /> Escalate
                </button>
            )}

            {canApprove && (
                <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.25)', color: '#fff', border: 'none', gap: 4 }} onClick={() => onAction('APPROVE')}>
                    <CheckCircle size={13} /> Approve
                </button>
            )}

            {canReject && (
                <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.25)', color: '#fff', border: 'none', gap: 4 }} onClick={() => onAction('REJECT')}>
                    <XCircle size={13} /> Reject
                </button>
            )}
            
            <div style={{ flex: 1 }} />
            
            <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '4px 8px' }}
                onClick={onClear}
                title="Clear selection"
            >
                <X size={14} />
            </button>
        </div>
    );
};

export default BulkActionsBar;
