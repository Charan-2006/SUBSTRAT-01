import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { Shield, Search, Activity, AlertTriangle, ChevronRight, ArrowRight, Clock, Zap, User } from 'lucide-react';
import './AuditTrail.css';

const FILTERS = ['All','Escalations','Rejections','Approvals','Assignments','Status Changes'];
const SEV_COLORS = { critical:'var(--red)', escalated:'#f97316', warning:'var(--amber)', rejected:'var(--red)', approved:'var(--green)', info:'var(--accent)' };

function classifyEvent(log) {
    const a = (log.action||'').toUpperCase();
    if (a.includes('REJECT')||log.newValue==='REJECTED') return { sev:'rejected', badge:'Rejected', bg:'var(--red-bg)', fg:'var(--red-text)' };
    if (a.includes('ALERT')||(log.newValue==='CRITICAL')) return { sev:'critical', badge:'Critical', bg:'var(--red-bg)', fg:'var(--red-text)' };
    if (log.newValue==='RISK'||a.includes('ESCALAT')) return { sev:'escalated', badge:'Escalated', bg:'var(--amber-bg)', fg:'var(--amber-text)' };
    if (a.includes('APPROV')||log.newValue==='COMPLETED') return { sev:'approved', badge:'Approved', bg:'var(--green-bg)', fg:'var(--green-text)' };
    if (a.includes('ASSIGN')) return { sev:'info', badge:'Assignment', bg:'var(--accent-subtle)', fg:'var(--accent)' };
    return { sev:'info', badge:a.replace('_',' '), bg:'var(--bg)', fg:'var(--text-secondary)' };
}

function enrichMessage(log) {
    const a = (log.action||'').toUpperCase();
    const block = log.blockId?.name || '—';
    const user = log.userId?.displayName || 'System';
    if (a.includes('REJECT')) return `${block} review rejected by ${user}.${log.message?' '+log.message:''}`;
    if (a.includes('ASSIGN')) return `${block} assigned to ${user}.`;
    if (log.previousValue && log.newValue) return `${block} transitioned ${log.previousValue} → ${log.newValue}.${log.message?' '+log.message:''}`;
    return log.message || `${a.replace('_',' ')} on ${block}.`;
}

