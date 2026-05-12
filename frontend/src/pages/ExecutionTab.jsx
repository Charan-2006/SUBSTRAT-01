import React, { useState, useMemo } from 'react';
import { ChevronRight, AlertTriangle, Clock, Activity, Zap, User, Link2, Shield, ArrowDown, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { calculateSLA, calculateBottleneck } from '../utils/workflowEngine';
import './ExecutionConsole.css';

const STAGES = ['IN_PROGRESS','DRC','LVS','REVIEW','COMPLETED'];
const SCOLORS = { IN_PROGRESS:'#2563eb', DRC:'#f59e0b', LVS:'#eab308', REVIEW:'#8b5cf6', COMPLETED:'#22c55e' };
const SLABELS = { IN_PROGRESS:'Layout & Routing', DRC:'DRC Verification', LVS:'LVS Signoff', REVIEW:'Review & Approval', COMPLETED:'Tapeout Ready' };

// --- TIMING ENGINE (REAL) ---
function workflowAgeDays(b) { return b.createdAt ? (Date.now()-new Date(b.createdAt).getTime())/864e5 : null; }
function slaOverrun(b) { const sla = calculateSLA(b); return sla.delayHours; }
function realStageHours(b) { const sla = calculateSLA(b); return sla.actualHours; }
function fmt(h) { if(h==null || isNaN(h)) return '—'; if(Math.abs(h)<0.01) return '0.0h'; if(Math.abs(h)<1) return `${Math.round(Math.abs(h)*60)}m`; if(Math.abs(h)>=24) return `${(Math.abs(h)/24).toFixed(1)}d`; return `${Math.abs(h).toFixed(1)}h`; }

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
    if(b.healthStatus==='CRITICAL' || b.escalated) return {label:'Escalated',cls:'exec-tag-red'};
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
    const sla = calculateSLA(b); if(sla.delayHours > 0.05) return `${b.status} stage delayed`;
    return null;
}

