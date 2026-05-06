import React, { useMemo, useState } from 'react';
import { 
    Layout, CheckCircle2, AlertCircle, Zap, Clock, 
    TrendingUp, TrendingDown, Minus, ArrowRight, User,
    AlertTriangle, Info, BarChart2
} from 'lucide-react';
import './SummaryDashboard.css';

const REFINED_COLORS = {
    'NOT_STARTED': { fill: '#f1f5f9', border: '#94a3b8', text: '#475569' },
    'IN_PROGRESS': { fill: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
    'DRC': { fill: '#fef3c7', border: '#f59e0b', text: '#b45309' },
    'LVS': { fill: '#fef9c3', border: '#eab308', text: '#a16207' },
    'REVIEW': { fill: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
    'COMPLETED': { fill: '#d1fae5', border: '#10b981', text: '#047857' }
};

const SummaryDashboard = ({ blocks = [], analytics = {}, engineers = [], onSelectBlock, isEngineerView = false }) => {
    const [filterByStage, setFilterByStage] = useState(null);
    const [healthFilter, setHealthFilter] = useState('ALL');

    // --- Data Preparation ---
    const stats = useMemo(() => {
        const total = blocks.length;
        const healthy = blocks.filter(b => b.healthStatus === 'HEALTHY').length;
        const risk = blocks.filter(b => b.healthStatus === 'RISK').length;
        const critical = blocks.filter(b => b.healthStatus === 'CRITICAL').length;
        const completed = blocks.filter(b => b.status === 'COMPLETED').length;
        
        return [
            { id: 'TOTAL', label: 'Total Blocks', value: total, icon: Layout, color: 'var(--tl-primary)' },
            { id: 'CRITICAL', label: 'Critical', value: critical, icon: AlertCircle, color: '#ef4444' },
            { id: 'DELAY', label: 'Avg Delay', value: `${analytics?.maxAvgHours?.toFixed(1) || 0}h`, icon: Clock, color: '#f59e0b' },
            { id: 'PROGRESS', label: 'In Progress', value: total - completed - (blocks.filter(b => b.status === 'NOT_STARTED').length), icon: Zap, color: '#3b82f6' },
            { id: 'COMPLETE', label: 'Completed %', value: total > 0 ? `${((completed / total) * 100).toFixed(0)}%` : '0%', icon: CheckCircle2, color: '#10b981' }
        ];
    }, [blocks, analytics]);

    const displayBlocks = useMemo(() => {
        let filtered = blocks;
        if (filterByStage) filtered = filtered.filter(b => b.status === filterByStage);
        if (healthFilter !== 'ALL') filtered = filtered.filter(b => b.healthStatus === healthFilter);
        return filtered.slice(0, 10);
    }, [blocks, filterByStage, healthFilter]);

    const categorizedInsights = useMemo(() => {
        const critical = blocks.filter(b => b.healthStatus === 'CRITICAL').map(b => ({ text: `${b.name} is critical health.`, id: b._id, severity: 'critical' }));
        const delays = (analytics?.stageAverages || [])
            .filter(a => a.avgHours > (analytics?.maxAvgHours || 40) * 0.8)
            .map(a => ({ text: `${a.stage} stage avg delay: ${a.avgHours.toFixed(1)}h`, id: a.stage, severity: 'warning' }));
        const unassigned = blocks.filter(b => !b.assignedEngineer && b.status !== 'COMPLETED').map(b => ({ text: `Unassigned: ${b.name}`, id: b._id, severity: 'info' }));

        return { critical, delays, unassigned };
    }, [blocks, analytics]);

    return (
        <div className="summary-dashboard">
            {/* KPI Strip */}
            <div className="kpi-strip">
                {stats.map(s => (
                    <div key={s.id} className="kpi-card" onClick={() => {
                        if (s.id === 'CRITICAL') setHealthFilter('CRITICAL');
                        else { setHealthFilter('ALL'); setFilterByStage(null); }
                    }}>
                        <div className="kpi-card-header">
                            <div className="kpi-icon-box" style={{ color: s.color }}>
                                <s.icon size={18} />
                            </div>
                        </div>
                        <div className="kpi-value">{s.value}</div>
                        <div className="kpi-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Bottleneck Card */}
            {!isEngineerView && analytics?.bottleneckStage && (
                <div className="bottleneck-card">
                    <div className="bottleneck-info">
                        <div className="bottleneck-meta">CURRENT SYSTEM BOTTLENECK</div>
                        <h3>{analytics.bottleneckStage} Stage</h3>
                        <div className="bottleneck-meta">Blocks are spending {analytics.maxAvgHours?.toFixed(1)}h on average in this stage.</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => window.location.hash = '#timeline'}>
                        View in Timeline <ArrowRight size={16} style={{ marginLeft: 8 }} />
                    </button>
                </div>
            )}

            <div className="summary-content-grid">
                {/* Left Column: Metrics & List */}
                <div className="summary-main-column">
                    <div className="dashboard-card" style={{ marginBottom: 24 }}>
                        <div className="dashboard-card-title"><BarChart2 size={16} /> Workflow Distribution</div>
                        <div className="workflow-bars" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'].map(stage => {
                                const count = blocks.filter(b => b.status === stage).length;
                                const percentage = blocks.length > 0 ? (count / blocks.length) * 100 : 0;
                                const styles = REFINED_COLORS[stage];
                                return (
                                    <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: 'var(--tl-text-secondary)' }}>{stage.replace('_', ' ')}</div>
                                        <div style={{ flex: 1, height: 8, background: 'var(--tl-bg)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ width: `${percentage}%`, height: '100%', background: styles.border }} />
                                        </div>
                                        <div style={{ width: 40, fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="dashboard-table-card">
                        <div className="dashboard-table-header">
                            <h2>{healthFilter !== 'ALL' ? `${healthFilter} Health Blocks` : (filterByStage ? `${filterByStage} Stage` : 'Active Blocks')}</h2>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {(healthFilter !== 'ALL' || filterByStage) && (
                                    <button className="btn btn-sm" onClick={() => { setHealthFilter('ALL'); setFilterByStage(null); }}>Clear Filters</button>
                                )}
                                <span style={{ fontSize: 12, color: 'var(--tl-text-secondary)' }}>Showing {displayBlocks.length} items</span>
                            </div>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Block Name</th>
                                        <th>Status</th>
                                        <th>Assignee</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayBlocks.map(block => (
                                        <tr key={block._id} onClick={() => onSelectBlock && onSelectBlock(block)} style={{ cursor: 'pointer' }}>
                                            <td style={{ fontWeight: 700, color: 'var(--tl-primary)' }}>{block.name}</td>
                                            <td>
                                                <span className={`status-badge status-${block.status}`}>{block.status.replace('_', ' ')}</span>
                                            </td>
                                            <td style={{ fontSize: 12, color: 'var(--tl-text-secondary)' }}>{block.assignedEngineer?.displayName || 'Unassigned'}</td>
                                            <td style={{ textAlign: 'right' }}><ArrowRight size={14} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Risk Insights */}
                <div className="summary-side-column">
                    <div className="dashboard-card">
                        <div className="dashboard-card-title"><AlertTriangle size={16} /> Risk Intelligence</div>
                        
                        {categorizedInsights.critical.length > 0 && (
                            <div className="risk-group risk-group--critical">
                                <div className="risk-group-title">Critical Issues</div>
                                {categorizedInsights.critical.slice(0, 3).map((r, i) => (
                                    <div key={i} className="risk-alert-item" onClick={() => setHealthFilter('CRITICAL')}>
                                        <div className="risk-alert-icon"><AlertCircle size={14} /></div>
                                        <div className="risk-alert-text">{r.text}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {categorizedInsights.delays.length > 0 && (
                            <div className="risk-group risk-group--warning">
                                <div className="risk-group-title">Production Delays</div>
                                {categorizedInsights.delays.map((r, i) => (
                                    <div key={i} className="risk-alert-item">
                                        <div className="risk-alert-icon"><Clock size={14} /></div>
                                        <div className="risk-alert-text">{r.text}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="risk-group risk-group--info">
                            <div className="risk-group-title">Workflow Alerts</div>
                            {categorizedInsights.unassigned.slice(0, 2).map((r, i) => (
                                <div key={i} className="risk-alert-item">
                                    <div className="risk-alert-icon"><Info size={14} /></div>
                                    <div className="risk-alert-text">{r.text}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {!isEngineerView && (
                        <div className="dashboard-card" style={{ marginTop: 24 }}>
                            <div className="dashboard-card-title"><User size={16} /> Team Capacity</div>
                            <div className="team-workload">
                                {engineers.slice(0, 5).map(eng => {
                                    const count = blocks.filter(b => b.assignedEngineer?._id === eng._id).length;
                                    const max = 5;
                                    const percentage = Math.min(100, (count / max) * 100);
                                    return (
                                        <div key={eng._id} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                                <span>{eng.displayName}</span>
                                                <span>{count} Blocks</span>
                                            </div>
                                            <div style={{ height: 6, background: 'var(--tl-bg)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: `${percentage}%`, height: '100%', background: percentage > 80 ? '#ef4444' : 'var(--tl-primary)' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SummaryDashboard;
