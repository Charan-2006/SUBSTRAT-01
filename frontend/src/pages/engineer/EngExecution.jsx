import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { 
    Activity, ChevronRight, Play, FileText, AlertTriangle, 
    Layers, Clock, ShieldAlert, CheckCircle2, Upload
} from 'lucide-react';
import { 
    calculateProgress, 
    calculateHealth, 
    calculateSLA, 
    formatDuration 
} from '../../utils/workflowEngine';
import { useOrchestration } from '../../context/OrchestrationContext';

const STAGES = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
const STAGE_COLORS = {
    NOT_STARTED: '#64748b',
    IN_PROGRESS: '#2563eb',
    DRC: '#d97706',
    LVS: '#f97316',
    REVIEW: '#7c3aed',
    COMPLETED: '#16a34a'
};

const EngExecution = ({ myBlocks = [], onSelectBlock, onUpdateStatus, onResumeWorkflow, onEscalate, blocks = [] }) => {
    const { uploadProof } = useOrchestration();
    const [expandedBlockId, setExpandedBlockId] = useState(null);
    const [isExecuting, setIsExecuting] = useState(null);
    const [isUploading, setIsUploading] = useState(null); // blockId_stage
    const [uploadSuccess, setUploadSuccess] = useState(null); // { id: blockId, message: '' }
    const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

    const handleAdvance = async (e, block) => {
        e.stopPropagation();
        if (isExecuting === block._id) return;

        const currentIndex = WORKFLOW_ORDER.indexOf(block.status);
        if (currentIndex === -1 || currentIndex >= WORKFLOW_ORDER.length - 2) return;

        // Validation for Proof of Work
        const needsProof = (block.status === 'DRC' && !block.drcProof?.content) || (block.status === 'LVS' && !block.lvsProof?.content);
        if (needsProof) {
            toast.error(`Please upload the ${block.status} verification report first.`);
            return;
        }

        const nextStatus = WORKFLOW_ORDER[currentIndex + 1];
        
        setIsExecuting(block._id);
        try {
            await onUpdateStatus?.(block._id, nextStatus);
        } catch (err) {
            console.error("Advance stage error:", err);
        } finally {
            setIsExecuting(null);
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

    const lanes = useMemo(() => {
        const groups = {};
        STAGES.forEach(s => groups[s] = []);
        myBlocks.forEach(b => {
            if (groups[b.status]) groups[b.status].push(b);
        });
        return groups;
    }, [myBlocks]);

    return (
        <div className="ew-page-content fade-in">
            <div className="ew-sh"><Activity size={14} /> Execution Console ({myBlocks.length})</div>
            
            <div className="ew-col">
                {STAGES.map(stage => {
                    const items = lanes[stage] || [];
                    return (
                        <div key={stage} className="ew-lane" style={{ marginBottom: 24 }}>
                            <div className="ew-lane-hdr" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 8, marginBottom: 12 }}>
                                <div className="ew-lane-dot" style={{ background: STAGE_COLORS[stage] }} />
                                <div className="ew-lane-name" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.replace('_', ' ')}</div>
                                <div className="ew-lane-cnt">{items.length}</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {items.map(b => {
                                    const isExpanded = expandedBlockId === b._id;
                                    const progress = calculateProgress(b);
                                    const health = calculateHealth(b, blocks);
                                    const sla = calculateSLA(b);
                                    const dependencies = b.dependencies || [];
                                    const readyDeps = dependencies.filter(d => {
                                        const dep = typeof d === 'string' ? blocks.find(w => w._id === d) : d;
                                        return dep?.status === 'COMPLETED';
                                    }).length;

                                    return (
                                        <div 
                                            key={b._id} 
                                            className={`ew-wf ${stage === 'COMPLETED' ? 'done' : ''}`} 
                                            onClick={() => onSelectBlock?.(b)}
                                        >
                                            <div className="ew-wf-header">
                                                <div className="ew-wf-name">{b.name}</div>
                                                <div className="ew-wf-badges">
                                                    <span className={`ew-t ${health === 'CRITICAL' || health === 'SEVERE' ? 't-red' : health === 'RISK' ? 't-amb' : 't-grn'}`}>
                                                        {health}
                                                    </span>
                                                    <ChevronRight 
                                                        size={14} 
                                                        style={{ 
                                                            color: 'var(--text-tertiary)', 
                                                            transform: isExpanded ? 'rotate(90deg)' : 'none', 
                                                            transition: '0.2s' 
                                                        }} 
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            setExpandedBlockId(isExpanded ? null : b._id);
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="ew-wf-body" style={{ paddingBottom: isExpanded ? 0 : 16 }}>
                                                <div className="ew-wf-progress-row">
                                                    <div className="ew-bar">
                                                        <div 
                                                            className="ew-bar-fill" 
                                                            style={{ 
                                                                width: `${progress}%`,
                                                                background: stage === 'COMPLETED' ? '#16a34a' : 
                                                                            health === 'CRITICAL' || health === 'SEVERE' ? '#ef4444' : 
                                                                            health === 'RISK' ? '#f59e0b' : 'var(--accent)'
                                                            }} 
                                                        />
                                                    </div>
                                                    <div className="ew-bar-pct">{progress}%</div>
                                                    <div className="ew-bar-time">{formatDuration(sla.actualHours)}</div>
                                                </div>

                                                <div className="ew-wf-meta">
                                                    {dependencies.length > 0 && <span><Layers size={11} /> {readyDeps}/{dependencies.length} Deps</span>}
                                                    {b.rejectionCount > 0 && <span className="text-danger"><AlertTriangle size={11} /> {b.rejectionCount} Rejections</span>}
                                                </div>

                                                {isExpanded && (
                                                    <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
                                                            <div>
                                                                <div style={{ color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', fontSize: 9, marginBottom: 4 }}>Complexity</div>
                                                                <div style={{ fontWeight: 600 }}>{b.complexity || 'STANDARD'}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', fontSize: 9, marginBottom: 4 }}>Type</div>
                                                                <div style={{ fontWeight: 600 }}>{b.type || 'Semiconductor Core'}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ marginTop: 12 }}>
                                                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', fontSize: 9, marginBottom: 4 }}>Execution Timeline</div>
                                                            <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                                                                {sla.delayHours > 0 ? (
                                                                    <span className="text-danger">Critical slippage: +{formatDuration(sla.delayHours)} beyond estimated SLA.</span>
                                                                ) : (
                                                                    <span className="text-success">Executing within nominal SLA parameters.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="ew-wf-footer" style={{ background: 'transparent', border: 'none', padding: '12px 0 0' }} onClick={e => e.stopPropagation()}>
                                                            <button className="ew-b" onClick={() => onSelectBlock?.(b)}><FileText size={12} /> View Details</button>
                                                            
                                                            {(b.status === 'DRC' || b.status === 'LVS') && (
                                                                <div style={{ marginLeft: 'auto', marginRight: 8 }}>
                                                                    {((b.status === 'DRC' && b.drcProof?.content) || (b.status === 'LVS' && b.lvsProof?.content)) ? (
                                                                        <div className="proof-status-pill">
                                                                            <CheckCircle2 size={10} /> Proof Attached
                                                                        </div>
                                                                    ) : (
                                                                        <label className={`ew-b ${isUploading === `${b._id}_${b.status}` ? 'loading' : ''}`} style={{ cursor: 'pointer', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px dashed #f59e0b' }}>
                                                                            {isUploading === `${b._id}_${b.status}` ? <Activity size={12} className="spin" /> : <Upload size={12} />} 
                                                                            {isUploading === `${b._id}_${b.status}` ? 'Uploading...' : `Upload ${b.status}`}
                                                                            <input type="file" accept=".txt" onChange={(e) => handleFileUpload(e, b._id, b.status)} hidden disabled={isUploading} />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {stage !== 'COMPLETED' && stage !== 'REVIEW' && (
                                                                 <div style={{ display: 'flex', gap: 6, marginLeft: (b.status === 'DRC' || b.status === 'LVS') ? 0 : 'auto' }}>
                                                                     {b.executionState === 'BLOCKED' && (
                                                                        <button 
                                                                            className="ew-b" 
                                                                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #fecdd3' }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (window.confirm("CRITICAL: Force starting skips dependency checks. Proceed at risk?")) {
                                                                                    onResumeWorkflow?.(b._id, true);
                                                                                }
                                                                            }}
                                                                        >
                                                                            Force Start
                                                                        </button>
                                                                     )}
                                                                     <button 
                                                                         className={`ew-b b-pri ${isExecuting === b._id ? 'loading' : ''} ${((b.status === 'DRC' && !b.drcProof?.content) || (b.status === 'LVS' && !b.lvsProof?.content)) ? 'blocked-action' : ''}`}
                                                                         onClick={(e) => handleAdvance(e, b)}
                                                                         disabled={isExecuting === b._id || b.executionState === 'BLOCKED' || ((b.status === 'DRC' && !b.drcProof?.content) || (b.status === 'LVS' && !b.lvsProof?.content))}
                                                                     >
                                                                         {isExecuting === b._id ? <Activity size={12} className="spin" /> : <Play size={12} />} 
                                                                         Move to Next Stage
                                                                     </button>
                                                                 </div>
                                                            )}
                                                        </div>
                                                        {uploadSuccess?.id === b._id && (
                                                            <div style={{ 
                                                                padding: '6px 12px', 
                                                                background: '#16a34a', 
                                                                color: 'white', 
                                                                fontSize: 10, 
                                                                fontWeight: 700, 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: 6,
                                                                marginTop: 12,
                                                                borderRadius: 4,
                                                                animation: 'slideUp 0.3s ease'
                                                            }}>
                                                                <CheckCircle2 size={10} /> {uploadSuccess.message}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {!items.length && <div className="ew-empty" style={{ padding: 12 }}>No nodes in {stage.replace('_', ' ')}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EngExecution;