function getDepLabel(b,all) {
    const bd=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL');
    const ds=all.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));
    if(bd.length>0) { const hrs=realStageHours(b); return `Blocked by ${bd[0].name}${hrs>0.1?` for ${fmt(hrs)}`:''}`; }
    if(ds.length>0&&b.healthStatus!=='HEALTHY') return `Blocking ${ds.map(d=>d.name).join(', ')}`;
    const wt=(b.dependencies||[]).filter(d=>d.status!=='COMPLETED');
    if(wt.length>0) return `Waiting on ${wt[0].name} release`;
    return null;
}const ExecutionTab = ({ blocks=[], engineers=[], onSelectBlock, onAssign, onReview, onRelease }) => {
    const [collapsed, setCollapsed] = useState({ COMPLETED:false });
    
    // Filter out released blocks
    const unreleasedBlocks = useMemo(() => blocks.filter(b => !b.isReleased), [blocks]);

    const active = useMemo(()=>unreleasedBlocks.filter(b=>!['NOT_STARTED','COMPLETED'].includes(b.status)),[unreleasedBlocks]);
    const esc = useMemo(()=>active.filter(b=>b.healthStatus==='CRITICAL' || b.escalated),[active]);
    const blkd = useMemo(()=>active.filter(b=>(b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL' || d.status !== 'COMPLETED')),[active]);
    const done = useMemo(()=>unreleasedBlocks.filter(b=>b.status==='COMPLETED').length,[unreleasedBlocks]);

    const grouped = useMemo(()=>{
        const r={}; STAGES.forEach(s=>{r[s]=[];}); unreleasedBlocks.forEach(b=>{if(r[b.status])r[b.status].push(b);});
        Object.keys(r).forEach(s=>{r[s].sort((a,b)=>getPri(a,unreleasedBlocks).l.localeCompare(getPri(b,unreleasedBlocks).l));});
        return r;
    },[unreleasedBlocks]);

    // 1. ADVANCED METRIC CALCULATION
    const avgQ = useMemo(()=>active.length?active.reduce((s,b)=>s+(realStageHours(b)||0),0)/active.length:0,[active]);
    
    // Throughput: (Completed in last 24h / Active) - Simplified for demo to (Total Completed / Total Active)
    const throughput = useMemo(()=>unreleasedBlocks.length ? (done / unreleasedBlocks.length) : 0, [done, unreleasedBlocks]);

    // Verify Rate: Approved / (Approved + Rejected)
    const vRate = useMemo(()=>{
        let totalApprovals = 0;
        let totalRejections = 0;
        blocks.forEach(b => {
            totalApprovals += (b.approvalHistory?.length || 0);
            totalRejections += (b.rejectionHistory?.length || 0);
        });
        const total = totalApprovals + totalRejections;
        return total ? Math.round((totalApprovals / total) * 100) : 100;
    },[blocks]);
    
    // Approval Latency: Average time in REVIEW stage
    const appLat = useMemo(()=>{
        const completedReviews = [];
        blocks.forEach(b => {
            (b.stageHistory || []).forEach(h => {
                if (h.stage === 'REVIEW' && h.durationHours > 0) {
                    completedReviews.push(h.durationHours);
                }
            });
        });
        if(!completedReviews.length) return 0;
        return completedReviews.reduce((s, d) => s + d, 0) / completedReviews.length;
    },[blocks]);

    // 2. WEIGHTED ENGINEER WORKLOAD
    const profiles = useMemo(()=>{
        const engMap = new Map();
        unreleasedBlocks.forEach(b => {
            if(b.assignedEngineer && b.status !== 'COMPLETED') {
                const e = b.assignedEngineer;
                const id = e._id || e.id;
                if(!engMap.has(id)) {
                    engMap.set(id, { id, name: e.displayName, active: 0, crit: 0, st: {}, area: 0, weight: 0 });
                }
                const p = engMap.get(id);
                p.active++;
                if(b.healthStatus === 'CRITICAL' || b.escalated) p.crit++;
                p.st[b.status] = (p.st[b.status] || 0) + 1;
                p.area += (b.estimatedArea || 0);
                
                // Weight formula: (1.0 + (sqrt(area)/10)) * complexityFactor
                const factors = { 'SIMPLE': 1.0, 'MEDIUM': 1.5, 'COMPLEX': 2.5, 'CRITICAL': 4.0 };
                const f = factors[b.complexity] || 1.0;
                p.weight += f * (1 + Math.sqrt(b.estimatedArea || 0) / 10);
            }
        });

        engineers.forEach(e => {
            const id = e._id || e.id;
            if(!engMap.has(id)) engMap.set(id, { id, name: e.displayName, active: 0, crit: 0, st: {}, area: 0, weight: 0 });
        });

        return Array.from(engMap.values()).map(p => {
            // Utilization based on weight (Target weight capacity = 10)
            const util = Math.min(100, Math.round((p.weight / 10) * 100));
            const top = Object.entries(p.st).sort((a,b)=>b[1]-a[1])[0];
            return { ...p, util, exp: top ? top[0] : null };
        }).sort((a, b) => b.util - a.util);
    },[engineers,unreleasedBlocks]);

    // 3. DYNAMIC EXECUTION INTELLIGENCE
    const recs = useMemo(()=>{
        const r=[];
        const over=profiles.filter(p=>p.util>=80),av=profiles.filter(p=>p.util<40);
        if(over.length&&av.length) r.push(`Critical Overload: Redistribute tasks from ${over[0].name} (${over[0].util}%) to ${av[0].name}.`);
        
        const bottlenecks = unreleasedBlocks.filter(b => calculateBottleneck(b, unreleasedBlocks));
        if(bottlenecks.length) {
            r.push(`Systemic Bottleneck: ${bottlenecks[0].name} is stalling ${unreleasedBlocks.filter(x=>x.dependencies?.some(d=>(d._id||d)===bottlenecks[0]._id)).length} downstream nodes.`);
        }

        const slaRisks = active.filter(b => slaOverrun(b) > 0);
        if(slaRisks.length >= 3) {
            r.push(`SLA Trend Violation: ${slaRisks.length} workflows are currently exceeding their deterministic thresholds.`);
        }

        const reviewPending = grouped['REVIEW'] || [];
        if(reviewPending.length >= 2) {
            r.push(`Review Congestion: ${reviewPending.length} modules awaiting managerial signoff. Latency is increasing.`);
        }

        if(blkd.length > 0) {
            r.push(`Dependency Blockage: ${blkd.length} active nodes are idling due to upstream critical path delays.`);
        }

        return r.slice(0,4);
    },[profiles,unreleasedBlocks,grouped,active,blkd]);

    const depChains = useMemo(()=>{
        const ch=[];
        unreleasedBlocks.forEach(b=>{
            if(b.healthStatus!=='HEALTHY'&&b.status!=='COMPLETED'){
                const ds=unreleasedBlocks.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));
                const up=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL'||d.status!=='COMPLETED');
                if(ds.length||up.length) ch.push({block:b,up,ds,over:slaOverrun(b),health:b.healthStatus});
            }
        });
        return ch.sort((a,b)=>b.ds.length-a.ds.length).slice(0,4);
    },[unreleasedBlocks]);

    // Removed Activity Stream from this tab to focus on metrics

    const stagePressure = useMemo(()=>STAGES.filter(s=>s!=='COMPLETED').map(s=>{
        const items=grouped[s]||[];const avg=items.length?items.reduce((s2,b)=>s2+(realStageHours(b)||0),0)/items.length:0;
        const overCount=items.filter(b=>(slaOverrun(b)||0)>0.1).length;
        return {stage:s,count:items.length,avg,overCount,color:SCOLORS[s]};
    }).filter(s=>s.count>0),[grouped]);

    // 5. ESTIMATION PRECISION ENGINE (REAL-TIME)
    const estMetrics = useMemo(() => {
        let totalEst = 0;
        let totalAct = 0;
        
        const breakdown = unreleasedBlocks.map(b => {
            const sla = calculateSLA(b);
            const est = b.estimatedHours || 0;
            const act = sla.actualHours || 0;
            const diff = act - est;
            
            totalEst += est;
            totalAct += act;
            
            return { name: b.name, est, act, diff };
        }).sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5);

        const variance = totalEst > 0 ? ((totalAct - totalEst) / totalEst) * 100 : 0;
        const accuracy = Math.max(0, 100 - Math.abs(variance));

        return { totalEst, totalAct, variance, accuracy, topVariance: breakdown };
    }, [unreleasedBlocks]);

    return (
        <div className="exec-console">
            <div className="exec-header">
                <div className="exec-header-left">
                    <div className={`exec-pulse ${esc.length?'escalated':''}`}/>
                    <div>
                        <div className="exec-header-title">Manager Execution Console</div>
                        <div className="exec-header-sub">{new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} • Execution Orchestration Active</div>
                    </div>
                </div>
                <div className="exec-header-stats">
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--accent)'}}>{active.length}</div><div className="exec-header-stat-label">Active</div></div>
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--red)'}}>{esc.length}</div><div className="exec-header-stat-label">Escalated</div></div>
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--amber)'}}>{blkd.length}</div><div className="exec-header-stat-label">Blocked</div></div>
                    <div className="exec-header-stat"><div className="exec-header-stat-val" style={{color:'var(--green)'}}>{done}</div><div className="exec-header-stat-label">Tapeout</div></div>
                </div>
            </div>

            <div className="exec-kpi-strip">
                {[
                    {label:'Active Workflows',value:active.length,color:'var(--accent)',trend:{t:`Across ${stagePressure.length} stages`,d:'up',c:'var(--accent)'}},
                    {label:'Est. Total Effort',value:fmt(estMetrics.totalEst),color:'var(--text-secondary)',trend:{t:'Projected workload',d:'up',c:'var(--text-tertiary)'}},
                    {label:'Actual Time',value:fmt(estMetrics.totalAct),color:estMetrics.variance > 10 ? 'var(--red)' : 'var(--green)',trend:{t:`${Math.abs(estMetrics.variance).toFixed(1)}% variance`,d:estMetrics.variance > 0 ? 'down' : 'up',c:estMetrics.variance > 10 ? 'var(--red)' : 'var(--green)'}},
                    {label:'Resource Precision',value:`${estMetrics.accuracy.toFixed(1)}%`,color:estMetrics.accuracy < 85 ? 'var(--amber)' : 'var(--green)',trend:{t:estMetrics.accuracy >= 90 ? 'High Confidence' : 'Re-estimating...', d:estMetrics.accuracy >= 85 ? 'up' : 'down', c:estMetrics.accuracy >= 85 ? 'var(--green)' : 'var(--red)'}},
                    {label:'Verify Rate',value:`${vRate}%`,color:vRate<85?'var(--red)':'var(--green)',trend:{t:vRate>=90?'Excellence':'Review required',d:vRate>=85?'up':'down',c:vRate>=85?'var(--green)':'var(--red)'}},
                    {label:'Throughput',value:`${Math.round(throughput * 100)}%`,color:'var(--accent)',trend:{t:`${done} complete`,d:'up',c:'var(--green)'}},
                ].map(k=><div key={k.label} className="exec-kpi"><div className="exec-kpi-label">{k.label}</div><div className="exec-kpi-value" style={{color:k.color}}>{k.value}</div>{k.trend&&<div className="exec-kpi-trend" style={{color:k.trend.c}}>{k.trend.d==='up'?<TrendingUp size={10}/>:<TrendingDown size={10}/>} {k.trend.t}</div>}</div>)}
            </div>

            <div className="exec-grid">
                <div className="exec-lanes">
                    {STAGES.map(stage=>{
                        let items=grouped[stage]||[];
                        
                        // Strict Tapeout Ready filter
                        if (stage === 'COMPLETED') {
                            items = items.filter(b => 
                                b.status === 'COMPLETED' && 
                                b.healthStatus !== 'CRITICAL' && 
                                (b.dependencies || []).every(d => d.status === 'COMPLETED') &&
                                (b.approvalHistory?.length > 0)
                            );
                        }

                        if(!items.length&&stage!=='COMPLETED') return null;
                        const isOpen=!collapsed[stage];
                        const eC=items.filter(b=>b.healthStatus==='CRITICAL' || b.escalated).length;
                        const bC=items.filter(b=>(b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL' || d.status !== 'COMPLETED')).length;
                        const isTapeout=stage==='COMPLETED';

                        return (
                            <div key={stage} className={`exec-lane ${isTapeout?'tapeout-lane':''}`}>
                                <div className={`exec-lane-header ${isOpen?'open':''}`} onClick={()=>setCollapsed(p=>({...p,[stage]:!p[stage]}))}>
                                    <div className="exec-lane-dot" style={{background:SCOLORS[stage]}}/>
                                    <div className="exec-lane-title">{SLABELS[stage]}</div>
                                    <div className="exec-lane-badges">
                                        <span className="exec-lane-badge" style={{background:`${SCOLORS[stage]}18`,color:SCOLORS[stage]}}>{items.length} Modules</span>
                                        {eC>0&&<span className="exec-lane-badge" style={{background:'var(--red-bg)',color:'var(--red-text)'}}>{eC} RISK</span>}
                                        {bC>0&&<span className="exec-lane-badge" style={{background:'var(--amber-bg)',color:'var(--amber-text)'}}>{bC} BLK</span>}
                                    </div>
                                    <ChevronRight size={15} className={`exec-lane-chevron ${isOpen?'open':''}`}/>
                                </div>
                                {isOpen&&items.length>0&&(
                                    <div className="exec-task-list">
                                        {items.map((block,idx)=>{
                                            const pri=getPri(block,unreleasedBlocks);
                                            const status=getStatus(block);
                                            const action=getAction(block);
                                            const cause=getCause(block);
                                            const depLbl=getDepLabel(block,unreleasedBlocks);
                                            const over=slaOverrun(block);
                                            const age=workflowAgeDays(block);

                                            return (
                                                <div key={block._id} className={`exec-task ${isTapeout?'tapeout-card':pri.l==='P0'?'priority-p0':pri.l==='P1'?'priority-p1':''}`} onClick={()=>onSelectBlock?.(block)}>
                                                    <div>
                                                        <div className="exec-task-top">
                                                            <span className="exec-task-name">{block.name}</span>
                                                            <span className="exec-tag" style={{background:`${pri.c}12`,color:pri.c}}>{pri.l}</span>
                                                            {isTapeout&&<span className="exec-tag exec-tag-green" style={{fontSize:8}}><CheckCircle2 size={9}/> SIGNOFF VERIFIED</span>}
                                                        </div>
                                                        <div className="exec-task-engineer">{block.assignedEngineer?.displayName||'Unassigned'} • {action}</div>
                                                        <div className="exec-task-row">
                                                            <span className={`exec-tag ${status.cls}`}>{status.label}</span>
                                                            {over>0.1&&<span className="exec-tag exec-tag-red">SLA breached: +{fmt(over)}</span>}
                                                            {!isTapeout&&age>0&&<span className="exec-tag exec-tag-gray">{age.toFixed(1)}d in flow</span>}
                                                            {isTapeout&&<span className="exec-tag exec-tag-gray">Exec time: {fmt(block.totalTimeSpent)}</span>}
                                                        </div>
                                                        {(depLbl||cause)&&<div className="exec-task-detail">{depLbl&&<span>{depLbl}</span>}{depLbl&&cause&&' • '}{cause&&<span>{cause}</span>}</div>}
                                                    </div>
                                                    <div className="exec-task-actions" onClick={e=>e.stopPropagation()}>
                                                        {block.status==='REVIEW'&&<><button className="exec-action-btn exec-action-approve" onClick={()=>onReview?.(block._id,'APPROVE')}>Signoff</button><button className="exec-action-btn exec-action-reject" onClick={()=>onReview?.(block._id,'REJECT')}>Return</button></>}
                                                        {isTapeout&&<button className="exec-action-btn exec-action-approve" style={{padding:'6px 16px', background:'var(--green)', color:'white'}} onClick={() => onRelease?.(block._id)}>RELEASE TO TAPEOUT</button>}
                                                        {!isTapeout&&block.status!=='REVIEW'&&<button className="exec-action-btn exec-action-detail" onClick={()=>onSelectBlock?.(block)}>Orchestrate</button>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {isOpen&&!items.length&&<div className="exec-lane-empty">No active workflows in {SLABELS[stage]}</div>}
                            </div>
                        );
                    })}
                </div>

                <div className="exec-side">
                    <div className="exec-panel">
                        <div className="exec-panel-title"><Zap size={11}/> Stage Pressure</div>
                        {stagePressure.map(s=><div key={s.stage} className="exec-dispatch-item"><div><div className="exec-dispatch-name" style={{color:s.color}}>{SLABELS[s.stage]}</div><div className="exec-dispatch-detail">{s.count} modules • avg {fmt(s.avg)}</div></div><div className="exec-dispatch-util" style={{color:s.overCount?'var(--red)':'var(--green)'}}>{s.count}</div></div>)}
                    </div>

                    <div className="exec-panel">
                        <div className="exec-panel-title"><User size={11}/> Engineer Dispatch</div>
                        {profiles.slice(0,5).map(p=><div key={p.id} className="exec-dispatch-item"><div><div className="exec-dispatch-name">{p.name}</div><div className="exec-dispatch-detail">{p.exp||'Idle'} • Workload: {p.weight.toFixed(1)}w</div></div><div className="exec-dispatch-util" style={{color:p.util>=85?'var(--red)':p.util>=60?'var(--amber)':'var(--green)'}}>{p.util}%</div></div>)}
                    </div>

                    <div className="exec-panel">
                        <div className="exec-panel-title"><Shield size={11}/> Execution Intelligence</div>
                        {recs.length > 0 ? (
                            recs.map((r,i)=><div key={i} className="exec-rec">{r}</div>)
                        ) : (
                            <div className="exec-lane-empty" style={{padding:'12px 0', textAlign:'left'}}>No critical bottlenecks detected. Execution nominal.</div>
                        )}
                    </div>


                    <div className="exec-panel">
                        <div className="exec-panel-title"><Clock size={11}/> Estimation Precision</div>
                        <div style={{ padding: '4px 0 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>System Accuracy</span>
                                <span style={{ fontWeight: 700, color: estMetrics.accuracy < 85 ? 'var(--amber)' : 'var(--green)' }}>{estMetrics.accuracy.toFixed(1)}%</span>
                            </div>
                            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${estMetrics.accuracy}%`, background: estMetrics.accuracy < 85 ? 'var(--amber)' : 'var(--green)' }} />
                            </div>
                        </div>
                        {estMetrics.topVariance.map(v => (
                            <div key={v.name} className="exec-dispatch-item">
                                <div style={{ flex: 1 }}>
                                    <div className="exec-dispatch-name">{v.name}</div>
                                    <div className="exec-dispatch-detail">Est: {fmt(v.est)} • Act: {fmt(v.act)}</div>
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: v.diff > 0 ? 'var(--red)' : 'var(--green)' }}>
                                    {v.diff > 0 ? '+' : ''}{fmt(v.diff)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecutionTab;
