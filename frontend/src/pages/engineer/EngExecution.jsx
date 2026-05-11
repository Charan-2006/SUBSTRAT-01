import React, { useMemo, useState } from 'react';
import { 
    Activity, ChevronRight, Play, FileText, AlertTriangle, 
    Layers, Clock, ShieldAlert, CheckCircle2 
} from 'lucide-react';
import { 
    calculateProgress, 
    calculateHealth, 
    calculateSLA, 
    formatDuration 
} from '../../utils/workflowEngine';

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
    const [expandedBlockId, setExpandedBlockId] = useState(null);
    const [isExecuting, setIsExecuting] = useState(null);
    const WORKFLOW_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

    const handleAdvance = async (e, block) => {
        e.stopPropagation();
        if (isExecuting === block._id) return;

        const currentIndex = WORKFLOW_ORDER.indexOf(block.status);
        if (currentIndex === -1 || currentIndex >= WORKFLOW_ORDER.length - 2) return;

        const nextStatus = WORKFLOW_ORDER[currentIndex + 1];
        
        setIsExecuting(block._id);
        try {
            await onUpdateStatus?.(block._id, nextStatus);
            onSelectBlock?.(block);
        } catch (err) {
            console.error("Advance stage error:", err);
        } finally {
            setIsExecuting(null);
        }
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
                                                            {stage !== 'COMPLETED' && stage !== 'REVIEW' && (
                                                                 <button 
                                                                     className={`ew-b b-pri ${isExecuting === b._id ? 'loading' : ''}`}
                                                                     onClick={(e) => handleAdvance(e, b)}
                                                                     disabled={isExecuting === b._id || b.executionState === 'BLOCKED'}
                                                                 >
                                                                     {isExecuting === b._id ? <Activity size={12} className="spin" /> : <Play size={12} />} 
                                                                     Move to Next Stage
                                                                 </button>
                                                             )}
                                                        </div>
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
