import React, { useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
    Zap, Clock, AlertTriangle, CheckCircle2, Activity, Play, 
    FileText, MessageSquare, ArrowUpRight, ArrowDownRight, 
    Layers, Users, ShieldAlert, ChevronRight, Info, Upload, CheckSquare
} from 'lucide-react';
import { 
    calculateSLA, 
    calculateProgress, 
    calculateHealth, 
    calculatePressureIndex, 
    calculateDependencyImpact,
    calculateBottleneck,
    formatDuration
} from '../../utils/workflowEngine';

import { useOrchestration } from '../../context/OrchestrationContext';

const EngMyWork = ({ myBlocks = [], active = [], critical = [], inReview = [], completed = [], overdue = [], ready = [], onSelectBlock, onUpdateStatus, onResumeWorkflow, onEscalate, blocks = [] }) => {
    const { uploadProof } = useOrchestration();
    const [isLoading, setIsLoading] = React.useState(null);
    const [isUploading, setIsUploading] = React.useState(null); // blockId_stage
    const [uploadSuccess, setUploadSuccess] = React.useState(null); // { id: blockId, message: '' }
    const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

    const handleAdvance = async (e, block) => {
        e.stopPropagation();
        if (isLoading === block._id) return;
        
        const currentIndex = WORKFLOW_ORDER.indexOf(block.status);
        if (currentIndex === -1 || currentIndex >= WORKFLOW_ORDER.length - 2) return; // Cannot advance from REVIEW or COMPLETED

        // Validation for Proof of Work
        const needsProof = (block.status === 'DRC' && !block.drcProof?.content) || (block.status === 'LVS' && !block.lvsProof?.content);
        if (needsProof) {
            toast.error(`Please upload the ${block.status} verification report first.`);
            return;
        }

        const nextStatus = WORKFLOW_ORDER[currentIndex + 1];
        
        setIsLoading(block._id);
        try {
            await onUpdateStatus?.(block._id, nextStatus);
        } catch (err) {
            console.error("Advance stage error:", err);
        } finally {
            setIsLoading(null);
        }
    };

    const handleFileUpload = (e, blockId, stage) => {
        e.stopPropagation();
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(`${blockId}_${stage}`);
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
                    await uploadProof?.(blockId, { drcProof: proofData });
                } else if (stage === 'LVS') {
                    await uploadProof?.(blockId, { lvsProof: proofData });
                }
                toast.success(`${stage} Report Uploaded Successfully!`);
                setUploadSuccess({ id: blockId, message: `${stage} Report Uploaded Successfully!` });
                setTimeout(() => setUploadSuccess(null), 4000);
            } catch (err) {
                console.error("Proof upload error:", err);
                const msg = err.response?.data?.message || err.message || "Unknown error";
                toast.error(`Failed to upload ${stage}: ${msg}`);
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

    // --- Synchronization Logic ---
    const blocked = useMemo(() => active.filter(b => (b.dependencies || []).some(d => {
        const dep = typeof d === 'string' ? blocks.find(w => w._id === d) : d;
        return dep?.healthStatus === 'CRITICAL';
    })), [active, blocks]);

    const slaOkCount = useMemo(() => active.filter(b => calculateSLA(b).delayHours <= 0).length, [active]);

    const velocity = useMemo(() => {
        let totalHours = 0;
        let count = 0;
        myBlocks.forEach(b => (b.stageHistory || []).forEach(s => {
            if (s.durationHours) {
                totalHours += s.durationHours;
                count++;
            }
        }));
        return count ? `${(totalHours / count).toFixed(1)}h` : '—';
    }, [myBlocks]);

    // --- Recommendation Engine ---
    const rec = useMemo(() => {
        if (!active.length) return null;
        return [...active].map(b => {
            let score = 0;
            const sla = calculateSLA(b);
            const { isBottlenecked } = calculateBottleneck(b, blocks);
            
            if (b.healthStatus === 'CRITICAL') score += 50;
            if (isBottlenecked) score += 40;
            if (sla.delayHours > 0) score += Math.min(30, sla.delayHours * 5);
            if (b.rejectionCount > 0) score += b.rejectionCount * 10;
            
            return { b, score };
        }).sort((a, b) => b.score - a.score)[0]?.b;
    }, [active, blocks]);

    const recReason = useMemo(() => {
        if (!rec) return '';
        const sla = calculateSLA(rec);
        const { isBottlenecked, reason } = calculateBottleneck(rec, blocks);
        if (rec.healthStatus === 'CRITICAL') return `Critical operational health. ${reason || 'Immediate action required.'}`;
        if (isBottlenecked) return `Critical path bottleneck. Resolving this unlocks downstream execution.`;
        if (sla.delayHours > 0) return `SLA slippage detected (+${formatDuration(sla.delayHours)}). Prioritize to maintain timeline.`;
        return 'Strategically recommended for next execution cycle.';
    }, [rec, blocks]);

    return (
        <div className="ew-page-content fade-in">
            {/* KPI Row: Normalized & Trend-Aware */}
            <div className="ew-kpis">
                <div className="ew-kpi">
                    <div>
                        <div className="ew-kpi-lbl">Active Load</div>
                        <div className="ew-kpi-val" style={{ color: 'var(--accent)' }}>{active.length}</div>
                    </div>
                    <div className="ew-kpi-trend text-accent"><ArrowUpRight size={10} /> {myBlocks.length} Assigned</div>
                </div>
                <div className="ew-kpi">
                    <div>
                        <div className="ew-kpi-lbl">At Risk</div>
                        <div className="ew-kpi-val" style={{ color: overdue.length ? '#dc2626' : '#16a34a' }}>{overdue.length}</div>
                    </div>
                    <div className="ew-kpi-trend" style={{ color: overdue.length ? '#dc2626' : '#16a34a' }}>
                        {overdue.length ? <ShieldAlert size={10} /> : <CheckCircle2 size={10} />}
                        {overdue.length ? 'Attention Required' : 'Healthy'}
                    </div>
                </div>
                <div className="ew-kpi">
                    <div>
                        <div className="ew-kpi-lbl">Queue Pressure</div>
                        <div className="ew-kpi-val" style={{ color: '#d97706' }}>{blocked.length}</div>
                    </div>
                    <div className="ew-kpi-trend text-warning"><Clock size={10} /> Dep. Blocked</div>
                </div>
                <div className="ew-kpi">
                    <div>
                        <div className="ew-kpi-lbl">In Review</div>
                        <div className="ew-kpi-val" style={{ color: '#7c3aed' }}>{inReview.length}</div>
                    </div>
                    <div className="ew-kpi-trend text-purple"><Users size={10} /> Awaiting Peer</div>
                </div>
                <div className="ew-kpi">
                    <div>
                        <div className="ew-kpi-lbl">SLA Health</div>
                        <div className="ew-kpi-val" style={{ color: '#16a34a' }}>{active.length ? Math.round((slaOkCount / active.length) * 100) : 100}%</div>
                    </div>
                    <div className="ew-kpi-trend text-success"><Activity size={10} /> On Schedule</div>
                </div>
                <div className="ew-kpi">
                    <div>
                        <div className="ew-kpi-lbl">Avg Velocity</div>
                        <div className="ew-kpi-val">{velocity}</div>
                    </div>
                    <div className="ew-kpi-trend text-ter"><Layers size={10} /> Per Stage</div>
                </div>
            </div>

            <div className="ew-grid">
                <div className="ew-col">
                    {/* Compact Rejection Alert */}
                    {active.some(b => b.rejectionCount > 0) && (
                        <div className="ew-rec" style={{ border: '1px solid var(--red)', background: 'rgba(239, 68, 68, 0.03)', marginBottom: 16 }}>
                            <div className="ew-rec-content">
                                <div className="ew-rec-badge" style={{ background: 'var(--red)', color: 'white' }}>Action Required: Rejection</div>
                                {active.filter(b => b.rejectionCount > 0).slice(0, 1).map(b => (
                                    <React.Fragment key={b._id}>
                                        <div className="ew-rec-name">{b.name}</div>
                                        <div className="ew-rec-why" style={{ color: 'var(--red)', fontWeight: 600 }}>
                                            Manager Feedback: "{b.rejectionReason || 'Layout verification failed standard check.'}"
                                        </div>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Compact Recommended Next Banner */}
                    {rec && (
                        <div className="ew-rec" onClick={() => onSelectBlock?.(rec)}>
                            <div className="ew-rec-content">
                                <div className="ew-rec-badge">Recommended Next</div>
                                <div className="ew-rec-name">{rec.name}</div>
                                <div className="ew-rec-why">{recReason}</div>
                            </div>
                            <div className="ew-rec-cta" onClick={e => e.stopPropagation()}>
                                     {rec.executionState === 'BLOCKED' && (
                                        <button 
                                            className="ew-b" 
                                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #fecdd3' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm("CRITICAL: Proceeding 'At Risk' skips dependency validation. Continue?")) {
                                                    onResumeWorkflow?.(rec._id, true);
                                                }
                                            }}
                                        >
                                            Force Start
                                        </button>
                                    )}
                                    <button 
                                        className={`ew-b b-pri ${isLoading === rec._id ? 'loading' : ''}`} 
                                        onClick={(e) => handleAdvance(e, rec)}
                                        disabled={isLoading === rec._id || (rec.executionState === 'BLOCKED') || rec.status === 'REVIEW'}
                                    >
                                        {isLoading === rec._id ? <Activity size={12} className="spin" /> : <Play size={12} />}
                                        Move to Next Stage
                                    </button>
                                <button className="ew-b" onClick={() => onSelectBlock?.(rec)}><Info size={12} /> Details</button>
                            </div>
                        </div>
                    )}

                    {/* Active Assignments Header */}
                    <div className="ew-sh"><Activity size={14} /> Active Assignments ({active.length})</div>
                    
                    {!active.length && (
                        <div className="ew-empty">
                            <Zap size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                            <div>Queue clear. No active execution required.</div>
                        </div>
                    )}

                    {/* Refactored Assignment Cards */}
                    {active.map(b => {
                        const sla = calculateSLA(b);
                        const progress = calculateProgress(b);
                        const pressure = calculatePressureIndex(b, blocks);
                        const health = calculateHealth(b, blocks);
                        const execState = b.executionState || 'IN_PROGRESS';
                        
                        const dependencies = b.dependencies || [];
                        const readyDeps = dependencies.filter(d => {
                            const dep = typeof d === 'string' ? blocks.find(w => w._id === d) : d;
                            return dep?.status === 'COMPLETED';
                        }).length;
                        const isCurrentlyExecuting = isLoading === b._id;

                        return (
                            <div key={b._id} className={`ew-wf ${(execState || 'normal').toLowerCase()}`} onClick={() => onSelectBlock?.(b)}>
                                <div className="ew-wf-header">
                                    <div className="ew-wf-name">
                                        {b.name}
                                        {b.isExecuting && <span className="ew-pulse-ready" style={{ background: 'var(--amber)' }} />}
                                    </div>
                                    <div className="ew-wf-badges">
                                        <span className={`ew-t ${b.status === 'REVIEW' ? 't-pur' : 't-blu'}`}>{b.status.replace('_', ' ')}</span>
                                        <span className={`ew-t ${health === 'CRITICAL' || health === 'SEVERE' ? 't-red' : health === 'RISK' ? 't-amb' : 't-grn'}`}>
                                            {execState === 'BLOCKED' ? 'BLOCKED' : health}
                                        </span>
                                        {b.isExecuting && <span className="ew-t t-amb" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>EXECUTING</span>}
                                    </div>
                                </div>
                                <div className="ew-wf-body">
                                    {/* Workflow Stepper */}
                                    <div className="ew-wf-stepper" style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0 24px', padding: '0 10px' }}>
                                        {WORKFLOW_ORDER.map((s, idx) => {
                                            const currIdx = WORKFLOW_ORDER.indexOf(b.status);
                                            const isDone = idx < currIdx || b.status === 'COMPLETED';
                                            const isCurrent = idx === currIdx && b.status !== 'COMPLETED';
                                            
                                            return (
                                                <React.Fragment key={s}>
                                                    <div className="ew-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', zIndex: 2, flex: 1 }}>
                                                        <div 
                                                            className={`ew-step-dot ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                                                            style={{
                                                                width: 14,
                                                                height: 14,
                                                                borderRadius: '50%',
                                                                background: isDone ? '#16a34a' : isCurrent ? 'var(--accent)' : 'var(--border-light)',
                                                                border: isCurrent ? '3px solid white' : 'none',
                                                                boxShadow: isCurrent ? '0 0 0 2px var(--accent)' : 'none',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: '0.3s'
                                                            }}
                                                        >
                                                            {isDone && <CheckCircle2 size={10} color="white" />}
                                                        </div>
                                                        <div style={{ fontSize: 8, fontWeight: 800, color: isCurrent ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', whiteSpace: 'nowrap', position: 'absolute', top: 20 }}>
                                                            {s.replace('_', ' ')}
                                                        </div>
                                                    </div>
                                                    {idx < WORKFLOW_ORDER.length - 1 && (
                                                        <div className="ew-step-line" style={{ flex: 1, height: 2, background: isDone ? '#16a34a' : 'var(--border-light)', margin: '0 -30px', position: 'relative', top: -10, zIndex: 1, transition: '0.3s' }} />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 24, marginTop: 24 }}>
                                        <div>
                                            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Current Objective</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
                                                {execState === 'BLOCKED' ? `Execution halted. Waiting for ${dependencies.length - readyDeps} upstream dependencies.` :
                                                 b.status === 'IN_PROGRESS' ? 'Complete layout routing & parasitic extraction.' : 
                                                 b.status === 'DRC' ? 'Resolve geometry violations and verify metal density.' :
                                                 b.status === 'LVS' ? 'Synchronize schematic netlist with physical layout.' :
                                                 b.status === 'REVIEW' ? 'Pending final technical review for tapeout readiness.' : 'Begin execution setup.'}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Stage Telemetry</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}><Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />{formatDuration(sla.actualHours)}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: b.pressureScore > 70 ? 'var(--red)' : 'var(--text-secondary)' }}><Activity size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />{b.pressureScore || 0}/100</span>
                                                </div>
                                            </div>
                                            {dependencies.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Dependency Lock</div>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: execState === 'BLOCKED' ? '#dc2626' : 'var(--text-secondary)' }}>
                                                        <Layers size={11} style={{ marginRight: 4 }} /> {readyDeps}/{dependencies.length} Verified
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="ew-wf-footer" onClick={e => e.stopPropagation()}>
                                    <button 
                                        className="ew-b" 
                                        style={{ marginRight: 'auto' }}
                                        onClick={() => onSelectBlock?.(b)}
                                    >
                                        <MessageSquare size={12} /> Notes
                                    </button>
                                    {(b.status === 'DRC' || b.status === 'LVS') && (
                                        <div style={{ marginRight: 12 }}>
                                            {((b.status === 'DRC' && b.drcProof?.content) || (b.status === 'LVS' && b.lvsProof?.content)) ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 10, fontWeight: 700 }}>
                                                    <CheckCircle2 size={12} /> Proof Attached
                                                </div>
                                            ) : (
                                                <label className={`ew-b ${isUploading === `${b._id}_${b.status}` ? 'loading' : ''}`} style={{ cursor: 'pointer', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px dashed #f59e0b' }}>
                                                    {isUploading === `${b._id}_${b.status}` ? <Activity size={12} className="spin" /> : <Upload size={12} />} 
                                                    {isUploading === `${b._id}_${b.status}` ? 'Uploading...' : `Upload ${b.status} .txt`}
                                                    <input type="file" accept=".txt" onChange={(e) => handleFileUpload(e, b._id, b.status)} hidden disabled={isUploading} />
                                                </label>
                                            )}
                                        </div>
                                    )}

                                    {b.escalated && <span className="ew-t t-red" style={{ marginRight: 8 }}>Escalated</span>}

                                     <div style={{ display: 'flex', gap: 8 }}>
                                        {execState === 'BLOCKED' && (
                                            <button 
                                                className="ew-b" 
                                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #fecdd3' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm("CRITICAL: Proceeding 'At Risk' skips dependency validation. This action will be logged. Continue?")) {
                                                        onResumeWorkflow?.(b._id, true);
                                                    }
                                                }}
                                            >
                                                Force Start
                                            </button>
                                        )}
                                        <button 
                                            className={`ew-b b-pri ${isCurrentlyExecuting ? 'loading' : ''} ${((b.status === 'DRC' && !b.drcProof?.content) || (b.status === 'LVS' && !b.lvsProof?.content)) ? 'blocked-action' : ''}`} 
                                            onClick={(e) => handleAdvance(e, b)}
                                            disabled={isCurrentlyExecuting || execState === 'BLOCKED' || b.status === 'REVIEW' || ((b.status === 'DRC' && !b.drcProof?.content) || (b.status === 'LVS' && !b.lvsProof?.content))}
                                        >
                                            {isCurrentlyExecuting ? <Activity size={12} className="spin" /> : <Play size={12} />}
                                            Move to Next Stage
                                        </button>
                                     </div>
                                </div>
                                {uploadSuccess?.id === b._id && (
                                    <div style={{ 
                                        padding: '8px 18px', 
                                        background: '#16a34a', 
                                        color: 'white', 
                                        fontSize: 11, 
                                        fontWeight: 700, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 8,
                                        animation: 'slideUp 0.3s ease'
                                    }}>
                                        <CheckCircle2 size={12} /> {uploadSuccess.message}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Completed Section: Subtle & Compact */}
                    {completed.length > 0 && (
                        <>
                            <div className="ew-sh" style={{ marginTop: 12 }}><CheckCircle2 size={14} /> Recently Completed ({completed.length})</div>
                            {completed.slice(0, 3).map(b => (
                                <div key={b._id} className="ew-wf" style={{ opacity: 0.6 }} onClick={() => onSelectBlock?.(b)}>
                                    <div className="ew-wf-header" style={{ background: 'transparent' }}>
                                        <div className="ew-wf-name" style={{ fontSize: 13 }}>{b.name}</div>
                                        <span className="ew-t t-grn">Complete</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Sidebar: Operational Intelligence Rail */}
                <div className="ew-side">
                    {overdue.length > 0 && (
                        <div className="ew-sp">
                            <div className="ew-sp-title"><ShieldAlert size={12} className="text-danger" /> SLA Risk Assessment</div>
                            <div className="ew-sp-content">
                                {overdue.slice(0, 3).map(b => (
                                    <div key={b._id} className="ew-sp-row" onClick={() => onSelectBlock?.(b)} style={{ cursor: 'pointer' }}>
                                        <span>{b.name}</span>
                                        <span className="text-danger" style={{ fontWeight: 800 }}>+{formatDuration(calculateSLA(b).delayHours)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="ew-sp">
                        <div className="ew-sp-title"><Clock size={12} /> Dependency Waitlist</div>
                        <div className="ew-sp-content">
                            {blocked.length > 0 ? blocked.slice(0, 3).map(b => {
                                const critDep = b.dependencies?.find(d => (typeof d === 'string' ? blocks.find(w => w._id === d) : d)?.healthStatus === 'CRITICAL');
                                const depName = typeof critDep === 'string' ? blocks.find(w => w._id === critDep)?.name : critDep?.name;
                                return (
                                    <div key={b._id} className="ew-sp-row" onClick={() => onSelectBlock?.(b)} style={{ cursor: 'pointer' }}>
                                        <span>{b.name}</span>
                                        <span className="text-ter" style={{ fontSize: 10 }}>← {depName || 'Upstream'}</span>
                                    </div>
                                );
                            }) : (
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No blocking dependencies.</div>
                            )}
                        </div>
                    </div>

                    <div className="ew-sp">
                        <div className="ew-sp-title"><Activity size={12} /> Queue Pressure</div>
                        <div className="ew-sp-content">
                            {['IN_PROGRESS', 'DRC', 'LVS', 'REVIEW'].map(s => {
                                const count = active.filter(b => b.status === s).length;
                                if (!count) return null;
                                return (
                                    <div key={s} className="ew-sp-row">
                                        <span>{s.replace('_', ' ')}</span>
                                        <span className="ew-t t-blu">{count} Nodes</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="ew-sp" style={{ background: 'var(--bg)', borderStyle: 'dashed' }}>
                        <div className="ew-sp-title"><Zap size={12} /> Productivity Index</div>
                        <div className="ew-sp-content">
                            <div className="ew-sp-row">
                                <span>Throughput</span>
                                <span style={{ fontWeight: 800 }}>{completed.length} / {myBlocks.length}</span>
                            </div>
                            <div className="ew-sp-row">
                                <span>Avg Velocity</span>
                                <span style={{ fontWeight: 800 }}>{velocity}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngMyWork;
