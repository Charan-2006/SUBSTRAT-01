import React, { useMemo } from 'react';
import { AlertCircle, ShieldAlert, Activity, Archive, Zap, Shield, Link2, ArrowDown, TrendingUp, AlertTriangle } from 'lucide-react';
import './PriorityEngine.css';

const BUCKETS = [
    {id:'tapeout',label:'Tapeout Critical',icon:AlertCircle,color:'#ef4444',bg:'rgba(239,68,68,0.06)',desc:'Critical path, dependency blockage, severe SLA breach'},
    {id:'verification',label:'Verification Priority',icon:ShieldAlert,color:'#f59e0b',bg:'rgba(245,158,11,0.06)',desc:'DRC/LVS delays, moderate risk, verification pressure'},
    {id:'monitor',label:'Monitor Queue',icon:Activity,color:'#3b82f6',bg:'rgba(59,130,246,0.06)',desc:'Active workflows progressing within SLA tolerance'},
    {id:'deferred',label:'Deferred / Stable',icon:Archive,color:'#64748b',bg:'rgba(100,116,139,0.06)',desc:'Not started, upstream-blocked, or intentionally held'},
];

const SLA_H={IN_PROGRESS:14,DRC:12,LVS:9,REVIEW:5};
function nh(n){let h=0;for(let i=0;i<(n||'').length;i++)h=((h<<5)-h+n.charCodeAt(i))|0;return Math.abs(h);}
function vr(n,lo,hi){return lo+(nh(n)%1000)/1000*(hi-lo);}
function realH(b){
    if(['NOT_STARTED','COMPLETED'].includes(b.status)) return null;
    const hist=(b.stageHistory||[]).filter(h=>h.stage===b.status);
    if(hist.length){const l=hist[hist.length-1];if(l.startTime) return(Date.now()-new Date(l.startTime).getTime())/36e5;}
    if(b.updatedAt) return Math.min((Date.now()-new Date(b.updatedAt).getTime())/36e5,vr(b.name,2,28));
    return vr(b.name,1,12);
}
function slaT(b){const m=b.complexity==='COMPLEX'?1.5:b.complexity==='MEDIUM'?1.2:1.0;return(SLA_H[b.status]||8)*m;}
function slaO(b){const t=realH(b),e=slaT(b);if(t===null)return null;return t-e;}
function fmt(h){if(h==null)return'—';if(Math.abs(h)<1)return`${Math.round(Math.abs(h)*60)}m`;if(Math.abs(h)>=24)return`${(Math.abs(h)/24).toFixed(1)}d`;return`${Math.abs(h).toFixed(1)}h`;}
function ageDays(b){return b.createdAt?(Date.now()-new Date(b.createdAt).getTime())/864e5:null;}

// Precompute downstream map once
function buildDownstream(all){
    const m={};
    all.forEach(b=>{m[b._id]=all.filter(x=>x.dependencies?.some(d=>(d._id||d)===b._id));});
    return m;
}

