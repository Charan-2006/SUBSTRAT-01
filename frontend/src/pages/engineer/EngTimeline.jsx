import React, { useMemo } from 'react';
import { Activity, Clock, Zap, ShieldAlert } from 'lucide-react';

const EngTimeline = ({ myBlocks = [] }) => {
    const events = useMemo(() => {
        const ev = [];
        myBlocks.forEach(b => {
            (b.stageHistory || []).forEach((s, i) => {
                if (s.startTime) ev.push({ 
                    t: new Date(s.startTime), 
                    txt: <><strong>{b.name}</strong> entered {s.stage.replace('_', ' ')}</>, 
                    clr: '#2563eb', 
                    k: `${b._id}s${i}` 
                });
                if (s.endTime) ev.push({ 
                    t: new Date(s.endTime), 
                    txt: <><strong>{b.name}</strong> completed {s.stage.replace('_', ' ')} ({s.durationHours ? s.durationHours.toFixed(1) + 'h' : '—'})</>, 
                    clr: '#16a34a', 
                    k: `${b._id}e${i}` 
                });
            });
            if (b.rejectionCount > 0 && b.updatedAt) ev.push({ 
                t: new Date(b.updatedAt), 
                txt: <><strong>{b.name}</strong> review rejected{b.rejectionReason ? `: ${b.rejectionReason}` : ''}</>, 
                clr: '#ef4444', 
                k: `${b._id}r` 
            });
            if (b.status === 'COMPLETED' && b.updatedAt) ev.push({ 
                t: new Date(b.updatedAt), 
                txt: <><strong>{b.name}</strong> tapeout-ready</>, 
                clr: '#16a34a', 
                k: `${b._id}c` 
            });
        });
        return ev.sort((a, b) => b.t - a.t).slice(0, 40);
    }, [myBlocks]);

    const grouped = useMemo(() => {
        const g = {};
        events.forEach(e => {
            const d = e.t.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
            if (!g[d]) g[d] = [];
            g[d].push(e);
        });
        return g;
    }, [events]);

    const stageAverages = useMemo(() => {
        const stats = {};
        myBlocks.forEach(b => (b.stageHistory || []).forEach(h => {
            if (h.durationHours) {
                if (!stats[h.stage]) stats[h.stage] = [];
                stats[h.stage].push(h.durationHours);
            }
        }));
        return Object.entries(stats).map(([k, v]) => ({
            stage: k.replace('_', ' '),
            avg: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)
        }));
    }, [myBlocks]);

    return (
        <div className="ew-page-content fade-in">
            <div className="ew-sh"><Activity size={14} /> Execution Timeline ({events.length} Events)</div>
            
            <div className="ew-grid">
                <div className="ew-col">
                    {Object.entries(grouped).map(([date, evts]) => (
                        <div key={date} style={{ marginBottom: 24 }}>
                            <div className="ew-tl-date" style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 4 }}>{date}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {evts.map((e, i) => (
                                    <div key={e.k} className="ew-tl-ev" style={{ display: 'flex', gap: 16 }}>
                                        <div className="ew-tl-rail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12 }}>
                                            <div className="ew-tl-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: e.clr, marginTop: 12 }} />
                                            {i < evts.length - 1 && <div className="ew-tl-line" style={{ flex: 1, width: 2, background: 'var(--border-light)', minHeight: 20 }} />}
                                        </div>
                                        <div className="ew-tl-card" style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 8, marginBottom: 8, transition: '0.2s' }}>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{e.txt}</div>
                                            <div className="ew-tl-time" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)' }}>{e.t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {!events.length && <div className="ew-empty">No execution history detected.</div>}
                </div>

                <div className="ew-side">
                    {stageAverages.length > 0 && (
                        <div className="ew-sp">
                            <div className="ew-sp-title"><Clock size={12} /> Stage Performance</div>
                            <div className="ew-sp-content">
                                {stageAverages.map(v => (
                                    <div key={v.stage} className="ew-sp-row">
                                        <span>{v.stage}</span>
                                        <span style={{ fontWeight: 800 }}>{v.avg}h avg</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="ew-sp" style={{ background: 'var(--bg)', borderStyle: 'dashed' }}>
                        <div className="ew-sp-title"><ShieldAlert size={12} /> Summary</div>
                        <div className="ew-sp-content">
                            <div className="ew-sp-row">
                                <span>Total Events</span>
                                <span style={{ fontWeight: 800 }}>{events.length}</span>
                            </div>
                            <div className="ew-sp-row">
                                <span>Active Workflows</span>
                                <span style={{ fontWeight: 800 }}>{myBlocks.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EngTimeline;
