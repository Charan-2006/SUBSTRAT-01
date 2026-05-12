import React, { useMemo } from 'react';
import { Layers, Heart, AlertTriangle, Clock, Users, TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { useOrchestration } from '../../context/OrchestrationContext';

const KpiStrip = () => {
    const { kpis: aggregated, blocks, engineers } = useOrchestration();

    const metrics = useMemo(() => {
        return [
            {
                label: 'Total Blocks', value: aggregated.total, icon: Layers, color: 'var(--accent)',
                sub: `${aggregated.active} in execution`,
                delta: aggregated.active > aggregated.total * 0.6 ? { dir: 'up', text: 'High activity' } : null,
            },
            {
                label: 'Healthy', value: aggregated.healthy, icon: Heart, color: 'var(--green)',
                sub: aggregated.total > 0 ? `${((aggregated.healthy / aggregated.total) * 100).toFixed(0)}% of pipeline` : '—',
                delta: aggregated.healthy >= aggregated.total * 0.5 ? { dir: 'up', text: 'Good standing' } : { dir: 'down', text: 'Below target' },
            },
            {
                label: 'Critical', value: aggregated.critical, icon: AlertTriangle, color: 'var(--red)',
                sub: aggregated.critical > 0 ? `${aggregated.critical} workflows at high risk` : 'No critical escalations',
                delta: aggregated.critical > 0 ? { dir: 'up', text: 'Critical status', warn: true } : null,
            },
            {
                label: 'Bottlenecks', value: aggregated.bottlenecks, icon: TrendingUp, color: 'var(--amber)',
                sub: aggregated.bottlenecks > 0 ? 'Affecting execution' : 'Flow is clear',
                delta: aggregated.bottlenecks > 0 ? { dir: 'up', text: 'Verify pressure', warn: true } : null,
            },
            {
                label: 'Avg Delay', value: aggregated.avgDelay > 0 ? `+${aggregated.avgDelay.toFixed(1)}h` : 'None', icon: Clock, color: 'var(--purple)',
                sub: aggregated.avgDelay > 0 ? `Across delayed blocks` : 'All blocks within SLA',
                delta: aggregated.avgDelay > 2 ? { dir: 'up', text: 'SLA Risk', warn: true } : null,
            },
            {
                label: 'Active Engineers', value: aggregated.activeEngineers, icon: Users, color: 'var(--violet)',
                sub: `of ${engineers.length} total capacity`,
                delta: engineers.length > 0 && aggregated.activeEngineers === engineers.length ? { dir: 'up', text: 'Full capacity', warn: true } : null,
            },
            {
                label: 'Total Effort', value: `${aggregated.totalEstimatedHours || 0}h`, icon: TrendingUp, color: 'var(--indigo)',
                sub: `Estimated for ${aggregated.total} blocks`,
                delta: aggregated.totalRemainingEffort > 0 ? { dir: 'up', text: `${aggregated.totalRemainingEffort}h left` } : null,
            },
            {
                label: 'Time Invested', value: `${aggregated.totalActualHours || 0}h`, icon: Activity, color: 'var(--blue)',
                sub: `Cumulative execution time`,
                delta: aggregated.totalVariance > 0 ? { dir: 'up', text: `+${aggregated.totalVariance}h variance`, warn: true } : null,
            },
        ];
    }, [blocks, engineers]);

    return (
        <div className="ws-kpi-strip">
            {metrics.map(kpi => (
                <div key={kpi.label} className="ws-kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                            {kpi.label}
                        </span>
                        <kpi.icon size={13} style={{ color: kpi.color, opacity: 0.6 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                            {kpi.value}
                        </span>
                        {kpi.delta && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 2,
                                fontSize: 10, fontWeight: 700,
                                color: kpi.delta.warn ? 'var(--red)' : kpi.delta.dir === 'up' ? 'var(--green)' : 'var(--green)',
                            }}>
                                {kpi.delta.dir === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                {kpi.delta.text}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {kpi.sub}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default KpiStrip;