const AuditTrailTab = ({ blocks=[], engineers=[] }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');
    const [replayBlock, setReplayBlock] = useState(null);

    useEffect(()=>{
        api.get('/blocks/logs/all').then(r=>setLogs(r.data.data||[])).catch(()=>{}).finally(()=>setLoading(false));
    },[]);

    // Filter + search
    const filtered = useMemo(()=>{
        let l = [...logs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
        if(search.trim()){const q=search.toLowerCase();l=l.filter(x=>(x.blockId?.name||'').toLowerCase().includes(q)||(x.message||'').toLowerCase().includes(q)||(x.userId?.displayName||'').toLowerCase().includes(q));}
        if(filter==='Escalations') l=l.filter(x=>classifyEvent(x).sev==='critical'||classifyEvent(x).sev==='escalated');
        else if(filter==='Rejections') l=l.filter(x=>classifyEvent(x).sev==='rejected');
        else if(filter==='Approvals') l=l.filter(x=>classifyEvent(x).sev==='approved');
        else if(filter==='Assignments') l=l.filter(x=>(x.action||'').toUpperCase().includes('ASSIGN'));
        else if(filter==='Status Changes') l=l.filter(x=>(x.action||'').toUpperCase().includes('STATUS'));
        return l;
    },[logs,search,filter]);

    // Group by date
    const grouped = useMemo(()=>{
        const g={};
        filtered.forEach(l=>{
            const d=new Date(l.timestamp).toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'});
            if(!g[d])g[d]=[];g[d].push(l);
        });
        return g;
    },[filtered]);

    // Stats
    const stats = useMemo(()=>{
        const esc=logs.filter(l=>classifyEvent(l).sev==='critical'||classifyEvent(l).sev==='escalated').length;
        const rej=logs.filter(l=>classifyEvent(l).sev==='rejected').length;
        const app=logs.filter(l=>classifyEvent(l).sev==='approved').length;
        return { total:logs.length, esc, rej, app, rate:app+rej>0?Math.round(app/(app+rej)*100):100 };
    },[logs]);

    // Anomalies from block data
    const anomalies = useMemo(()=>{
        const a=[];
        blocks.forEach(b=>{
            if(b.rejectionCount>=2) a.push(`${b.name}: ${b.rejectionCount} rejections — repeated review failure.`);
        });
        const critBlocks=blocks.filter(b=>b.healthStatus==='CRITICAL'&&b.status!=='COMPLETED');
        if(critBlocks.length>=2) a.push(`${critBlocks.length} workflows simultaneously critical — systemic risk.`);
        const drcQ=blocks.filter(b=>b.status==='DRC').length;
        if(drcQ>=3) a.push(`DRC queue stagnation: ${drcQ} blocks queued.`);
        return a.slice(0,4);
    },[blocks]);

    // Insights
    const insights = useMemo(()=>{
        const r=[];
        if(stats.rej>0) r.push(`${stats.rej} rejection event${stats.rej!==1?'s':''} recorded. Approval rate: ${stats.rate}%.`);
        const topBlock={}; logs.forEach(l=>{const n=l.blockId?.name;if(n)topBlock[n]=(topBlock[n]||0)+1;});
        const top=Object.entries(topBlock).sort((a,b)=>b[1]-a[1])[0];
        if(top) r.push(`Most active workflow: ${top[0]} (${top[1]} events).`);
        if(stats.esc>0) r.push(`${stats.esc} escalation/critical event${stats.esc!==1?'s':''} detected.`);
        return r.slice(0,4);
    },[logs,stats]);

    // Replay: build stage history for selected block
    const replay = useMemo(()=>{
        if(!replayBlock) return null;
        const b = blocks.find(x=>x._id===replayBlock||x.name===replayBlock);
        if(!b) return null;
        const steps = (b.stageHistory||[]).map(h=>({
            stage:h.stage.replace('_',' '), start:h.startTime?new Date(h.startTime):null,
            dur:h.durationHours, end:h.endTime?new Date(h.endTime):null
        }));
        if(b.rejectionCount>0) steps.push({stage:'REJECTION',start:b.updatedAt?new Date(b.updatedAt):null,dur:null,note:`${b.rejectionCount}x rejected`});
        return { name:b.name, health:b.healthStatus, current:b.status, steps };
    },[replayBlock,blocks]);

    // Block list for sidebar
    const blockList = useMemo(()=>{
        const map={};
        logs.forEach(l=>{const n=l.blockId?.name;const id=l.blockId?._id;if(n&&id){if(!map[id])map[id]={name:n,id,count:0};map[id].count++;}});
        return Object.values(map).sort((a,b)=>b.count-a.count).slice(0,8);
    },[logs]);

    const fmt = d=>d?new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—';
    const fmtH = h=>h==null?'—':h<1?`${Math.round(h*60)}m`:h>=24?`${(h/24).toFixed(1)}d`:`${h.toFixed(1)}h`;

    return (
        <div className="at-container">
            <div className="at-command">
                <div className="at-search"><Search size={12} className="at-search-icon"/><input className="at-search-input" placeholder="Search workflows, engineers, events..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
                <div className="at-filters">{FILTERS.map(f=><button key={f} className={`at-filter ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f}</button>)}</div>
                <div style={{display:'flex',gap:14,marginLeft:'auto'}}>
                    <div className="at-stat"><div className="at-stat-val" style={{color:'var(--accent)'}}>{stats.total}</div><div className="at-stat-label">Events</div></div>
                    <div className="at-stat"><div className="at-stat-val" style={{color:'var(--red)'}}>{stats.esc}</div><div className="at-stat-label">Escalated</div></div>
                    <div className="at-stat"><div className="at-stat-val" style={{color:'var(--green)'}}>{stats.rate}%</div><div className="at-stat-label">Approval</div></div>
                </div>
            </div>

            {loading ? <div className="at-loading">Loading audit logs...</div> : (
                <div className="at-layout">
                    <div className="at-timeline">
                        {Object.entries(grouped).length===0&&<div className="at-empty">No events match filters.</div>}
                        {Object.entries(grouped).map(([date,events])=>(
                            <React.Fragment key={date}>
                                <div className="at-date-header">{date}</div>
                                {events.map((log,i)=>{
                                    const ev=classifyEvent(log);
                                    const msg=enrichMessage(log);
                                    const isLast=i===events.length-1;
                                    return (
                                        <div key={log._id} className="at-event">
                                            <div className="at-event-rail">
                                                <div className="at-event-dot" style={{background:SEV_COLORS[ev.sev]||'var(--border)'}}/>
                                                {!isLast&&<div className="at-event-line"/>}
                                            </div>
                                            <div className={`at-event-card severity-${ev.sev}`} onClick={()=>{if(log.blockId?.name)setReplayBlock(log.blockId.name);}}>
                                                <div className="at-event-top">
                                                    <span className="at-event-block">{log.blockId?.name||'System'}</span>
                                                    <span className="at-event-badge" style={{background:ev.bg,color:ev.fg}}>{ev.badge}</span>
                                                    {log.userId?.displayName&&<span style={{fontSize:10,color:'var(--text-tertiary)'}}>{log.userId.displayName}</span>}
                                                    <span className="at-event-time">{fmt(log.timestamp)}</span>
                                                </div>
                                                <div className="at-event-message">{msg}</div>
                                                {log.previousValue&&log.newValue&&<div className="at-event-change"><span style={{color:'var(--text-tertiary)'}}>{log.previousValue}</span><ArrowRight size={10}/><span style={{fontWeight:600,color:'var(--text-primary)'}}>{log.newValue}</span></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="at-side">
                        {replay&&(
                            <div className="at-panel">
                                <div className="at-panel-title"><Activity size={10}/> Workflow Replay: {replay.name}</div>
                                {replay.steps.map((s,i)=>(
                                    <div key={i} className="at-replay-step">
                                        <span className="at-replay-stage" style={{color:s.stage==='REJECTION'?'var(--red)':s.stage==='COMPLETED'?'var(--green)':'var(--text-primary)'}}>{s.stage}</span>
                                        <span className="at-replay-detail">{s.note||''}{s.start?fmt(s.start):''}</span>
                                        <span className="at-replay-dur">{s.dur?fmtH(s.dur):''}</span>
                                    </div>
                                ))}
                                <div style={{fontSize:9,color:'var(--text-tertiary)',marginTop:6}}>Current: {replay.current?.replace('_',' ')} • Health: {replay.health}</div>
                            </div>
                        )}

                        <div className="at-panel">
                            <div className="at-panel-title"><Shield size={10}/> Workflows</div>
                            {blockList.map(b=>(
                                <button key={b.id} className="at-block-btn" onClick={()=>{setSearch(b.name);setReplayBlock(b.name);}}>
                                    <div className="at-block-name">{b.name}</div>
                                    <div className="at-block-detail">{b.count} events</div>
                                </button>
                            ))}
                        </div>

                        {anomalies.length>0&&<div className="at-panel">
                            <div className="at-panel-title"><AlertTriangle size={10}/> Anomalies</div>
                            {anomalies.map((a,i)=><div key={i} className="at-anomaly">{a}</div>)}
                        </div>}

                        {insights.length>0&&<div className="at-panel">
                            <div className="at-panel-title"><Zap size={10}/> Insights</div>
                            {insights.map((r,i)=><div key={i} className="at-insight">{r}</div>)}
                        </div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTrailTab;