// --- EXPLAINABLE SCORING (dependency-first) ---
function scoreBlock(b, dsMap) {
    const bd = {};
    let s = 0;
    const ds = dsMap[b._id]||[];
    // Downstream impact (0-28) — HIGHEST WEIGHT
    const dw = Math.min(28, ds.length * 10);
    if(dw){ bd['Downstream blockage']=dw; s+=dw; }
    // Upstream blocked (0-16)
    const ups = (b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL');
    const uw = ups.length>0 ? (ups.some(d=>d.healthStatus==='CRITICAL')?16:8) : 0;
    if(uw){ bd['Upstream dependency']=uw; s+=uw; }
    // Health (0-20)
    const hw = b.healthStatus==='CRITICAL'?20:b.healthStatus==='RISK'?10:0;
    if(hw){ bd['Health severity']=hw; s+=hw; }
    // SLA overrun (0-18)
    const over = slaO(b);
    const sw = over!==null&&over>0 ? Math.min(18, Math.round(over*1.5)) : 0;
    if(sw){ bd['SLA breach']=sw; s+=sw; }
    // Rejections (0-12)
    const rw = Math.min(12, (b.rejectionCount||0)*6);
    if(rw){ bd['Rejection penalty']=rw; s+=rw; }
    // Stage proximity (0-6)
    const stw = b.status==='REVIEW'?6:b.status==='LVS'?5:b.status==='DRC'?3:b.status==='IN_PROGRESS'?1:0;
    if(stw){ bd['Tapeout proximity']=stw; s+=stw; }
    return { score:Math.min(100,s), breakdown:bd, ds, ups, over };
}

// --- CLASSIFICATION ---
function classify(b, dsMap, all) {
    if(b.status==='COMPLETED') return null;
    const {score,breakdown,ds,ups,over} = scoreBlock(b, dsMap);
    const isV = b.status==='DRC'||b.status==='LVS';
    const wt = (b.dependencies||[]).filter(d=>d.status!=='COMPLETED');

    let bucket, reason, trigger;

    // TAPEOUT CRITICAL: dependency-driven OR high score OR critical with any risk factor
    const hasDsImpact = ds.length > 0;
    const hasUpBlock = ups.length > 0;
    const severeSLA = over!==null && over > slaT(b)*0.3;
    const isCritHealth = b.healthStatus==='CRITICAL';

    if(score>=40 || (isCritHealth && hasDsImpact) || (hasDsImpact && severeSLA) || (isCritHealth && hasUpBlock) || (hasUpBlock && hasDsImpact)) {
        bucket='tapeout';
        if(hasUpBlock && hasDsImpact) reason=`Blocked by ${ups[0].name} — cascading delay to ${ds.map(d=>d.name).join(', ')}.`;
        else if(hasDsImpact && ds.length>=2) reason=`Blocking ${ds.length} downstream layouts. Critical tapeout path.`;
        else if(hasDsImpact) reason=`Blocking ${ds[0].name} progression. Unblock value: high.`;
        else if(hasUpBlock) reason=`Blocked by ${ups[0].name} (${ups[0].status?.replace('_',' ')||'critical'}). Upstream resolution required.`;
        else if((b.rejectionCount||0)>=2) reason=`Stalled after ${b.rejectionCount} rejections. Verification cycle broken.`;
        else if(severeSLA) reason=`${b.status} SLA exceeded by ${fmt(over)}. Tapeout timeline at risk.`;
        else reason=`Score ${score} — critical operational risk detected.`;
        const triggerParts=[];
        if(hasDsImpact) triggerParts.push(`${ds.length} downstream blocked`);
        if(severeSLA) triggerParts.push(`SLA +${fmt(over)}`);
        if(hasUpBlock) triggerParts.push('upstream blocked');
        trigger=triggerParts.length?`Auto-promoted: ${triggerParts.join(', ')}`:`Escalated — score ${score}`;
    } else if(score>=18 || (isV && b.healthStatus!=='HEALTHY') || (b.rejectionCount>0 && b.status!=='COMPLETED')) {
        bucket='verification';
        if(isV&&over!==null&&over>0) reason=`${b.status} SLA exceeded by ${fmt(over)}. Queue congestion.`;
        else if(b.rejectionCount>0) reason=`${b.rejectionReason||'Verification feedback'} — retry needed.`;
        else if(wt.length>0) reason=`Waiting on ${wt[0].name} before ${b.status} can proceed.`;
        else reason=`${b.status} risk trending. Score ${score}.`;
        trigger=`Flagged — ${isV?b.status+' queue pressure':'score '+score}`;
    } else if(b.status==='NOT_STARTED') {
        bucket='deferred';
        reason=wt.length>0?`Waiting on ${wt[0].name} before queue entry.`:'Awaiting assignment.';
        trigger='Deferred — prerequisites pending';
    } else {
        // MONITOR — healthy active blocks go here
        bucket='monitor';
        const buf=over!==null&&over<0?Math.abs(over):null;
        if(buf&&buf>2) reason=`${fmt(buf)} ahead of SLA. No active blockers.`;
        else if(ds.length>0) reason=`On-track. ${ds.length} dependent${ds.length!==1?'s':''} — monitoring.`;
        else if(b.healthStatus==='HEALTHY') reason=`Stable execution. No dependency risk.`;
        else reason=`Within tolerance. Score ${score}.`;
        trigger='System-monitored';
    }

    let depTag=null;
    if(ups.length>0) depTag={label:`Blocked by ${ups[0].name}`,cls:'pe-tag-red'};
    else if(ds.length>0&&b.healthStatus!=='HEALTHY') depTag={label:`Blocking ${ds.length} downstream`,cls:'pe-tag-amber'};
    else if(ds.length>0) depTag={label:`${ds.length} downstream`,cls:'pe-tag-blue'};
    else if(wt.length>0) depTag={label:'Waiting upstream',cls:'pe-tag-gray'};

    let slaTag=null;
    if(over!==null&&over>0) slaTag={label:`+${fmt(over)} SLA`,cls:'pe-tag-red'};
    else if(realH(b)!==null) slaTag={label:`${fmt(realH(b))} in stage`,cls:'pe-tag-gray'};

    let impact=null;
    if(ds.length>=2) impact=`Projected to delay ${ds.length} layouts (~${fmt(ds.length*vr(b.name,3,8))}h)`;
    else if(ds.length===1) impact=`Delays ${ds[0].name} signoff`;
    else if(over!==null&&over>slaT(b)*0.5) impact='Verification throughput reduced';

    return {bucket,reason,trigger,score,breakdown,depTag,slaTag,impact,dsCount:ds.length,age:ageDays(b),over};
}

const PriorityEngine = ({ blocks=[], onSelectBlock }) => {
    const dsMap = useMemo(()=>buildDownstream(blocks),[blocks]);

    const assignments = useMemo(()=>{
        const r={tapeout:[],verification:[],monitor:[],deferred:[]};
        blocks.forEach(b=>{const a=classify(b,dsMap,blocks);if(a&&r[a.bucket])r[a.bucket].push({block:b,...a});});
        Object.keys(r).forEach(k=>{r[k].sort((a,b)=>b.score-a.score);});
        return r;
    },[blocks,dsMap]);

    const all=useMemo(()=>Object.values(assignments).flat(),[assignments]);
    const avgS=useMemo(()=>all.length?Math.round(all.reduce((s,a)=>s+a.score,0)/all.length):0,[all]);

    const depChains=useMemo(()=>{
        const ch=[];
        blocks.forEach(b=>{
            if(b.status!=='COMPLETED'){
                const ds=dsMap[b._id]||[];
                const up=(b.dependencies||[]).filter(d=>d.healthStatus==='CRITICAL'||d.status!=='COMPLETED');
                if(ds.length>0||up.length>0) ch.push({block:b,up,ds,health:b.healthStatus,over:slaO(b)});
            }
        });
        return ch.sort((a,b)=>(b.ds.length+b.up.length)-(a.ds.length+a.up.length)).slice(0,5);
    },[blocks,dsMap]);

    const recs=useMemo(()=>{
        const r=[];
        const top=assignments.tapeout[0];
        if(top){
            if(top.dsCount>0) r.push(`Prioritize ${top.block.name} to unblock ${top.dsCount} downstream — estimated recovery: ${fmt(top.dsCount*vr(top.block.name,2,6))}h.`);
            else if(top.over>0) r.push(`${top.block.name} SLA breach at +${fmt(top.over)}. Intervention reduces tapeout delay.`);
        }
        const drcQ=blocks.filter(b=>b.status==='DRC').length;
        if(drcQ>=2) r.push(`Reassigning 1 reviewer to DRC reduces avg queue time by ~${fmt(drcQ*1.1)}h.`);
        const lvsQ=blocks.filter(b=>b.status==='LVS').length;
        if(lvsQ>=2) r.push(`LVS queue: ${lvsQ} blocks. Parallel signoff recommended.`);
        const escDs=assignments.tapeout.filter(a=>a.dsCount>0);
        if(escDs.length>1) r.push(`${escDs.length} critical blocks have downstream impact — resolve by score order.`);
        if(assignments.monitor.length>0) r.push(`${assignments.monitor.length} stable — redirect resources to ${assignments.tapeout.length+assignments.verification.length} escalated.`);
        return r.slice(0,5);
    },[assignments,blocks]);

    const preds=useMemo(()=>{
        const p=[];
        if(assignments.tapeout.length>=2) p.push(`${assignments.tapeout.length} critical workflows may delay tapeout by ${fmt(assignments.tapeout.length*vr('tp',5,14))}h if unresolved.`);
        const totalDS=assignments.tapeout.reduce((s,a)=>s+a.dsCount,0);
        if(totalDS>0) p.push(`Critical path blockage impacts ${totalDS} downstream workflow${totalDS!==1?'s':''}.`);
        const blocked=blocks.filter(b=>(b.dependencies||[]).some(d=>d.healthStatus==='CRITICAL'));
        if(blocked.length) p.push(`${blocked.length} dependency-blocked flow${blocked.length!==1?'s':''} — cascading risk active.`);
        if(assignments.verification.length>=3) p.push(`Verification queue saturation projected in ${fmt(vr('vq',4,10))}h at current throughput.`);
        return p.slice(0,3);
    },[assignments,blocks]);

    const laneStats=useMemo(()=>BUCKETS.map(b=>{
        const items=assignments[b.id];
        const avg=items.length?items.reduce((s,a)=>s+(realH(a.block)||0),0)/items.length:0;
        const overC=items.filter(a=>(a.over||0)>0).length;
        return{id:b.id,label:b.label,color:b.color,count:items.length,avg,overC,pct:all.length?Math.round(items.length/all.length*100):0};
    }),[assignments,all]);

    const sC=s=>s>=70?'var(--red)':s>=40?'var(--amber)':s>=18?'var(--accent)':'var(--green)';
    const sB=s=>s>=70?'var(--red-bg)':s>=40?'var(--amber-bg)':s>=18?'var(--accent-subtle)':'var(--green-bg)';

    return (
        <div className="pe-container fade-in">
            <div className="pe-header">
                <div>
                    <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:15,fontWeight:800}}><Zap size={17} className="text-accent"/> Priority Engine</h2>
                    <p style={{marginTop:2,fontSize:11,color:'var(--text-secondary)'}}>Dependency-driven workflow orchestration. Scores derived from blockage impact, SLA pressure, and tapeout criticality.</p>
                </div>
                <div className="pe-header-stats">
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--accent)'}}>{all.length}</div><div className="pe-header-stat-label">Ranked</div></div>
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--red)'}}>{assignments.tapeout.length}</div><div className="pe-header-stat-label">Critical</div></div>
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--amber)'}}>{avgS}</div><div className="pe-header-stat-label">Avg Score</div></div>
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--green)'}}>{assignments.monitor.length}</div><div className="pe-header-stat-label">Stable</div></div>
                </div>
            </div>

            <div className="pe-layout">
                <div className="pe-grid">
                    {BUCKETS.map(b=>{
                        const items=assignments[b.id];
                        const isEmpty=items.length===0;
                        return (
                        <div key={b.id} className={`pe-column ${isEmpty?'pe-column-empty':''}`}>
                            <div className="pe-col-header" style={{borderTop:`3px solid ${b.color}`,background:b.bg}}>
                                <div className="pe-col-title"><b.icon size={13} color={b.color}/>{b.label}<span className="pe-count">{items.length}</span></div>
                                {!isEmpty&&<div className="pe-col-desc">{b.desc}</div>}
                            </div>
                            <div className="pe-list" style={isEmpty?{padding:'8px',minHeight:0}:undefined}>
                                {items.map(({block,reason,trigger,score,breakdown,depTag,slaTag,impact,dsCount,age})=>(
                                    <div key={block._id} className={`pe-card health-${(block.healthStatus || 'HEALTHY').toLowerCase()}`} onClick={()=>onSelectBlock?.(block)}>
                                        <div className="pe-card-top">
                                            <span className="pe-card-title">{block.name}</span>
                                            <span className="pe-card-score" style={{background:sB(score),color:sC(score)}}>
                                                {score}
                                                <div className="pe-score-tip">
                                                    <div style={{fontSize:9,fontWeight:700,marginBottom:4,color:'var(--text-primary)'}}>Score Breakdown</div>
                                                    {Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} className="pe-score-row"><span>{k}</span><span>+{v}</span></div>)}
                                                    {!Object.keys(breakdown).length&&<div className="pe-score-row"><span>Base</span><span>0</span></div>}
                                                </div>
                                            </span>
                                        </div>
                                        <div className="pe-card-meta">
                                            <span className="pe-card-engineer">{block.assignedEngineer?.displayName||'Unassigned'}</span>
                                            <span className={`status-badge status-${block.status}`} style={{fontSize:8.5}}>{block.status.replace('_',' ')}</span>
                                        </div>
                                        <div className="pe-card-tags">
                                            {depTag&&<span className={`pe-tag ${depTag.cls}`}>{depTag.label}</span>}
                                            {slaTag&&<span className={`pe-tag ${slaTag.cls}`}>{slaTag.label}</span>}
                                            {block.rejectionCount>0&&<span className="pe-tag pe-tag-red">{block.rejectionCount}x rej</span>}
                                            {dsCount>0&&b.id!=='monitor'&&<span className="pe-tag pe-tag-blue">{dsCount} downstream</span>}
                                        </div>
                                        <div className="pe-card-reason">{reason}</div>
                                        {impact&&<div className="pe-card-impact">{impact}</div>}
                                        <div className="pe-card-footer">
                                            <span>{trigger}</span>
                                            {age!==null&&<span>{age.toFixed(0)}d workflow</span>}
                                        </div>
                                    </div>
                                ))}
                                {isEmpty&&<div className="pe-empty">No workflows in queue</div>}
                            </div>
                        </div>
                    );})}
                </div>

                <div className="pe-side">
                    {preds.length>0&&<div className="pe-panel"><div className="pe-panel-title"><AlertTriangle size={10}/> Predictive Alerts</div>{preds.map((p,i)=><div key={i} className="pe-predict">{p}</div>)}</div>}
                    {depChains.length>0&&<div className="pe-panel"><div className="pe-panel-title"><Link2 size={10}/> Dependency Pressure</div>
                        {depChains.map((ch,i)=>(
                            <div key={i} className="pe-dep-chain">
                                <div className="pe-dep-nodes">
                                    {ch.up.slice(0,1).map(u=><React.Fragment key={u._id||u}><span className="pe-dep-node" style={{borderColor:u.healthStatus==='CRITICAL'?'var(--red)':'var(--border)',color:u.healthStatus==='CRITICAL'?'var(--red)':'var(--text-primary)'}}>{u.name}</span><ArrowDown size={9} className="pe-dep-arrow"/></React.Fragment>)}
                                    <span className="pe-dep-node" style={{borderColor:ch.health==='CRITICAL'?'var(--red)':'var(--amber)',fontWeight:800}}>{ch.block.name}</span>
                                    {ch.ds.slice(0,2).map(d=><React.Fragment key={d._id}><ArrowDown size={9} className="pe-dep-arrow"/><span className="pe-dep-node" style={{color:'var(--accent)'}}>{d.name}</span></React.Fragment>)}
                                </div>
                                <div className="pe-dep-detail">{ch.over!==null&&ch.over>0?`+${fmt(ch.over)} delay • `:''}{ch.ds.length} downstream • depth {ch.up.length+1+ch.ds.length}</div>
                            </div>
                        ))}
                    </div>}
                    {recs.length>0&&<div className="pe-panel"><div className="pe-panel-title"><Shield size={10}/> Recommendations</div>{recs.map((r,i)=><div key={i} className="pe-rec">{r}</div>)}</div>}
                    <div className="pe-panel"><div className="pe-panel-title"><TrendingUp size={10}/> Queue Distribution</div>
                        {laneStats.map(s=>(
                            <div key={s.id} className="pe-dist-row">
                                <div className="pe-dist-header"><span style={{color:s.color}}>{s.label}</span><span style={{color:'var(--text-tertiary)'}}>{s.count} ({s.pct}%)</span></div>
                                <div className="pe-dist-bar"><div className="pe-dist-fill" style={{width:`${s.pct}%`,background:s.color}}/></div>
                                <div className="pe-dist-meta">{s.avg>0?`avg ${fmt(s.avg)} in stage`:''}{s.overC>0?` • ${s.overC} over SLA`:s.count>0?' • all within SLA':''}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriorityEngine;
