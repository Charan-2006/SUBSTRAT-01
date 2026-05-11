import React, { useState, useMemo } from 'react';
import { Send, Clock, CheckCircle2, AlertTriangle, X, Plus, Activity, Layers } from 'lucide-react';

const REQUEST_TYPES = ['Reassignment', 'Escalation', 'Resource Request', 'Dependency Unlock', 'Load Balancing'];

const EngRequests = ({ active = [], requests = [], onCreateRequest }) => {
    const [showForm, setShowForm] = useState(false);
    const [type, setType] = useState(REQUEST_TYPES[0]);
    const [selectedBlockId, setSelectedBlockId] = useState('');
    const [reason, setReason] = useState('');

    const sortedRequests = useMemo(() => [...(requests || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [requests]);
    const pending = useMemo(() => sortedRequests.filter(r => r.status === 'PENDING'), [sortedRequests]);
    const resolved = useMemo(() => sortedRequests.filter(r => r.status !== 'PENDING'), [sortedRequests]);

    const handleSubmit = () => {
        if (!reason.trim()) return;
        onCreateRequest?.({ type, blockId: selectedBlockId || undefined, reason });
        setReason('');
        setSelectedBlockId('');
        setShowForm(false);
    };

    const getStatusClass = (status) => status === 'APPROVED' ? 't-grn' : status === 'REJECTED' ? 't-red' : 't-amb';

    return (
        <div className="ew-page-content fade-in">
            <div className="ew-grid">
                <div className="ew-col">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="ew-sh" style={{ margin: 0 }}><Send size={14} /> Operational Requests ({pending.length} Open)</div>
                        <button className="ew-b b-pri" onClick={() => setShowForm(!showForm)}>
                            {showForm ? <X size={12} /> : <Plus size={12} />}
                            {showForm ? 'Cancel' : 'New Request'}
                        </button>
                    </div>

                    {showForm && (
                        <div className="ew-sp" style={{ borderLeft: '4px solid var(--accent)', background: 'rgba(37, 99, 235, 0.02)', marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 800 }}>CREATE EXECUTION REQUEST</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Request Category</div>
                                    <select 
                                        className="form-control" 
                                        style={{ fontSize: 12, padding: '8px 12px' }} 
                                        value={type} 
                                        onChange={e => setType(e.target.value)}
                                    >
                                        {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Target Workflow</div>
                                    <select 
                                        className="form-control" 
                                        style={{ fontSize: 12, padding: '8px 12px' }} 
                                        value={selectedBlockId} 
                                        onChange={e => setSelectedBlockId(e.target.value)}
                                    >
                                        <option value="">General / Global</option>
                                        {(active || []).map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Justification & Impact</div>
                                <textarea 
                                    className="form-control" 
                                    style={{ fontSize: 12, padding: '10px 12px', minHeight: 80, resize: 'vertical' }} 
                                    value={reason} 
                                    onChange={e => setReason(e.target.value)} 
                                    placeholder="Explain why this request is critical for execution stabilization..."
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="ew-b b-pri" onClick={handleSubmit} disabled={!reason.trim()}><Send size={12} /> Dispatch Request</button>
                            </div>
                        </div>
                    )}

                    <div className="ew-sh"><Clock size={14} /> Pending Action ({pending.length})</div>
                    {!pending.length && (
                        <div className="ew-empty" style={{ padding: 32 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No active requests in queue.</div>
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {pending.map(r => (
                            <div key={r._id} className="ew-wf">
                                <div className="ew-wf-header">
                                    <div className="ew-wf-name" style={{ fontSize: 14 }}>{r.type || 'Request'}</div>
                                    <span className="ew-t t-amb">Awaiting Manager</span>
                                </div>
                                <div className="ew-wf-body" style={{ padding: '12px 18px' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.reason || r.message}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, fontWeight: 700 }}>SUBMITTED: {r.createdAt ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {resolved.length > 0 && (
                        <>
                            <div className="ew-sh" style={{ marginTop: 24 }}><CheckCircle2 size={14} /> Historical Context ({resolved.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {resolved.map(r => (
                                    <div key={r._id} className="ew-wf" style={{ opacity: 0.7 }}>
                                        <div className="ew-wf-header" style={{ background: 'transparent' }}>
                                            <div className="ew-wf-name" style={{ fontSize: 13 }}>{r.type || 'Request'}</div>
                                            <span className={`ew-t ${getStatusClass(r.status)}`}>{r.status}</span>
                                        </div>
                                        <div className="ew-wf-body" style={{ padding: '8px 18px 12px' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.reason || r.message}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="ew-side">
                    <div className="ew-sp">
                        <div className="ew-sp-title"><Activity size={12} /> Request Analytics</div>
                        <div className="ew-sp-content">
                            <div className="ew-sp-row">
                                <span>Pending Approval</span>
                                <span className="text-warning" style={{ fontWeight: 800 }}>{pending.length}</span>
                            </div>
                            <div className="ew-sp-row">
                                <span>Success Rate</span>
                                <span className="text-success" style={{ fontWeight: 800 }}>
                                    {resolved.length ? Math.round((resolved.filter(r => r.status === 'APPROVED').length / resolved.length) * 100) : 100}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="ew-sp" style={{ background: 'var(--bg)', borderStyle: 'dashed' }}>
                        <div className="ew-sp-title"><Layers size={12} /> Strategy</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                            Use requests to unlock dependencies or escalate critical path bottlenecks that cannot be resolved through standard execution loops.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngRequests;
