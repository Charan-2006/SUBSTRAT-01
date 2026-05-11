import React, { useMemo } from 'react';
import { AlertCircle, ShieldAlert, Activity, Archive, Zap, Shield, Link2, ArrowDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { calculateSLA, calculatePriorityScore, calculateBlockedState } from '../utils/workflowEngine';
import { STAGES } from '../constants/workflowStates';
import './PriorityEngine.css';

const BUCKETS = [
    {id:'tapeout',label:'Tapeout Critical',icon:AlertCircle,color:'#ef4444',bg:'rgba(239,68,68,0.06)',desc:'Critical path, dependency blockage, severe SLA breach'},
    {id:'verification',label:'Verification Priority',icon:ShieldAlert,color:'#f59e0b',bg:'rgba(245,158,11,0.06)',desc:'DRC/LVS delays, moderate risk, verification pressure'},
    {id:'monitor',label:'Monitor Queue',icon:Activity,color:'#3b82f6',bg:'rgba(59,130,246,0.06)',desc:'Active workflows progressing within SLA tolerance'},
    {id:'deferred',label:'Deferred / Stable',icon:Archive,color:'#64748b',bg:'rgba(100,116,139,0.06)',desc:'Not started, upstream-blocked, or intentionally held'},
];

function fmt(h){if(h==null)return'—';if(Math.abs(h)<0.01)return'0.0h';if(Math.abs(h)<1)return`${Math.round(Math.abs(h)*60)}m`;if(Math.abs(h)>=24)return`${(Math.abs(h)/24).toFixed(1)}d`;return`${Math.abs(h).toFixed(1)}h`;}

const PriorityEngine = ({ blocks=[], onSelectBlock }) => {
    // 1. DYNAMIC SCORING ENGINE
    const scoredBlocks = useMemo(() => {
        return blocks.filter(b => !b.isReleased && b.status !== STAGES.COMPLETED).map(b => {
            const score = calculatePriorityScore(b, blocks);
            const sla = calculateSLA(b);
            const isBlocked = calculateBlockedState(b, blocks);
            
            // Downstream impact
            const ds = blocks.filter(x => x.dependencies?.some(d => (d._id || d || d) === b._id));
            
            // Classification Logic
            let bucket = 'monitor';
            let reason = 'Nominal execution.';
            let trigger = 'System monitored';

            if (score >= 65 || (b.escalated && ds.length > 0) || (sla.delayHours > 12 && ds.length > 0)) {
                bucket = 'tapeout';
                if (b.escalated) reason = `Management escalation — blocking ${ds.length} nodes.`;
                else if (sla.delayHours > 12) reason = `Severe SLA breach (+${fmt(sla.delayHours)}) on critical path.`;
                else reason = `Cascading impact risk — score ${score}.`;
                trigger = 'Tapeout Critical';
            } else if (['DRC', 'LVS', 'REVIEW'].includes(b.status) && (score > 35 || b.rejectionCount > 0)) {
                bucket = 'verification';
                if (b.rejectionCount > 0) reason = `Repeated rejections — ${b.rejectionCount}x returned.`;
                else if (b.status === 'REVIEW') reason = `Pending manager approval — high proximity.`;
                else reason = `${b.status} signoff pressure — score ${score}.`;
                trigger = 'Verification Priority';
            } else if (score > 25 || sla.delayHours > 0 || ds.length > 2) {
                bucket = 'monitor';
                if (sla.delayHours > 0) reason = `Stalled execution (+${fmt(sla.delayHours)}). Monitor risk.`;
                else if (ds.length > 0) reason = `Growing dependency risk (${ds.length} nodes).`;
                else reason = `Medium risk detected — score ${score}.`;
                trigger = 'Monitor Queue';
            } else {
                bucket = 'deferred';
                if (isBlocked) reason = 'Healthy but blocked by upstream prerequisites.';
                else if (b.status === STAGES.NOT_STARTED) reason = 'Awaiting initial queue entry.';
                else reason = 'Healthy execution — stable state.';
                trigger = 'Deferred / Stable';
            }

            return {
                block: b,
                score,
                sla,
                isBlocked,
                ds,
                bucket,
                reason,
                trigger,
                age: b.createdAt ? (Date.now() - new Date(b.createdAt).getTime()) / 864e5 : 0
            };
        });
    }, [blocks]);

    const assignments = useMemo(() => {
        const r = { tapeout: [], verification: [], monitor: [], deferred: [] };
        scoredBlocks.forEach(sb => { if (r[sb.bucket]) r[sb.bucket].push(sb); });
        Object.keys(r).forEach(k => r[k].sort((a, b) => b.score - a.score));
        return r;
    }, [scoredBlocks]);

    const avgS = useMemo(() => scoredBlocks.length ? Math.round(scoredBlocks.reduce((s, b) => s + b.score, 0) / scoredBlocks.length) : 0, [scoredBlocks]);

    // Recs and Preds based on REAL state
    const recs = useMemo(() => {
        const r = [];
        const top = assignments.tapeout[0];
        if (top) r.push(`Prioritize ${top.block.name} to unblock ${top.ds.length} downstream components.`);
        
        const vCount = assignments.verification.length;
        if (vCount >= 3) r.push(`Verification queue saturation detected (${vCount} nodes). Parallel signoff required.`);
        
        const stalling = scoredBlocks.filter(sb => sb.sla.overrun > 0.5);
        if (stalling.length > 0) r.push(`${stalling.length} workflows stalling in stage. Request execution update.`);

        return r;
    }, [assignments, scoredBlocks]);

    const preds = useMemo(() => {
        const p = [];
        const criticalCount = assignments.tapeout.length;
        if (criticalCount > 0) p.push(`${criticalCount} critical paths at risk of delaying next milestone.`);
        
        const approachingSLA = blocks.filter(b => {
            const sla = calculateSLA(b);
            return !b.isReleased && b.status !== STAGES.COMPLETED && sla.delayHours === 0 && sla.actualHours > sla.expectedHours * 0.8;
        });
        if (approachingSLA.length > 0) p.push(`${approachingSLA.length} workflows approaching SLA threshold.`);
        
        return p;
    }, [assignments, blocks]);

    const laneStats = useMemo(() => BUCKETS.map(b => {
        const items = assignments[b.id];
        const pct = scoredBlocks.length ? Math.round((items.length / scoredBlocks.length) * 100) : 0;
        return { ...b, count: items.length, pct };
    }), [assignments, scoredBlocks]);

    const sC = s => s >= 70 ? 'var(--red)' : s >= 40 ? 'var(--amber)' : s >= 20 ? 'var(--accent)' : 'var(--green)';
    const sB = s => s >= 70 ? 'var(--red-bg)' : s >= 40 ? 'var(--amber-bg)' : s >= 20 ? 'var(--accent-subtle)' : 'var(--green-bg)';

    return (
        <div className="pe-container fade-in">
             <div className="pe-header">
                <div>
                    <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:15,fontWeight:800}}><Zap size={17} className="text-accent"/> Priority Engine</h2>
                    <p style={{marginTop:2,fontSize:11,color:'var(--text-secondary)'}}>Live orchestration intelligence. Every workflow block is dynamically scored and ranked based on real-time execution risk.</p>
                </div>
                <div className="pe-header-stats">
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--accent)'}}>{scoredBlocks.length}</div><div className="pe-header-stat-label">Tracked</div></div>
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--red)'}}>{assignments.tapeout.length}</div><div className="pe-header-stat-label">Critical</div></div>
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--amber)'}}>{avgS}</div><div className="pe-header-stat-label">Avg Score</div></div>
                    <div className="pe-header-stat"><div className="pe-header-stat-val" style={{color:'var(--green)'}}>{assignments.monitor.length}</div><div className="pe-header-stat-label">Stable</div></div>
                </div>
            </div>

            <div className="pe-layout">
                <div className="pe-grid">
                    {BUCKETS.map(b => {
                        const items = assignments[b.id];
                        const isEmpty = items.length === 0;
                        
                        return (
                            <div key={b.id} className={`pe-column ${isEmpty ? 'pe-column-empty' : ''}`}>
                                <div className="pe-col-header" style={{ borderTop: `3px solid ${b.color}`, background: b.bg }}>
                                    <div className="pe-col-title"><b.icon size={13} color={b.color} /> {b.label} <span className="pe-count">{items.length}</span></div>
                                    {!isEmpty && <div className="pe-col-desc">{b.desc}</div>}
                                </div>
                                <div className="pe-list">
                                    {items.map(({ block, score, sla, ds, reason, trigger, age }) => (
                                        <div key={block._id} className="pe-card" onClick={() => onSelectBlock?.(block)}>
                                            <div className="pe-card-top">
                                                <span className="pe-card-title">{block.name}</span>
                                                <span className="pe-card-score" style={{ background: sB(score), color: sC(score) }}>{score}</span>
                                            </div>
                                            <div className="pe-card-meta">
                                                <span className="pe-card-engineer">{block.assignedEngineer?.displayName || 'Unassigned'}</span>
                                                <span className={`status-badge status-${block.status}`} style={{ fontSize: 8.5 }}>{block.status.replace('_', ' ')}</span>
                                            </div>
                                            <div className="pe-card-tags">
                                                {sla.delayHours > 0 && <span className="pe-tag pe-tag-red">+{fmt(sla.delayHours)} SLA</span>}
                                                {ds.length > 0 && <span className="pe-tag pe-tag-blue">{ds.length} downstream</span>}
                                                {block.rejectionCount > 0 && <span className="pe-tag pe-tag-red">{block.rejectionCount}x rej</span>}
                                            </div>
                                            <div className="pe-card-reason">{reason}</div>
                                            <div className="pe-card-footer">
                                                <span>{trigger}</span>
                                                <span>{age.toFixed(0)}d flow</span>
                                            </div>
                                        </div>
                                    ))}
                                    {isEmpty && (
                                        <div className="pe-empty-state">
                                            {b.id === 'tapeout' && "No critical tapeout risks detected."}
                                            {b.id === 'verification' && "No verification-risk workflows detected."}
                                            {b.id === 'monitor' && "Monitoring inactive dependencies."}
                                            {b.id === 'deferred' && "No deferred workflows."}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pe-side">
                    <div className="pe-panel">
                        <div className="pe-panel-title"><AlertTriangle size={10}/> Predictive Alerts</div>
                        {preds.map((p, i) => <div key={i} className="pe-predict">{p}</div>)}
                        {preds.length === 0 && <div className="pe-empty-note">System nominal. No predictive risks.</div>}
                    </div>
                    
                    <div className="pe-panel">
                        <div className="pe-panel-title"><Shield size={10}/> Recommendations</div>
                        {recs.map((r, i) => <div key={i} className="pe-rec">{r}</div>)}
                        {recs.length === 0 && <div className="pe-empty-note">No recommendations.</div>}
                    </div>

                    <div className="pe-panel">
                        <div className="pe-panel-title"><TrendingUp size={10}/> Queue Distribution</div>
                        {laneStats.map(s => (
                            <div key={s.id} className="pe-dist-row">
                                <div className="pe-dist-header">
                                    <span style={{ color: s.color }}>{s.label}</span>
                                    <span style={{ color: 'var(--text-tertiary)' }}>{s.count} ({s.pct}%)</span>
                                </div>
                                <div className="pe-dist-bar"><div className="pe-dist-fill" style={{ width: `${s.pct}%`, background: s.color }} /></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriorityEngine;
