import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import BlockDocsPanel from './BlockDocsPanel';
import { useOrchestration } from '../context/OrchestrationContext';
import { calculateSLA, formatDuration } from '../utils/workflowEngine';
import { 
    AlertTriangle, Clock, Activity, ShieldAlert, CheckCircle2, 
    User, ChevronRight, Layers, Upload, Play, Eye, FileText
} from 'lucide-react';
import './TimelinePanel.css';

const TimelinePanel = ({ block: initialBlock, onClose, onUpdateStatus, onReview, onResumeWorkflow, onEscalate, isManager, user }) => {
    const { blocks: contextBlocks } = useOrchestration();
    const block = contextBlocks.find(b => b._id === initialBlock?._id) || initialBlock;
    
    // Resolve dependencies with full block data
    const resolvedDependencies = React.useMemo(() => {
        return (block.dependencies || []).map(d => {
            const depId = typeof d === 'string' ? d : d._id;
            const found = contextBlocks.find(b => b._id === depId);
            return found || (typeof d === 'object' ? d : { _id: depId, name: 'Unknown Node', status: 'UNKNOWN' });
        });
    }, [block.dependencies, contextBlocks]);
    
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const canManage = isManager || (block?.assignedEngineer?._id === user?._id || block?.assignedEngineer === user?._id);

    const [uploadSuccess, setUploadSuccess] = useState(null);
    const [isUploading, setIsUploading] = useState(null); // stage
    const { uploadProof } = useOrchestration();

    const handleFileUpload = (e, stage) => {
        e.stopPropagation();
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(stage);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target.result;
            const proofData = {
                fileName: file.name,
                content: content,
                uploadedAt: new Date()
            };
            
            try {
                if (stage === 'DRC') {
                    await uploadProof?.(block._id, { drcProof: proofData });
                } else if (stage === 'LVS') {
                    await uploadProof?.(block._id, { lvsProof: proofData });
                }
                toast.success(`${stage} Report Uploaded Successfully!`);
                setUploadSuccess(`${stage} Report Uploaded Successfully!`);
                setTimeout(() => setUploadSuccess(null), 3000);
            } catch (err) {
                console.error("Proof upload error:", err);
                const msg = err.response?.data?.message || err.message || "Unknown error";
                toast.error(`Upload failed: ${msg}`);
            } finally {
                setIsUploading(null);
            }
        };
        reader.onerror = () => {
            toast.error("Error reading file.");
            setIsUploading(null);
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        if (!block?._id) return;
        setLoading(true);
        const fetchLogs = async () => {
            try {
                const res = await api.get(`/blocks/${block._id}/logs`);
                setLogs(res.data.data);
            } catch (err) {
                console.error("Frontend error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [block?._id]);

    if (!block) return null;

    const formatDate = (ts) => {
        return new Date(ts).toLocaleString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <aside className="timeline-panel fade-in">
            {/* Header */}
            <div className="timeline-header">
                <div className="timeline-header-content">
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Block Details</span>
                    <h2>{block.name}</h2>
                </div>
                <button className="timeline-close" onClick={onClose} title="Close Panel">
                    ✕
                </button>
            </div>

            {/* Body */}
            <div className="timeline-body">
                {/* Status & Health Section */}
                <div className="timeline-section">
                    <div className="timeline-section-title">Status & Health</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <span className={`status-badge status-${block.status}`}>{block.status.replace('_', ' ')}</span>
                        <div className="health-status" style={{ background: 'var(--bg)', padding: '2px 10px', borderRadius: 20 }}>
                            <span className={`health-dot health-dot-${block.health}`}></span>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{block.healthLabel || block.health}</span>
                        </div>
                    </div>
                    
                    {(block.health !== 'HEALTHY' || block.isBottleneck) && (
                        <div className={`health-box health-box--${block.health}`}>
                            <div className="health-box-title">
                                Orchestration Analysis
                            </div>
                            <div className="health-box-reason">
                                {block.isBottleneck && <div style={{ marginBottom: 4 }}>• Detected as system bottleneck</div>}
                                {block.delayHours > 0 && <div style={{ marginBottom: 4 }}>• SLA Overrun: +{block.delayHours?.toFixed(1) || '0.0'}h</div>}
                                {block.propagationRisk > 0.3 && <div style={{ marginBottom: 4 }}>• High Propagation Risk: {((block.propagationRisk || 0) * 100).toFixed(0)}%</div>}
                                {block.isBlocked && <div style={{ marginBottom: 4 }}>• Execution blocked by upstream</div>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Execution Control */}
                {canManage && block.status !== 'COMPLETED' && (
                    <div className="timeline-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                        <div className="timeline-section-title">Execution Control</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {block.status !== 'REVIEW' && (
                                <button 
                                    className="ew-b b-pri"
                                    onClick={() => onResumeWorkflow?.(block._id)}
                                    disabled={block.executionState === 'BLOCKED'}
                                    style={{ flex: 1, minWidth: 120 }}
                                >
                                    {block.executionState === 'READY' ? 'Start execution' : 'Resume execution'}
                                </button>
                            )}

                            {block.status !== 'COMPLETED' && block.status !== 'REVIEW' && (
                                <button 
                                    className={`ew-b b-pri ${actionLoading ? 'loading' : ''} ${((block.status === 'DRC' && !block.drcProof?.content) || (block.status === 'LVS' && !block.lvsProof?.content)) ? 'blocked-action' : ''}`}
                                    onClick={async () => {
                                        const needsProof = (block.status === 'DRC' && !block.drcProof?.content) || (block.status === 'LVS' && !block.lvsProof?.content);
                                        if (needsProof) {
                                            toast.error(`Please upload the ${block.status} report first.`);
                                            return;
                                        }
                                        setActionLoading(true);
                                        try {
                                            const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
                                            const nextStatus = statuses[statuses.indexOf(block.status) + 1];
                                            await onUpdateStatus?.(block._id, nextStatus);
                                            toast.success(`Workflow advanced to ${nextStatus}`);
                                        } catch (err) {
                                            console.error(err);
                                            toast.error("Transition failed. Sequence error.");
                                        } finally {
                                            setActionLoading(false);
                                        }
                                    }}
                                    style={{ flex: 1, minWidth: 140 }}
                                >
                                    {actionLoading ? <Activity size={14} className="spin" /> : <Play size={14} />} Move to Next Stage
                                </button>
                            )}

                            {isManager && !block.escalated && (
                                <button 
                                    className="ew-b b-red"
                                    onClick={() => onEscalate?.(block._id)}
                                    style={{ flex: 1, minWidth: 100 }}
                                >
                                    Escalate
                                </button>
                            )}

                            {isManager && block.status === 'REVIEW' && (
                                <>
                                    <button 
                                        className="ew-b b-grn"
                                        onClick={() => onReview?.(block._id, 'APPROVE')}
                                        style={{ flex: 1, minWidth: 100 }}
                                    >
                                        Approve
                                    </button>
                                    <button 
                                        className="ew-b b-red"
                                        onClick={() => onReview?.(block._id, 'REJECT')}
                                        style={{ flex: 1, minWidth: 100 }}
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                        {block.executionState === 'BLOCKED' && (
                            <div style={{ marginTop: 10, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                ⚠️ Execution locked until upstream dependencies are cleared.
                            </div>
                        )}
                    </div>
                )}

                {/* Manager Verification Audit (View Proofs) */}
                {isManager && (block.drcProof?.content || block.lvsProof?.content) && (
                    <div className="timeline-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                        <div className="timeline-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldAlert size={14} className="text-accent" /> Verification Reports Audit
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {block.drcProof?.content && (
                                <div style={{ 
                                    background: 'var(--bg)', 
                                    borderRadius: 6, 
                                    padding: '10px 12px', 
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>DRC Verification Report</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{block.drcProof.fileName}</div>
                                        </div>
                                    </div>
                                    <button 
                                        className="ew-b" 
                                        style={{ height: 28, fontSize: 10 }}
                                        onClick={() => {
                                            const win = window.open("", "_blank");
                                            win.document.write(`<pre style="padding: 20px; font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; color: #f8fafc; margin: 0; min-height: 100vh;">${block.drcProof.content}</pre>`);
                                            win.document.title = `DRC Report: ${block.name}`;
                                        }}
                                    >
                                        <Eye size={12} /> View Report
                                    </button>
                                </div>
                            )}

                            {block.lvsProof?.content && (
                                <div style={{ 
                                    background: 'var(--bg)', 
                                    borderRadius: 6, 
                                    padding: '10px 12px', 
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>LVS Verification Report</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{block.lvsProof.fileName}</div>
                                        </div>
                                    </div>
                                    <button 
                                        className="ew-b" 
                                        style={{ height: 28, fontSize: 10 }}
                                        onClick={() => {
                                            const win = window.open("", "_blank");
                                            win.document.write(`<pre style="padding: 20px; font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; color: #f8fafc; margin: 0; min-height: 100vh;">${block.lvsProof.content}</pre>`);
                                            win.document.title = `LVS Report: ${block.name}`;
                                        }}
                                    >
                                        <Eye size={12} /> View Report
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Proof of Work Upload (Mandatory for DRC/LVS) */}
                {!isManager && (block.status === 'DRC' || block.status === 'LVS') && (
                    <div className="timeline-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                        <div className="timeline-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                             Verification Proof Traceability
                        </div>
                        
                        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, border: '1px dashed var(--border-light)' }}>
                            {((block.status === 'DRC' && block.drcProof?.content) || (block.status === 'LVS' && block.lvsProof?.content)) ? (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <CheckCircle2 size={16} /> Technical Audit Proof Secured
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        File: {block.status === 'DRC' ? block.drcProof.fileName : block.lvsProof.fileName}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                        A mandatory {block.status} verification report (.txt) is required to advance.
                                    </div>
                                    <label className={`ew-b b-pri ${isUploading === block.status ? 'loading' : ''}`} style={{ cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                                        {isUploading === block.status ? <Activity size={14} className="spin" /> : <Upload size={14} />}
                                        {isUploading === block.status ? 'Uploading...' : `Upload ${block.status} Report`}
                                        <input type="file" accept=".txt" onChange={(e) => handleFileUpload(e, block.status)} hidden disabled={!!isUploading} />
                                    </label>
                                </div>
                            )}
                        </div>

                        {uploadSuccess && (
                            <div style={{ 
                                marginTop: 12, 
                                padding: '8px 12px', 
                                background: 'rgba(22, 163, 74, 0.1)', 
                                color: '#16a34a', 
                                fontSize: 11, 
                                fontWeight: 700, 
                                borderRadius: 6,
                                textAlign: 'center',
                                animation: 'slideUp 0.3s ease'
                            }}>
                                <CheckCircle2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {uploadSuccess}
                            </div>
                        )}
                    </div>
                )}

                {/* Dependencies Section */}
                {resolvedDependencies.length > 0 && (
                    <div className="timeline-section" style={{ marginTop: 24 }}>
                        <div className="timeline-section-title">Dependency Impact</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {resolvedDependencies.map(dep => {
                                const isBlocking = dep.status !== 'COMPLETED';
                                const sev = dep.healthStatus === 'CRITICAL' ? 'critical' : (isBlocking ? 'blocking' : 'healthy');
                                
                                return (
                                    <div 
                                        key={dep._id} 
                                        className={`dep-card dep-${sev}`}
                                        style={{ cursor: dep.status !== 'UNKNOWN' ? 'pointer' : 'default' }}
                                    >
                                        <div className="dep-card-header">
                                            <span className="dep-name">{dep.name}</span>
                                            <div className="dep-badges">
                                                <span className={`ew-t ${dep.status === 'COMPLETED' ? 't-grn' : 't-blu'}`} style={{ fontSize: 9 }}>
                                                    {dep.status?.replace('_', ' ') || 'UNKNOWN'}
                                                </span>
                                                <span className={`ew-t ${dep.healthStatus === 'CRITICAL' ? 't-red' : dep.healthStatus === 'RISK' ? 't-amb' : 't-grn'}`} style={{ fontSize: 9 }}>
                                                    {dep.healthStatus || 'HEALTHY'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="dep-card-body">
                                            <div className="dep-meta">
                                                <span><User size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {dep.assignedEngineer?.displayName || 'Unassigned'}</span>
                                                {isBlocking && <span style={{ color: 'var(--red)', fontWeight: 800, fontSize: 10 }}>BLOCKING</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={12} /> These modules must complete before this block can progress.
                        </div>
                    </div>
                )}

                {/* Metadata Grid */}
                <div className="timeline-section">
                    <div className="timeline-section-title">Metadata</div>
                    <div className="timeline-grid">
                        <span className="timeline-grid-label">Type</span>
                        <span className="timeline-grid-value">{block.type || 'N/A'}</span>
                        
                        <span className="timeline-grid-label">Node</span>
                        <span className="timeline-grid-value">{block.techNode || 'N/A'}</span>
                        
                        <span className="timeline-grid-label">Complexity</span>
                        <span className="timeline-grid-value" style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontSize: 11 }}>{block.complexity}</span>
                        
                        <span className="timeline-grid-label">Estimated</span>
                        <span className="timeline-grid-value">{(block.slaTargetHours || 0)}h</span>

                        <span className="timeline-grid-label">Actual</span>
                        <span className="timeline-grid-value">{(block.elapsedHours || 0).toFixed(1)}h</span>

                        <span className="timeline-grid-label">Confidence</span>
                        <span className="timeline-grid-value">{block.confidenceScore}%</span>

                        <span className="timeline-grid-label">Risk</span>
                        <span className="timeline-grid-value">{((block.propagationRisk || 0) * 100).toFixed(0)}%</span>

                        <span className="timeline-grid-label">Owner</span>
                        <span className="timeline-grid-value" style={{ color: block.assignedEngineer ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                            {block.assignedEngineer?.displayName || 'Unassigned'}
                        </span>
                    </div>
                </div>

                {/* Context & Notes Panel (Manager Only) */}
                {isManager && <BlockDocsPanel blockId={block._id} blockName={block.name} />}

                {/* Activity History */}
                <div className="timeline-section" style={{ marginTop: '24px' }}>
                    <div className="timeline-section-title">Activity History</div>
                    
                    {loading && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading activity...</div>}
                    
                    {!loading && logs.length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No activity recorded yet.</div>
                    )}

                    {!loading && logs.length > 0 && (
                        <div className="activity-list">
                            {logs.map((log, index) => (
                                <div key={log._id} className="activity-item">
                                    <div className="activity-dot"></div>
                                    <div className="activity-content">
                                        <div className="activity-header">
                                            <span className="activity-action">{log.action.replace('_', ' ')}</span>
                                            <span className="activity-time">{formatDate(log.timestamp)}</span>
                                        </div>
                                        <div className="activity-desc">
                                            {log.userId?.displayName && <strong>{log.userId.displayName} </strong>}
                                            {log.message}
                                        </div>
                                        {log.action === 'STATUS_UPDATE' && (
                                            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', gap: 8 }}>
                                                <span style={{ color: 'var(--red-text)', textDecoration: 'line-through', opacity: 0.6 }}>{log.previousValue}</span>
                                                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                                                <span style={{ color: 'var(--green-text)' }}>{log.newValue}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default TimelinePanel;
