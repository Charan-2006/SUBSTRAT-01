import React, { useState, useMemo } from 'react';
import { Search, Plus, FileText, ChevronRight, ChevronLeft, Save, Trash2, BookOpen, Shield, AlertTriangle, CheckCircle2, Link2, Activity, Zap, Clock } from 'lucide-react';
import './KnowledgeBase.css';

// Derive engineering docs from real workflow data
function deriveKnowledge(blocks) {
    const docs = [];
    const now = Date.now();
    blocks.forEach(b => {
        // Rejection analysis docs
        if (b.rejectionCount > 0) {
            docs.push({
                id:`rej_${b._id}`, title:`${b.name} — Rejection Analysis`, domain:'review-feedback',
                excerpt:`${b.rejectionCount} rejection${b.rejectionCount!==1?'s':''} documented.${b.rejectionReason?' Last: '+b.rejectionReason:' Review feedback pending.'}`,
                linkedBlock:b._id, blockName:b.name, stage:b.status, health:b.healthStatus,
                updatedAt:b.updatedAt||b.createdAt, type:'analysis', impact:b.rejectionCount>=2?'high':'medium',
                engineer:b.assignedEngineer?.displayName
            });
        }
        // Stage-specific verification notes
        if (['DRC','LVS'].includes(b.status)) {
            const stg = b.status==='DRC'?'DRC Verification':'LVS Signoff';
            const hist = (b.stageHistory||[]).find(h=>h.stage===b.status);
            docs.push({
                id:`ver_${b._id}`, title:`${b.name} — ${stg} Notes`, domain:'verification',
                excerpt:`Currently in ${stg}. ${hist?.durationHours?`Stage duration: ${hist.durationHours.toFixed(1)}h.`:'In progress.'} ${b.healthStatus==='CRITICAL'?'Critical attention required.':''}`,
                linkedBlock:b._id, blockName:b.name, stage:b.status, health:b.healthStatus,
                updatedAt:b.updatedAt||b.createdAt, type:'verification', impact:b.healthStatus==='CRITICAL'?'high':'medium',
                engineer:b.assignedEngineer?.displayName
            });
        }
        // Dependency notes
        if ((b.dependencies||[]).length > 0) {
            const depNames = b.dependencies.map(d=>d.name||'Unknown').join(', ');
            const blocked = b.dependencies.filter(d=>d.healthStatus==='CRITICAL');
            docs.push({
                id:`dep_${b._id}`, title:`${b.name} — Dependency Map`, domain:'dependencies',
                excerpt:`Dependencies: ${depNames}. ${blocked.length>0?`${blocked.length} blocked upstream.`:'All upstream healthy.'}`,
                linkedBlock:b._id, blockName:b.name, stage:b.status, health:b.healthStatus,
                updatedAt:b.updatedAt||b.createdAt, type:'dependency', impact:blocked.length>0?'high':'low',
                engineer:b.assignedEngineer?.displayName
            });
        }
        // Completed signoff records
        if (b.status==='COMPLETED') {
            docs.push({
                id:`sig_${b._id}`, title:`${b.name} — Signoff Record`, domain:'signoff',
                excerpt:`Tapeout-ready. All verification stages cleared. ${b.rejectionCount>0?`${b.rejectionCount} prior rejections resolved.`:'Clean pass.'}`,
                linkedBlock:b._id, blockName:b.name, stage:b.status, health:b.healthStatus,
                updatedAt:b.updatedAt||b.createdAt, type:'signoff', impact:'low',
                engineer:b.assignedEngineer?.displayName
            });
        }
        // Design guidelines for complex blocks
        if (b.complexity==='COMPLEX' || b.type) {
            docs.push({
                id:`dsg_${b._id}`, title:`${b.name} — Design Constraints`, domain:'design-rules',
                excerpt:`${b.type||'Mixed-signal'} block. Complexity: ${b.complexity||'Standard'}. ${b.status==='IN_PROGRESS'?'Active routing.':''}`,
                linkedBlock:b._id, blockName:b.name, stage:b.status, health:b.healthStatus,
                updatedAt:b.createdAt, type:'guideline', impact:'medium',
                engineer:b.assignedEngineer?.displayName
            });
        }
    });
    return docs;
}

const COLLECTIONS = [
    {id:'verification',label:'DRC/LVS Verification',icon:Shield,color:'#f59e0b',bg:'rgba(245,158,11,0.08)'},
    {id:'review-feedback',label:'Review & Rejection Feedback',icon:AlertTriangle,color:'#ef4444',bg:'rgba(239,68,68,0.08)'},
    {id:'dependencies',label:'Dependency Intelligence',icon:Link2,color:'#3b82f6',bg:'rgba(59,130,246,0.08)'},
    {id:'design-rules',label:'Design Rules & Constraints',icon:BookOpen,color:'#8b5cf6',bg:'rgba(139,92,246,0.08)'},
    {id:'signoff',label:'Signoff Records',icon:CheckCircle2,color:'#22c55e',bg:'rgba(34,197,94,0.08)'},
];
const FILTERS = ['All','Verification','Review','Dependencies','Design','Signoff','High Impact','Linked'];

