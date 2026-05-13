import React, { useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { 
    calculateBottleneck, calculateDependencyImpact, 
    calculateSLA, calculateEngineerLoad 
} from '../../utils/workflowEngine';
import { STAGES } from '../../constants/workflowStates';

const WorkflowBanner = ({ blocks = [], requests = [], onApproveRequest, onRejectRequest }) => {
    const insights = useMemo(() => {
        const result = [];

        // 0. Pending Action Requests (Highest Priority for Manager)
        const pending = (requests || []).filter(r => r.status === 'PENDING');
        pending.forEach(req => {
            const block = blocks.find(b => b._id === req.blockId);
            result.push({
                id: `req_${req._id}`,
                severity: 'critical',
                icon: Info,
                text: `REQUEST: ${req.type || 'General'} by ${req.requestedBy?.displayName || 'Engineer'} for ${block?.name || 'Global'} — "${req.reason || req.description || req.message || 'No justification provided'}"`,
                priority: -1, 
                isRequest: true,
                requestId: req._id
            });
        });




        return result.sort((a, b) => a.priority - b.priority).slice(0, 3);
    }, [blocks, requests]);

    if (insights.length === 0) return null;

    const cls = { critical: 'ws-banner-critical', warning: 'ws-banner-warning', info: 'ws-banner-info' };

    return (
        <div className="ws-banner">
            {insights.map(insight => (
                <div key={insight.id} className={`ws-banner-item ${cls[insight.severity]} ${insight.isRequest ? 'actionable' : ''}`}>
                    <insight.icon size={14} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{insight.text}</span>
                    
                    {insight.isRequest ? (
                        <div className="banner-actions">
                            <button className="banner-btn approve" onClick={(e) => { e.stopPropagation(); onApproveRequest?.(insight.requestId); }}>Approve</button>
                            <button className="banner-btn reject" onClick={(e) => { e.stopPropagation(); onRejectRequest?.(insight.requestId); }}>Reject</button>
                        </div>
                    ) : (
                        <ArrowRight size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                    )}
                </div>
            ))}
        </div>
    );
};

export default WorkflowBanner;
