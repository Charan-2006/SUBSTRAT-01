import React, { useState, useMemo } from 'react';
import { Search, Plus, FileText, ChevronRight, ChevronLeft, Save, Trash2, BookOpen, Shield, AlertTriangle, CheckCircle2, Link2, Activity, Zap, Clock, User, ArrowRight, ExternalLink } from 'lucide-react';
import './KnowledgeBase.css';

// --- KNOWLEDGE ENGINE (RE-BUILT) ---
function deriveKnowledge(blocks, engineers) {
    const docs = [];
    
    blocks.forEach(b => {
        const engName = b.assignedEngineer?.displayName || 'Unassigned';

        // 1. REJECTION & REVIEW FEEDBACK (from rejectionHistory)
        (b.rejectionHistory || []).forEach((rej, i) => {
            docs.push({
                id: `rej_${b._id}_${i}`,
                title: `${b.name} — Rejection Analysis #${i+1}`,
                category: 'review-feedback',
                type: 'Rejection Record',
                timestamp: rej.timestamp,
                blockName: b.name,
                blockId: b._id,
                stage: rej.stage,
                actor: 'Management',
                engineer: engName,
                summary: `Workflow rejected during ${rej.stage.replace('_',' ')} stage. Severity: ${rej.severity}. Reason: ${rej.reason}`,
                comments: rej.reason,
                context: { severity: rej.severity, stage: rej.stage },
                impact: rej.severity === 'HIGH' ? 'high' : 'medium'
            });
        });

        // 2. APPROVAL & SIGNOFF INTELLIGENCE (from approvalHistory)
        (b.approvalHistory || []).forEach((app, i) => {
            docs.push({
                id: `app_${b._id}_${i}`,
                title: `${b.name} — Approval Sign-off`,
                category: 'signoff',
                type: 'Approval Record',
                timestamp: app.timestamp,
                blockName: b.name,
                blockId: b._id,
                stage: app.stage,
                actor: app.reviewer?.displayName || 'Manager',
                engineer: engName,
                summary: `Stage ${app.stage.replace('_',' ')} cleared by management. Sign-off recorded for production path.`,
                comments: app.comments || 'No additional comments provided.',
                context: { reviewer: app.reviewer?.displayName },
                impact: 'low'
            });
        });

        // 3. DRC/LVS VERIFICATION (from stageHistory)
        (b.stageHistory || []).forEach((stg, i) => {
            if (['DRC', 'LVS'].includes(stg.stage)) {
                docs.push({
                    id: `ver_${b._id}_${i}`,
                    title: `${b.name} — ${stg.stage} Execution Log`,
                    category: 'verification',
                    type: 'Verification Log',
                    timestamp: stg.endTime || stg.startTime,
                    blockName: b.name,
                    blockId: b._id,
                    stage: stg.stage,
                    actor: engName,
                    engineer: engName,
                    summary: `${stg.stage} verification cycle ${stg.endTime ? 'completed' : 'initiated'}. ${stg.durationHours ? `Cycle duration: ${stg.durationHours.toFixed(2)}h.` : 'Ongoing execution.'}`,
                    context: { duration: stg.durationHours, state: stg.endTime ? 'COMPLETED' : 'IN_PROGRESS' },
                    impact: stg.durationHours > 24 ? 'high' : 'medium'
                });
            }
        });

        // 4. DEPENDENCY & ESCALATION INTELLIGENCE
        if (b.escalated && b.lastEscalatedAt) {
            docs.push({
                id: `esc_${b._id}`,
                title: `${b.name} — Escalation Report`,
                category: 'dependencies',
                type: 'Escalation Event',
                timestamp: b.lastEscalatedAt,
                blockName: b.name,
                blockId: b._id,
                stage: b.status,
                actor: 'System/Manager',
                engineer: engName,
                summary: `Workflow escalated due to health score drop or manual intervention. Health: ${b.healthStatus}.`,
                context: { health: b.healthStatus, score: b.healthScore },
                impact: 'high'
            });
        }

        if ((b.dependencies || []).length > 0) {
            const blocked = b.dependencies.filter(d => d.status !== 'COMPLETED' || d.healthStatus === 'CRITICAL');
            if (blocked.length > 0) {
                docs.push({
                    id: `dep_${b._id}`,
                    title: `${b.name} — Dependency Blockage`,
                    category: 'dependencies',
                    type: 'Dependency Log',
                    timestamp: b.updatedAt,
                    blockName: b.name,
                    blockId: b._id,
                    stage: b.status,
                    actor: 'System',
                    engineer: engName,
                    summary: `Execution stalled by ${blocked.length} upstream dependency${blocked.length > 1 ? 's' : ''}: ${blocked.map(d => d.name).join(', ')}.`,
                    context: { blockedCount: blocked.length },
                    impact: 'medium'
                });
            }
        }

        // 5. REASSIGNMENT MEMORY
        (b.assignmentHistory || []).forEach((asg, i) => {
            if (i > 0) { // Only reassignments
                const eng = engineers.find(e => (e._id || e.id) === asg.engineer);
                docs.push({
                    id: `asg_${b._id}_${i}`,
                    title: `${b.name} — Ownership Transfer`,
                    category: 'dependencies',
                    type: 'Assignment Update',
                    timestamp: asg.assignedAt,
                    blockName: b.name,
                    blockId: b._id,
                    stage: b.status,
                    actor: 'Manager',
                    engineer: eng?.displayName || 'New Engineer',
                    summary: `Workflow ownership transferred to ${eng?.displayName || 'New Engineer'}. Handover recorded at ${b.status} stage.`,
                    impact: 'low'
                });
            }
        });
    });

    return docs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
}