const KnowledgeBase = ({ blocks=[], engineers=[] }) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');
    const [collapsed, setCollapsed] = useState({});
    const [activeDoc, setActiveDoc] = useState(null);
    const [editContent, setEditContent] = useState('');

    const allDocs = useMemo(()=>deriveKnowledge(blocks),[blocks]);

    const filtered = useMemo(()=>{
        let d = allDocs;
        if(search.trim()){const q=search.toLowerCase();d=d.filter(x=>x.title.toLowerCase().includes(q)||x.excerpt.toLowerCase().includes(q)||x.blockName?.toLowerCase().includes(q));}
        if(filter==='Verification') d=d.filter(x=>x.domain==='verification');
        else if(filter==='Review') d=d.filter(x=>x.domain==='review-feedback');
        else if(filter==='Dependencies') d=d.filter(x=>x.domain==='dependencies');
        else if(filter==='Design') d=d.filter(x=>x.domain==='design-rules');
        else if(filter==='Signoff') d=d.filter(x=>x.domain==='signoff');
        else if(filter==='High Impact') d=d.filter(x=>x.impact==='high');
        else if(filter==='Linked') d=d.filter(x=>x.linkedBlock);
        return d;
    },[allDocs,search,filter]);

    const grouped = useMemo(()=>{
        const g={};COLLECTIONS.forEach(c=>{g[c.id]=[];});
        filtered.forEach(d=>{if(g[d.domain])g[d.domain].push(d);});
        return g;
    },[filtered]);

    // Activity feed
    const activity = useMemo(()=>{
        const ev=[];
        blocks.forEach(b=>{
            (b.stageHistory||[]).forEach(h=>{if(h.startTime)ev.push({time:new Date(h.startTime),html:<><strong>{b.name}</strong> {h.stage.replace('_',' ')} notes updated</>,k:`${b._id}_${h.stage}`});});
            if(b.rejectionCount>0&&b.updatedAt) ev.push({time:new Date(b.updatedAt),html:<><strong>{b.name}</strong> rejection analysis added</>,k:`${b._id}_rej`});
            if(b.status==='COMPLETED'&&b.updatedAt) ev.push({time:new Date(b.updatedAt),html:<><strong>{b.name}</strong> signoff record created</>,k:`${b._id}_sig`});
        });
        return ev.sort((a,b)=>b.time-a.time).slice(0,10);
    },[blocks]);

    // Workflow links for sidebar
    const linkedBlocks = useMemo(()=>{
        const map={};
        allDocs.forEach(d=>{if(d.blockName){if(!map[d.blockName])map[d.blockName]={name:d.blockName,count:0,health:d.health,stage:d.stage};map[d.blockName].count++;}});
        return Object.values(map).sort((a,b)=>b.count-a.count).slice(0,8);
    },[allDocs]);

    // Insights
    const insights = useMemo(()=>{
        const r=[];
        const highImpact=allDocs.filter(d=>d.impact==='high').length;
        if(highImpact>0) r.push(`${highImpact} high-impact document${highImpact!==1?'s':''} require attention.`);
        const rejDocs=allDocs.filter(d=>d.domain==='review-feedback').length;
        if(rejDocs>0) r.push(`${rejDocs} rejection analysis record${rejDocs!==1?'s':''} — review feedback patterns.`);
        const depDocs=allDocs.filter(d=>d.domain==='dependencies'&&d.impact==='high').length;
        if(depDocs>0) r.push(`${depDocs} blocked dependency chain${depDocs!==1?'s':''} documented.`);
        return r.slice(0,4);
    },[allDocs]);

    const fmtDate = d => d?new Date(d).toLocaleDateString([],{month:'short',day:'numeric'}):'—';
    const impactCls = i => i==='high'?'kb-tag-red':i==='medium'?'kb-tag-amber':'kb-tag-green';

    // Viewer
    if(activeDoc) {
        return (
            <div className="kb-container">
                <div className="kb-viewer">
                    <div className="kb-viewer-toolbar">
                        <button className="kb-filter" onClick={()=>setActiveDoc(null)} style={{display:'flex',alignItems:'center',gap:4}}><ChevronLeft size={13}/> Back</button>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <span className={`kb-doc-tag ${impactCls(activeDoc.impact)}`}>{activeDoc.impact} impact</span>
                            <span className="kb-doc-tag kb-tag-gray">{activeDoc.domain}</span>
                        </div>
                    </div>
                    <div className="kb-viewer-title">{activeDoc.title}</div>
                    <div className="kb-viewer-meta">
                        {activeDoc.blockName&&<span className="kb-doc-tag kb-tag-blue">Linked: {activeDoc.blockName}</span>}
                        {activeDoc.stage&&<span className="kb-doc-tag kb-tag-gray">{activeDoc.stage.replace('_',' ')}</span>}
                        {activeDoc.engineer&&<span className="kb-doc-tag kb-tag-gray">{activeDoc.engineer}</span>}
                        <span className="kb-doc-tag kb-tag-gray">{fmtDate(activeDoc.updatedAt)}</span>
                    </div>
                    <div className="kb-viewer-body">
                        <textarea className="kb-viewer-textarea" value={editContent} onChange={e=>setEditContent(e.target.value)} placeholder="Document content, engineering notes, workarounds, and references..." />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="kb-container">
            {/* Command Bar */}
            <div className="kb-command">
                <div className="kb-search">
                    <Search size={13} className="kb-search-icon"/>
                    <input className="kb-search-input" placeholder="Search workflows, issues, DRC/LVS errors, engineers..." value={search} onChange={e=>setSearch(e.target.value)}/>
                </div>
                <div className="kb-filters">
                    {FILTERS.map(f=><button key={f} className={`kb-filter ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f}</button>)}
                </div>
                <span className="kb-count">{filtered.length} docs</span>
                <button className="kb-new-btn" onClick={()=>{setActiveDoc({id:'new_'+Date.now(),title:'New Document',excerpt:'',domain:'design-rules',impact:'medium',updatedAt:new Date().toISOString()});setEditContent('');}}><Plus size={12}/> New</button>
            </div>

            {/* Main Layout */}
            <div className="kb-layout">
                <div className="kb-collections">
                    {COLLECTIONS.map(c=>{
                        const items=grouped[c.id]||[];
                        if(items.length===0&&filter!=='All') return null;
                        const isOpen=!collapsed[c.id];
                        return (
                            <div key={c.id} className="kb-collection">
                                <div className={`kb-coll-header ${isOpen?'open':''}`} onClick={()=>setCollapsed(p=>({...p,[c.id]:!p[c.id]}))}>
                                    <div className="kb-coll-icon" style={{background:c.bg}}><c.icon size={14} color={c.color}/></div>
                                    <div className="kb-coll-title">{c.label}</div>
                                    <span className="kb-coll-count">{items.length}</span>
                                    <ChevronRight size={14} className={`kb-coll-chevron ${isOpen?'open':''}`}/>
                                </div>
                                {isOpen&&items.length>0&&(
                                    <div className="kb-doc-list">
                                        {items.map(d=>(
                                            <div key={d.id} className="kb-doc-item" onClick={()=>{setActiveDoc(d);setEditContent(d.excerpt);}}>
                                                <div className="kb-doc-main">
                                                    <div className="kb-doc-title">{d.title}</div>
                                                    <div className="kb-doc-excerpt">{d.excerpt}</div>
                                                    <div className="kb-doc-meta">
                                                        <span className={`kb-doc-tag ${impactCls(d.impact)}`}>{d.impact}</span>
                                                        {d.blockName&&<span className="kb-doc-tag kb-tag-blue">{d.blockName}</span>}
                                                        {d.engineer&&<span className="kb-doc-tag kb-tag-gray">{d.engineer}</span>}
                                                    </div>
                                                </div>
                                                <div className="kb-doc-side">
                                                    <span className="kb-doc-date">{fmtDate(d.updatedAt)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {isOpen&&items.length===0&&<div className="kb-empty">No documents in this collection</div>}
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar */}
                <div className="kb-side">
                    <div className="kb-panel">
                        <div className="kb-panel-title"><Link2 size={10}/> Workflow-Linked</div>
                        {linkedBlocks.map(b=>(
                            <div key={b.name} className="kb-link-item" onClick={()=>{setSearch(b.name);setFilter('All');}}>
                                <div className="kb-link-name">{b.name}</div>
                                <div className="kb-link-detail">{b.count} doc{b.count!==1?'s':''} • {b.stage?.replace('_',' ')} • {b.health}</div>
                            </div>
                        ))}
                    </div>

                    {insights.length>0&&<div className="kb-panel">
                        <div className="kb-panel-title"><Zap size={10}/> Insights</div>
                        {insights.map((r,i)=><div key={i} className="kb-insight">{r}</div>)}
                    </div>}

                    {activity.length>0&&<div className="kb-panel">
                        <div className="kb-panel-title"><Activity size={10}/> Recent Activity</div>
                        {activity.map(e=>(
                            <div key={e.k} className="kb-activity-item">
                                <div className="kb-activity-time">{e.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                                <div className="kb-activity-text">{e.html}</div>
                            </div>
                        ))}
                    </div>}
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBase;
