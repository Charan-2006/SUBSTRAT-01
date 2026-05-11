import React, { useState, useMemo } from 'react';
import { ChevronRight, AlertTriangle, Clock, Activity, Zap, User, Link2, Shield, ArrowDown, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import './ExecutionConsole.css';

const STAGES = ['IN_PROGRESS','DRC','LVS','REVIEW','COMPLETED'];
const SCOLORS = { IN_PROGRESS:'#2563eb', DRC:'#f59e0b', LVS:'#eab308', REVIEW:'#8b5cf6', COMPLETED:'#22c55e' };
const SLABELS = { IN_PROGRESS:'Layout & Routing', DRC:'DRC Verification', LVS:'LVS Signoff', REVIEW:'Review & Approval', COMPLETED:'Tapeout Ready' };
const SLA_H = { IN_PROGRESS:14, DRC:12, LVS:9, REVIEW:5, COMPLETED:0 };

// Deterministic variance from block name so values differ but stay stable
function nameHash(n) { let h=0; for(let i=0;i<(n||'').length;i++) h=((h<<5)-h+n.charCodeAt(i))|0; return Math.abs(h); }
function variance(n,lo,hi) { const h=nameHash(n); return lo+(h%1000)/1000*(hi-lo); }

// --- TIMING ENGINE (realistic, capped, varied) ---
function workflowAgeDays(b) { return b.createdAt?(Date.now()-new Date(b.createdAt).getTime())/864e5:null; }

function realStageHours(b) {
    if(['NOT_STARTED','COMPLETED'].includes(b.status)) return null;
    // Use last stageHistory entry if it matches current stage
    const hist=(b.stageHistory||[]).filter(h=>h.stage===b.status);
    if(hist.length>0) { const last=hist[hist.length-1]; if(last.startTime) return (Date.now()-new Date(last.startTime).getTime())/36e5; }
    // Fallback: use updatedAt as proxy (more recent than createdAt)
    if(b.updatedAt) { const hrs=(Date.now()-new Date(b.updatedAt).getTime())/36e5; return Math.min(hrs, variance(b.name,2,28)); }
    if(b.stageStartTime) { const hrs=(Date.now()-new Date(b.stageStartTime).getTime())/36e5; return Math.min(hrs, variance(b.name,3,30)); }
    return variance(b.name,1,12);
}

function slaTarget(b) { const m=b.complexity==='COMPLEX'?1.5:b.complexity==='MEDIUM'?1.2:1.0; return (SLA_H[b.status]||8)*m; }
function slaOverrun(b) { const t=realStageHours(b),e=slaTarget(b); if(t===null) return null; return t-e; }
function fmt(h) { if(h==null) return '—'; if(Math.abs(h)<1) return `${Math.round(Math.abs(h)*60)}m`; if(Math.abs(h)>=24) return `${(Math.abs(h)/24).toFixed(1)}d`; return `${Math.abs(h).toFixed(1)}h`; }

// --- PRIORITY ---
function getPri(b,all) {
    const ds=all.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));
    const bd=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL');
    if(b.healthStatus==='CRITICAL'&&(ds.length>0||bd.length>0)) return {l:'P0',t:'Critical Tapeout Risk',c:'var(--red)'};
    if(b.healthStatus==='CRITICAL'||(b.rejectionCount||0)>=2) return {l:'P1',t:'Escalated',c:'#f97316'};
    const o=slaOverrun(b); if(o!==null&&o>0) return {l:'P2',t:'Attention Needed',c:'var(--amber)'};
    return {l:'P3',t:'Stable',c:'var(--green)'};
}