const COLLECTIONS = [
    {id:'verification',label:'DRC/LVS Verification',icon:Shield,color:'#f59e0b',bg:'rgba(245,158,11,0.08)'},
    {id:'review-feedback',label:'Review & Rejection Feedback',icon:AlertTriangle,color:'#ef4444',bg:'rgba(239,68,68,0.08)'},
    {id:'dependencies',label:'Dependency Intelligence',icon:Link2,color:'#3b82f6',bg:'rgba(59,130,246,0.08)'},
    {id:'signoff',label:'Signoff Intelligence',icon:CheckCircle2,color:'#22c55e',bg:'rgba(34,197,94,0.08)'},
];

const KnowledgeBase = ({ blocks=[], engineers=[] }) => {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [expandedDocs, setExpandedDocs] = useState({});

    const allDocs = useMemo(() => deriveKnowledge(blocks, engineers), [blocks, engineers]);

    const filteredDocs = useMemo(() => {
        let docs = allDocs;
        if (search.trim()) {
            const q = search.toLowerCase();
            docs = docs.filter(d => 
                d.title.toLowerCase().includes(q) ||
                d.summary.toLowerCase().includes(q) ||
                d.blockName.toLowerCase().includes(q) ||
                d.engineer.toLowerCase().includes(q) ||
                (d.comments && d.comments.toLowerCase().includes(q)) ||
                d.stage.toLowerCase().includes(q)
            );
        }
        if (activeCategory !== 'All') {
            docs = docs.filter(d => d.category === activeCategory);
        }
        return docs;
    }, [allDocs, search, activeCategory]);

    const toggleExpand = (id) => {
        setExpandedDocs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const grouped = useMemo(() => {
        const g = {};
        COLLECTIONS.forEach(c => g[c.id] = []);
        filteredDocs.forEach(d => {
            if (g[d.category]) g[d.category].push(d);
        });
        return g;
    }, [filteredDocs]);

    // Right-side panels
    const linkedStats = useMemo(() => {
        const stats = {};
        allDocs.forEach(d => {
            if (!stats[d.blockName]) stats[d.blockName] = { name: d.blockName, count: 0, lastEvent: d.type };
            stats[d.blockName].count++;
        });
        return Object.values(stats).sort((a,b) => b.count - a.count).slice(0, 8);
    }, [allDocs]);

    const recentActivity = useMemo(() => allDocs.slice(0, 10), [allDocs]);

    return (
        <div className="kb-container fade-in">
            <div className="kb-command">
                <div className="kb-search">
                    <Search size={13} className="kb-search-icon" />
                    <input 
                        className="kb-search-input" 
                        placeholder="Search intelligence by workflow, engineer, rejection reason, or stage..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="kb-filters">
                    <button className={`kb-filter ${activeCategory === 'All' ? 'active' : ''}`} onClick={() => setActiveCategory('All')}>All Memory</button>
                    {COLLECTIONS.map(c => (
                        <button 
                            key={c.id} 
                            className={`kb-filter ${activeCategory === c.id ? 'active' : ''}`} 
                            onClick={() => setActiveCategory(c.id)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <span className="kb-count">{filteredDocs.length} Records</span>
            </div>

            <div className="kb-layout">
                <div className="kb-main">
                    {COLLECTIONS.map(c => {
                        const items = grouped[c.id] || [];
                        if (items.length === 0 && activeCategory !== 'All') return null;
                        
                        return (
                            <div key={c.id} className="kb-collection-section">
                                <div className="kb-collection-title">
                                    <c.icon size={14} color={c.color} />
                                    <span>{c.label}</span>
                                    <span className="kb-badge">{items.length}</span>
                                </div>
                                <div className="kb-doc-grid">
                                    {items.map(doc => {
                                        const isExpanded = expandedDocs[doc.id];
                                        return (
                                            <div key={doc.id} className={`kb-doc-card ${isExpanded ? 'expanded' : ''} impact-${doc.impact}`} onClick={() => toggleExpand(doc.id)}>
                                                <div className="kb-doc-header">
                                                    <div className="kb-doc-type-icon">
                                                        {doc.category === 'verification' && <Shield size={16} />}
                                                        {doc.category === 'review-feedback' && <AlertTriangle size={16} />}
                                                        {doc.category === 'dependencies' && <Link2 size={16} />}
                                                        {doc.category === 'signoff' && <CheckCircle2 size={16} />}
                                                    </div>
                                                    <div className="kb-doc-info">
                                                        <div className="kb-doc-title-row">
                                                            <span className="kb-doc-title">{doc.title}</span>
                                                            <span className={`kb-impact-tag tag-${doc.impact}`}>{doc.impact}</span>
                                                        </div>
                                                        <div className="kb-doc-subtitle">
                                                            <Clock size={10} /> {new Date(doc.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            <span className="divider">•</span>
                                                            <User size={10} /> {doc.engineer}
                                                            <span className="divider">•</span>
                                                            <span className="kb-stage-text">{doc.stage.replace('_',' ')}</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className={`kb-expand-arrow ${isExpanded ? 'open' : ''}`} />
                                                </div>
                                                
                                                <div className="kb-doc-preview">
                                                    <p>{doc.summary.substring(0, 100)}{doc.summary.length > 100 ? '...' : ''}</p>
                                                </div>

                                                {isExpanded && (
                                                    <div className="kb-doc-content">
                                                        <div className="kb-content-section">
                                                            <div className="kb-section-label">Summary</div>
                                                            <p className="kb-summary-text">{doc.summary}</p>
                                                        </div>
                                                        
                                                        {doc.comments && (
                                                            <div className="kb-content-section">
                                                                <div className="kb-section-label">Manager Comments</div>
                                                                <div className="kb-comment-bubble">{doc.comments}</div>
                                                            </div>
                                                        )}

                                                        <div className="kb-content-footer">
                                                            <div className="kb-linked-workflow">
                                                                <Zap size={10} />
                                                                <span>Workflow: <strong>{doc.blockName}</strong></span>
                                                            </div>
                                                            <div className="kb-actor-tag">
                                                                <User size={10} />
                                                                <span>Logged by: {doc.actor}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="kb-action-bar">
                                                            <button className="kb-action-link" onClick={(e) => e.stopPropagation()}>
                                                                <ExternalLink size={12} /> View Workflow
                                                            </button>
                                                            <button className="kb-action-link" onClick={(e) => e.stopPropagation()}>
                                                                <FileText size={12} /> Full Report
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {items.length === 0 && (
                                        <div className="kb-empty-collection">
                                            No {c.label} records found for current filters.
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="kb-side">
                    <div className="kb-panel">
                        <div className="kb-panel-title"><Link2 size={10} /> Workflow-Linked Memory</div>
                        <div className="kb-panel-list">
                            {linkedStats.map(stat => (
                                <div key={stat.name} className="kb-linked-item" onClick={() => setSearch(stat.name)}>
                                    <div className="kb-linked-name">{stat.name}</div>
                                    <div className="kb-linked-meta">
                                        {stat.count} records <span className="divider">•</span> Last: {stat.lastEvent}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="kb-panel">
                        <div className="kb-panel-title"><Activity size={10} /> Recent Workflow Activity</div>
                        <div className="kb-activity-stream">
                            {recentActivity.map(doc => (
                                <div key={doc.id} className="kb-activity-item" onClick={() => {
                                    setExpandedDocs({ [doc.id]: true });
                                    setSearch(doc.blockName);
                                }}>
                                    <div className="kb-activity-dot" style={{ background: doc.impact === 'high' ? 'var(--red)' : 'var(--accent)' }} />
                                    <div className="kb-activity-body">
                                        <div className="kb-activity-title"><strong>{doc.blockName}</strong> {doc.type}</div>
                                        <div className="kb-activity-time">{new Date(doc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="kb-panel intelligence-summary">
                        <div className="kb-panel-title"><Zap size={10} /> Operational Insights</div>
                        <div className="kb-insight-card">
                            <div className="kb-insight-value">{allDocs.filter(d => d.category === 'review-feedback').length}</div>
                            <div className="kb-insight-label">Rejection Cycles Analyzed</div>
                        </div>
                        <div className="kb-insight-card">
                            <div className="kb-insight-value">{allDocs.filter(d => d.category === 'signoff').length}</div>
                            <div className="kb-insight-label">Production Sign-offs Memory</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBase;
