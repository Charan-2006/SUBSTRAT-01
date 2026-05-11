import React, { useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { 
    calculateBottleneck, calculateDependencyImpact, 
    calculateSLA, calculateEngineerLoad 
} from '../../utils/workflowEngine';
import { STAGES } from '../../constants/workflowStates';

const WorkflowBanner = ({ blocks = [] }) => {
    const insights = useMemo(() => {
        const result = [];

        // 1. Dependency blockages (Highest Priority)
        const blockedBlocks = blocks.filter(b => b.health === 'CRITICAL' || b.health === 'BOTTLENECK');
        blockedBlocks.forEach(b => {
            const directBlockers = (b.inheritedBlockers || []).map(id => blocks.find(x => x._id === id || x.id === id)).filter(u => u && u.status !== STAGES.COMPLETED);
            
            directBlockers.forEach(u => {
                result.push({
                    id: `block_${u._id}_${b._id}`,
                    severity: 'critical',
                    icon: AlertTriangle,
                    text: `[${u.name}] blocking [${b.name}] — ${b.currentStage || b.status} stalled`,
                    priority: 0,
                });
            });
        });

        // 2. Bottlenecks (Global Impact)
        const bottlenecks = blocks.filter(b => b.health === 'BOTTLENECK' && !result.find(r => r.id.includes(b._id)));
        if (bottlenecks.length > 0) {
            const worst = bottlenecks[0];
            result.push({
                id: `bottleneck_${worst._id}`,
                severity: 'critical',
                icon: AlertTriangle,
                text: `Orchestration Bottleneck: ${worst.name} is impacting downstream execution.`,
                priority: 1,
            });
        }

        // 2. Overdue workflows
        const overdueBlocks = blocks.filter(b => calculateSLA(b).overrun > 0 && b.status !== STAGES.COMPLETED);
        if (overdueBlocks.length > 0 && overdueBlocks.length !== bottlenecks.length) { // Don't duplicate if already a bottleneck
            const worstDelay = [...overdueBlocks].sort((a,b) => calculateSLA(b).overrun - calculateSLA(a).overrun)[0];
            result.push({
                id: 'overdue',
                severity: 'warning',
                icon: AlertCircle,
                text: `${overdueBlocks.length} workflow(s) exceeded SLA. ${worstDelay.name} is delayed by ${calculateSLA(worstDelay).overrun.toFixed(1)}h.`,
                priority: 1,
            });
        }

        // 3. Engineer overload
        // Get unique assigned engineers
        const engineers = [...new Set(blocks.map(b => b.assignedEngineer?._id || b.assignedEngineer).filter(Boolean))];
        const overloaded = [];
        engineers.forEach(id => {
            const { activeCount } = calculateEngineerLoad(id, blocks);
            if (activeCount > 3) {
                const b = blocks.find(b => (b.assignedEngineer?._id || b.assignedEngineer) === id);
                overloaded.push(`${b?.assignedEngineer?.displayName || 'Unknown'} (${activeCount} active)`);
            }
        });

        if (overloaded.length > 0) {
            result.push({
                id: 'overload',
                severity: 'info',
                icon: Info,
                text: `Engineer utilization exceeded recommended threshold: ${overloaded.join(', ')}.`,
                priority: 2,
            });
        }

        return result.sort((a, b) => a.priority - b.priority).slice(0, 3);
    }, [blocks]);

    if (insights.length === 0) return null;

    const cls = { critical: 'ws-banner-critical', warning: 'ws-banner-warning', info: 'ws-banner-info' };

    return (
        <div className="ws-banner">
            {insights.map(insight => (
                <div key={insight.id} className={`ws-banner-item ${cls[insight.severity]}`}>
                    <insight.icon size={14} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{insight.text}</span>
                    <ArrowRight size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                </div>
            ))}
        </div>
    );
};

export default WorkflowBanner;