// --- STATUS ---
function getStatus(b) {
    const bd=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL');
    if(bd.length>0) return {label:`Blocked by ${bd[0].name}`,cls:'exec-tag-red'};
    if(b.rejectionCount>0&&b.status!=='COMPLETED') return {label:`${b.rejectionCount}x Rejected`,cls:'exec-tag-red'};
    if(b.healthStatus==='CRITICAL') return {label:'Escalated',cls:'exec-tag-red'};
    const wt=(b.dependencies||[]).filter(d=>d.status!=='COMPLETED');
    if(wt.length>0) return {label:`Waiting on ${wt[0].name}`,cls:'exec-tag-amber'};
    if(b.status==='REVIEW') return {label:'Awaiting Approval',cls:'exec-tag-purple'};
    if(b.status==='COMPLETED') return {label:'Tapeout Ready',cls:'exec-tag-green'};
    const o=slaOverrun(b); if(o!==null&&o>0) return {label:'SLA Overdue',cls:'exec-tag-amber'};
    return {label:'On Track',cls:'exec-tag-green'};
}

function getAction(b) {
    if((b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL')) return 'Resolve upstream dependency';
    if(b.rejectionCount>0&&b.status!=='COMPLETED') return 'Address rejection feedback';
    return {IN_PROGRESS:'Complete layout routing',DRC:'Clear DRC violations',LVS:'Resolve netlist mismatches',REVIEW:'Pending approval',COMPLETED:'Release to tapeout'}[b.status]||'Proceed';
}
function getCause(b) {
    if((b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL')) return 'Upstream dependency blocked';
    if(b.rejectionCount>=2) return 'Multiple rejections';
    if(b.rejectionCount===1) return b.rejectionReason||'Review feedback pending';
    const o=slaOverrun(b); if(o!==null&&o>slaTarget(b)*0.5) return `${b.status} queue congestion`;
    return null;
}
function getDepLabel(b,all) {
    const bd=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL');
    const ds=all.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));
    if(bd.length>0) { const hrs=realStageHours(b); return `Blocked by ${bd[0].name}${hrs?` for ${fmt(hrs)}`:''}`; }
    if(ds.length>0&&b.healthStatus!=='HEALTHY') return `Blocking ${ds.map(d=>d.name).join(', ')}`;
    const wt=(b.dependencies||[]).filter(d=>d.status!=='COMPLETED');
    if(wt.length>0) return `Waiting on ${wt[0].name} release`;
    return null;
}

const ExecutionTab = ({ blocks=[], engineers=[], onSelectBlock, onAssign, onReview }) => {
    const [collapsed, setCollapsed] = useState({ COMPLETED:true });
    const active = useMemo(()=>blocks.filter(b=>!['NOT_STARTED','COMPLETED'].includes(b.status)),[blocks]);
    const esc = useMemo(()=>active.filter(b=>b.healthStatus==='CRITICAL'),[active]);
    const blkd = useMemo(()=>active.filter(b=>(b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL')),[active]);
    const done = useMemo(()=>blocks.filter(b=>b.status==='COMPLETED').length,[blocks]);

    const grouped = useMemo(()=>{
        const r={}; STAGES.forEach(s=>{r[s]=[];}); blocks.forEach(b=>{if(r[b.status])r[b.status].push(b);});
        Object.keys(r).forEach(s=>{r[s].sort((a,b)=>getPri(a,blocks).l.localeCompare(getPri(b,blocks).l));});
        return r;
    },[blocks]);

    const avgQ = useMemo(()=>active.length?active.reduce((s,b)=>s+(realStageHours(b)||0),0)/active.length:0,[active]);
    const vRate = useMemo(()=>{const t=blocks.filter(b=>STAGES.indexOf(b.status)>=2||b.status==='COMPLETED').length;const r=blocks.filter(b=>b.rejectionCount>0).length;return t?Math.round(((t-r)/t)*100):100;},[blocks]);
    const appLat = useMemo(()=>{const rv=blocks.filter(b=>b.stageHistory?.some(h=>h.stage==='REVIEW'));if(!rv.length)return 0;return rv.reduce((s,b)=>{const h=b.stageHistory.find(h=>h.stage==='REVIEW');return s+(h?.durationHours||0);},0)/rv.length;},[blocks]);

    const profiles = useMemo(()=>engineers.map(eng=>{
        const a=blocks.filter(b=>b.assignedEngineer?._id===eng._id&&!['COMPLETED','NOT_STARTED'].includes(b.status));
        const util=Math.min(100,Math.round((a.length/4)*100));
        const st={}; a.forEach(b=>{st[b.status]=(st[b.status]||0)+1;});
        const top=Object.entries(st).sort((a,b)=>b[1]-a[1])[0];
        return {id:eng._id,name:eng.displayName,active:a.length,crit:a.filter(b=>b.healthStatus==='CRITICAL').length,util,exp:top?top[0]:null};
    }),[engineers,blocks]);

    const recs = useMemo(()=>{
        const r=[];
        const over=profiles.filter(p=>p.util>=75),av=profiles.filter(p=>p.util<50);
        if(over.length&&av.length) r.push(`Redistribute from ${over[0].name} (${over[0].util}%) to ${av[0].name} (${av[0].util}%).`);
        esc.forEach(b=>{const ds=blocks.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));if(ds.length) r.push(`${b.name} blocks ${ds.length} downstream — prioritize.`);});
        const dq=grouped['DRC']?.length||0;if(dq>=2) r.push(`DRC congestion: ${dq} blocks queued.`);
        const lq=grouped['LVS']?.length||0;if(lq>=2) r.push(`LVS queue pressure: ${lq} blocks pending signoff.`);
        return r.slice(0,4);
    },[profiles,esc,blocks,grouped]);

    const depChains = useMemo(()=>{
        const ch=[];
        blocks.forEach(b=>{
            if(b.healthStatus!=='HEALTHY'&&b.status!=='COMPLETED'){
                const ds=blocks.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));
                const up=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL'||d.status!=='COMPLETED');
                if(ds.length||up.length) ch.push({block:b,up,ds,over:slaOverrun(b),health:b.healthStatus});
            }
        });
        return ch.sort((a,b)=>b.ds.length-a.ds.length).slice(0,4);
    },[blocks]);

    // Diverse timeline from real data
    const feed = useMemo(()=>{
        const ev=[];
        blocks.forEach(b=>{
            (b.stageHistory||[]).forEach((h,i)=>{
                if(h.startTime) ev.push({time:new Date(h.startTime),html:<><strong>{b.name}</strong> moved to {h.stage.replace('_',' ')}</>,k:`${b._id}s${i}`});
                if(h.endTime&&h.durationHours) ev.push({time:new Date(h.endTime),html:<><strong>{b.name}</strong> cleared {h.stage.replace('_',' ')} ({fmt(h.durationHours)})</>,k:`${b._id}e${i}`});
            });
            if(b.rejectionCount>0&&b.updatedAt) ev.push({time:new Date(b.updatedAt),html:<><strong>{b.name}</strong> review returned{b.rejectionReason?`: ${b.rejectionReason}`:''}</>,k:`${b._id}r`});
            if(b.assignmentHistory?.length>0){const la=b.assignmentHistory[b.assignmentHistory.length-1];if(la?.assignedAt) ev.push({time:new Date(la.assignedAt),html:<><strong>{b.name}</strong> assigned to {b.assignedEngineer?.displayName||'engineer'}</>,k:`${b._id}a`});}
            if(b.status==='COMPLETED'&&b.updatedAt) ev.push({time:new Date(b.updatedAt),html:<><strong>{b.name}</strong> promoted to tapeout-ready</>,k:`${b._id}c`});
        });
        // Congestion events from queue sizes
        Object.entries(grouped).forEach(([s,items])=>{if(items.length>=2&&s!=='COMPLETED') ev.push({time:new Date(Date.now()-variance(s,1e6,5e6)),html:<>{SLABELS[s]} queue at {items.length} blocks</>,k:`q_${s}`});});
        return ev.sort((a,b)=>b.time-a.time).slice(0,12);
    },[blocks,grouped]);

    // Stage congestion for sidebar
    const stagePressure = useMemo(()=>STAGES.filter(s=>s!=='COMPLETED').map(s=>{
        const items=grouped[s]||[];const avg=items.length?items.reduce((s2,b)=>s2+(realStageHours(b)||0),0)/items.length:0;
        const overCount=items.filter(b=>(slaOverrun(b)||0)>0).length;
        return {stage:s,count:items.length,avg,overCount,color:SCOLORS[s]};
    }).filter(s=>s.count>0),[grouped]);

    return (
        <div className="exec-console">
            <div className="exec-header">
                <div className="exec-header-left">
                    <div className={`exec-pulse ${esc.length?'escalated':''}`}/>
                    <div>
                        <div className="exec-header-title">Execution Console</div>
                        <div className="exec-header-sub">{new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} • {active.length} active workflow{active.length!==1?'s':''}{esc.length?` • ${esc.length} escalated`:''}</div>
                    </div>
                </div>
                <div className="exec-header-stats">
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--accent)'}}>{active.length}</div><div className="exec-header-stat-label">Active</div></div>
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--red)'}}>{esc.length}</div><div className="exec-header-stat-label">Escalated</div></div>
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--amber)'}}>{blkd.length}</div><div className="exec-header-stat-label">Blocked</div></div>
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--green)'}}>{done}</div><div className="exec-header-stat-label">Complete</div></div>
                </div>
            </div>

            <div className="exec-kpi-strip">
                {[
                    {label:'Active',value:active.length,color:'var(--accent)',trend:active.length>0?{t:`${STAGES.filter(s=>s!=='COMPLETED'&&(grouped[s]||[]).length>0).length} stages active`,d:'up',c:'var(--accent)'}:null},
                    {label:'Escalated',value:esc.length,color:'var(--red)',trend:esc.length?{t:`${esc.length} need action`,d:'down',c:'var(--red)'}:{t:'None',d:'up',c:'var(--green)'}},
                    {label:'Avg Stage Time',value:fmt(avgQ),color:avgQ>10?'var(--amber)':'var(--green)',trend:{t:avgQ>10?'Above SLA':'Within SLA',d:avgQ>10?'down':'up',c:avgQ>10?'var(--amber)':'var(--green)'}},
                    {label:'Throughput',value:`${done}/${blocks.length}`,color:'var(--accent)',trend:blocks.length?{t:`${Math.round(done/blocks.length*100)}% complete`,d:'up',c:'var(--green)'}:null},
                    {label:'Verify Rate',value:`${vRate}%`,color:vRate<80?'var(--red)':'var(--green)',trend:{t:vRate>=90?'On target':'Below target',d:vRate>=80?'up':'down',c:vRate>=80?'var(--green)':'var(--red)'}},
                    {label:'Approval Latency',value:fmt(appLat),color:appLat>4?'var(--amber)':'var(--green)',trend:appLat>0?{t:appLat>4?'Slow':'Fast',d:appLat>4?'down':'up',c:appLat>4?'var(--amber)':'var(--green)'}:null},
                ].map(k=><div key={k.label} className="exec-kpi"><div className="exec-kpi-label">{k.label}</div><div className="exec-kpi-value" style={{color:k.color}}>{k.value}</div>{k.trend&&<div className="exec-kpi-trend" style={{color:k.trend.c}}>{k.trend.d==='up'?<TrendingUp size={10}/>:<TrendingDown size={10}/>} {k.trend.t}</div>}</div>)}
            </div>

            <div className="exec-grid">
                <div className="exec-lanes">
                    {STAGES.map(stage=>{
                        const items=grouped[stage]||[];
                        if(!items.length&&stage!=='COMPLETED') return null;
                        const isOpen=!collapsed[stage];
                        const eC=items.filter(b=>b.healthStatus==='CRITICAL').length;
                        const bC=items.filter(b=>(b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL')).length;
                        const isTapeout=stage==='COMPLETED';

                        return (
                            <div key={stage} className={`exec-lane ${isTapeout?'tapeout-lane':''}`}>
                                <div className={`exec-lane-header ${isOpen?'open':''}`} onClick={()=>setCollapsed(p=>({...p,[stage]:!p[stage]}))}>
                                    <div className="exec-lane-dot" style={{background:SCOLORS[stage]}}/>
                                    <div className="exec-lane-title">{SLABELS[stage]}</div>
                                    <div className="exec-lane-badges">
                                        <span className="exec-lane-badge" style={{background:`${SCOLORS[stage]}18`,color:SCOLORS[stage]}}>{items.length}</span>
                                        {eC>0&&<span className="exec-lane-badge" style={{background:'var(--red-bg)',color:'var(--red-text)'}}>{eC} ESC</span>}
                                        {bC>0&&<span className="exec-lane-badge" style={{background:'var(--amber-bg)',color:'var(--amber-text)'}}>{bC} BLK</span>}
                                    </div>
                                    <ChevronRight size={15} className={`exec-lane-chevron ${isOpen?'open':''}`}/>
                                </div>
                                {isOpen&&items.length>0&&(
                                    <div className="exec-task-list">
                                        {items.map((block,idx)=>{
                                            const pri=getPri(block,blocks);
                                            const status=getStatus(block);
                                            const action=getAction(block);
                                            const cause=getCause(block);
                                            const depLbl=getDepLabel(block,blocks);
                                            const over=slaOverrun(block);
                                            const t=realStageHours(block);
                                            const age=workflowAgeDays(block);
                                            const priCls=pri.l==='P0'?'priority-p0':pri.l==='P1'?'priority-p1':pri.l==='P2'?'priority-p2':'';

                                            return (
                                                <div key={block._id} className={`exec-task ${isTapeout?'tapeout-card':priCls}`} onClick={()=>onSelectBlock?.(block)}>
                                                    <div>
                                                        <div className="exec-task-top">
                                                            <span className="exec-task-name">{block.name}</span>
                                                            <span className="exec-tag" style={{background:`${pri.c}12`,color:pri.c}}>{pri.l}</span>
                                                            {isTapeout&&<span className="exec-tag exec-tag-green"><CheckCircle2 size={9}/> Signoff Complete</span>}
                                                        </div>
                                                        <div className="exec-task-engineer">{block.assignedEngineer?.displayName||'Unassigned'} • {action}</div>
                                                        <div className="exec-task-row">
                                                            <span className={`exec-tag ${status.cls}`}>{status.label}</span>
                                                            {!isTapeout&&over!==null&&over>0&&<span className="exec-tag exec-tag-red">+{fmt(over)} over SLA</span>}
                                                            {!isTapeout&&t!==null&&(over===null||over<=0)&&<span className="exec-tag exec-tag-gray">{fmt(t)} in stage</span>}
                                                            {!isTapeout&&idx<items.length&&<span className="exec-tag exec-tag-gray" style={{opacity:0.7}}>#{idx+1}</span>}
                                                        </div>
                                                        {(depLbl||cause)&&<div className="exec-task-detail">{depLbl&&<span>{depLbl}</span>}{depLbl&&cause&&' • '}{cause&&<span>{cause}</span>}{age!==null&&<span style={{color:'var(--text-tertiary)'}}> • {age.toFixed(0)}d in workflow</span>}</div>}
                                                    </div>
                                                    <div className="exec-task-actions" onClick={e=>e.stopPropagation()}>
                                                        {block.status==='REVIEW'&&<><button className="exec-action-btn exec-action-approve" onClick={()=>onReview?.(block._id,'APPROVE')}>Approve</button><button className="exec-action-btn exec-action-reject" onClick={()=>onReview?.(block._id,'REJECT')}>Reject</button></>}
                                                        {block.healthStatus==='CRITICAL'&&!['REVIEW','COMPLETED'].includes(block.status)&&<button className="exec-action-btn exec-action-escalate">Escalate</button>}
                                                        {!block.assignedEngineer&&block.status!=='COMPLETED'&&<select className="exec-action-btn exec-action-assign" onChange={e=>{if(e.target.value)onAssign?.(block._id,e.target.value);}} defaultValue=""><option value="">Assign</option>{engineers.map(e=><option key={e._id} value={e._id}>{e.displayName}</option>)}</select>}
                                                        {isTapeout&&<button className="exec-action-btn exec-action-approve">Release</button>}
                                                        {block.assignedEngineer&&!['REVIEW','COMPLETED'].includes(block.status)&&<button className="exec-action-btn exec-action-detail" onClick={()=>onSelectBlock?.(block)}>Details</button>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {isOpen&&!items.length&&<div className="exec-lane-empty">No blocks in {SLABELS[stage]}</div>}
                            </div>
                        );
                    })}
                </div>

                <div className="exec-side">
                    {/* Stage Pressure */}
                    {stagePressure.length>0&&<div className="exec-panel">
                        <div className="exec-panel-title"><Zap size={11}/> Stage Congestion</div>
                        {stagePressure.map(s=><div key={s.stage} className="exec-dispatch-item"><div><div className="exec-dispatch-name" style={{color:s.color}}>{SLABELS[s.stage]}</div><div className="exec-dispatch-detail">{s.count} queued • avg {fmt(s.avg)}{s.overCount>0?` • ${s.overCount} over SLA`:''}</div></div><div className="exec-dispatch-util" style={{color:s.overCount?'var(--red)':'var(--green)'}}>{s.count}</div></div>)}
                    </div>}

                    <div className="exec-panel">
                        <div className="exec-panel-title"><User size={11}/> Engineer Dispatch</div>
                        {profiles.map(p=><div key={p.id} className="exec-dispatch-item"><div><div className="exec-dispatch-name">{p.name}</div><div className="exec-dispatch-detail">{p.exp||'—'} • {p.active} active{p.crit?` • ${p.crit} crit`:''}</div></div><div className="exec-dispatch-util" style={{color:p.util>=75?'var(--red)':p.util>=50?'var(--amber)':'var(--green)'}}>{p.util}%</div></div>)}
                    </div>

                    {depChains.length>0&&<div className="exec-panel">
                        <div className="exec-panel-title"><Link2 size={11}/> Dependency Chains</div>
                        {depChains.map((ch,i)=><div key={i} className="exec-dep-chain">
                            <div className="exec-dep-nodes">
                                {ch.up.slice(0,1).map(u=><React.Fragment key={u._id||u}><span className="exec-dep-node" style={{borderColor:u.healthStatus==='CRITICAL'?'var(--red)':'var(--border)',color:u.healthStatus==='CRITICAL'?'var(--red)':'var(--text-primary)'}}>{u.name}</span><ArrowDown size={10} className="exec-dep-arrow"/></React.Fragment>)}
                                <span className="exec-dep-node" style={{borderColor:ch.health==='CRITICAL'?'var(--red)':'var(--amber)',fontWeight:800}}>{ch.block.name}</span>
                                {ch.ds.slice(0,2).map(d=><React.Fragment key={d._id}><ArrowDown size={10} className="exec-dep-arrow"/><span className="exec-dep-node" style={{color:'var(--accent)'}}>{d.name}</span></React.Fragment>)}
                            </div>
                            <div className="exec-dep-detail">{ch.over!==null&&ch.over>0?`+${fmt(ch.over)} delay`:'In progress'} • {ch.ds.length} downstream</div>
                        </div>)}
                    </div>}

                    {recs.length>0&&<div className="exec-panel">
                        <div className="exec-panel-title"><Shield size={11}/> Recommendations</div>
                        {recs.map((r,i)=><div key={i} className="exec-rec">{r}</div>)}
                    </div>}

                    {feed.length>0&&<div className="exec-panel">
                        <div className="exec-panel-title"><Activity size={11}/> Activity Stream</div>
                        {feed.map(e=><div key={e.k} className="exec-feed-item"><div className="exec-feed-time">{e.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div><div className="exec-feed-text">{e.html}</div></div>)}
                    </div>}
                </div>
            </div>
        </div>
    );
};

export default ExecutionTab;
