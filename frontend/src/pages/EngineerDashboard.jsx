import React, { useState, useMemo } from 'react';
import { Briefcase, Clock, Zap, AlertTriangle, CheckCircle2, BookOpen, Send, Activity } from 'lucide-react';
import { useOrchestration } from '../context/OrchestrationContext';
import './EngineerWorkspace.css';
import EngMyWork from './engineer/EngMyWork';
import EngTimeline from './engineer/EngTimeline';
import EngExecution from './engineer/EngExecution';
import EngBlockers from './engineer/EngBlockers';
import EngReviews from './engineer/EngReviews';
import EngKnowledge from './engineer/EngKnowledge';
import EngRequests from './engineer/EngRequests';

const TABS=[
    {id:'my-work',label:'My Work',icon:Briefcase},
    {id:'timeline',label:'Timeline',icon:Clock},
    {id:'execution',label:'Execution',icon:Activity},
    {id:'blockers',label:'Blockers',icon:AlertTriangle},
    {id:'reviews',label:'Reviews',icon:CheckCircle2},
    {id:'knowledge',label:'Knowledge',icon:BookOpen},
    {id:'requests',label:'Requests',icon:Send},
];

const EngineerDashboard=({user,requests=[],analytics,onCreateRequest,onUpdateStatus,onReview,onResumeWorkflow,onEscalate,selectedBlockId,onSelectBlock})=>{
    const { blocks: contextBlocks, engineers } = useOrchestration();
    const blocks = contextBlocks;
    
    const [tab,setTab]=useState('my-work');
    const my=useMemo(()=>blocks.filter(b=>b.assignedEngineer?._id===user?._id||b.assignedEngineer===user?._id),[blocks,user]);
    const active=useMemo(()=>my.filter(b=>b.status!=='COMPLETED'),[my]);
    const crit=useMemo(()=>active.filter(b=>b.health==='CRITICAL'||b.health==='SEVERE'),[active]);
    const review=useMemo(()=>my.filter(b=>b.status==='REVIEW'),[my]);
    const done=useMemo(()=>my.filter(b=>b.status==='COMPLETED'),[my]);
    const atRisk=useMemo(()=>active.filter(b=>b.health==='CRITICAL'||b.health==='SEVERE'||b.health==='RISK'),[active]);
    const ready=useMemo(()=>my.filter(b=>(!b.isBlocked || b.executionState !== 'BLOCKED') && (b.status==='NOT_STARTED' || b.status === 'READY')),[my]);

    const p={user,myBlocks:my,active,critical:crit,inReview:review,completed:done,overdue:atRisk,ready,blocks,engineers,requests,analytics,onSelectBlock,onUpdateStatus,onReview,onResumeWorkflow,onEscalate,onCreateRequest,selectedBlockId};

    return (
        <div className="dashboard-container">
            <div className="ew-shell">
                <div className="ew-header">
                    <div className="ew-header-left">
                        <h2>Engineer Workspace</h2>
                        <div className="ew-header-sub">Verification & layout execution center</div>
                    </div>
                    <div className="ew-header-right">
                        <div className="ew-stat-pill"><div className="ew-stat-val" style={{color:'#2563eb'}}>{active.length}</div><div className="ew-stat-lbl">Active</div></div>
                        <div className="ew-stat-pill"><div className="ew-stat-val" style={{color:'#dc2626'}}>{crit.length}</div><div className="ew-stat-lbl">Escalated</div></div>
                        <div className="ew-stat-pill"><div className="ew-stat-val" style={{color:'#7c3aed'}}>{review.length}</div><div className="ew-stat-lbl">Review</div></div>
                        <div className="ew-stat-pill"><div className="ew-stat-val" style={{color:'#16a34a'}}>{done.length}</div><div className="ew-stat-lbl">Done</div></div>
                        <div className="ew-live"><div className="ew-pulse"/>Live</div>
                    </div>
                </div>
                <div className="ew-tabs">
                    {TABS.map(t=>(
                        <div key={t.id} className={`ew-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
                            <span className="ew-tab-icon"><t.icon size={12}/></span>
                            {t.label}
                            {t.id==='blockers'&&crit.length>0&&<span className="ew-tab-badge" style={{background:'rgba(239,68,68,0.08)',color:'#dc2626'}}>{crit.length}</span>}
                            {t.id==='reviews'&&review.length>0&&<span className="ew-tab-badge" style={{background:'rgba(139,92,246,0.08)',color:'#7c3aed'}}>{review.length}</span>}
                        </div>
                    ))}
                </div>
                <div className="ew-page">
                    {tab==='my-work'&&<EngMyWork {...p}/>}
                    {tab==='timeline'&&<EngTimeline {...p}/>}
                    {tab==='execution' && <EngExecution {...p} onResumeWorkflow={onResumeWorkflow} />}
                    {tab==='blockers' && <EngBlockers {...p} />}
                    {tab==='reviews'&&<EngReviews {...p}/>}
                    {tab==='knowledge'&&<EngKnowledge {...p}/>}
                    {tab==='requests'&&<EngRequests {...p}/>}
                </div>
            </div>
        </div>
    );
};

export default EngineerDashboard;
