import React, { useState } from 'react';
import ControlCenter from './ControlCenter';
import WorkflowTimeline from './WorkflowTimeline';
import PriorityEngine from './PriorityEngine';
import ExecutionTab from './ExecutionTab';
import KnowledgeBase from './KnowledgeBase';
import AuditTrailTab from './AuditTrailTab';
import WorkspaceTab from './workspace/WorkspaceTab';
import IntelligencePanel from './workspace/IntelligencePanel';
import { motion } from 'framer-motion';
import { useOrchestration } from '../context/OrchestrationContext';

const ManagerDashboard = ({
    blocks = [],
    filteredBlocks = [],
    engineers = [],
    analytics,
    requests = [],
    healthFilter,
    stageFilter,
    showForm,
    setShowForm,
    onCreateBlock,
    onAssign,
    onReview,
    onUpdateStatus,
    onEscalate,
    onCreateRequest,
    onApproveRequest,
    onRejectRequest,
    selectedBlockId,
    onSelectBlock,
    activeTab,
    setActiveTab,
    isManager,
    onLoadDemo,
    onResetDataset
}) => {
    const { 
        blocks: contextBlocks = [], 
        kpis = {}, 
        engineers: contextEngineers = [] 
    } = useOrchestration();
    
    // Use context blocks as the source of truth if provided, otherwise fallback to props
    const displayBlocks = contextBlocks.length > 0 ? contextBlocks : blocks;
    const displayEngineers = contextEngineers.length > 0 ? contextEngineers : engineers;

    const stats = {
        total: kpis.total,
        healthy: kpis.healthy,
        warning: kpis.warning || 0,
        critical: kpis.critical
    };

    const activeFilterLabel = stageFilter
        ? `Stage: ${stageFilter}`
        : healthFilter !== 'ALL'
            ? `Health: ${healthFilter}`
            : null;

    const [intelCollapsed, setIntelCollapsed] = useState(false);

    return (
        <div className="ws-layout" style={{ width: '100%', height: '100%' }}>
            <div className="ws-main" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {/* Header Bar */}
                <div className="header-bar" style={{ padding: '16px 24px 0 24px' }}>
                <div className="header-bar-top">
                    <h1>SUBSTRAT Workspace</h1>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {activeFilterLabel && (
                            <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 12px',
                                borderRadius: 4,
                                background: 'var(--accent-subtle)',
                                color: 'var(--accent)',
                                textTransform: 'uppercase'
                            }}>
                                {activeFilterLabel}
                            </span>
                        )}
                    </div>
                </div>
                <div className="header-bar-tabs segmented-nav">
                    {[
                        { id: 'list', label: 'Workspace' },
                        { id: 'controlCenter', label: 'Control Center' },
                        { id: 'timeline', label: 'Timeline' },
                        { id: 'execution', label: 'Execution' },
                        { id: 'priorityEngine', label: 'Priority Engine' },
                        { id: 'knowledgeBase', label: 'Knowledge Base' },
                        { id: 'auditTrail', label: 'Audit Trail' }
                    ].map(tab => (
                        <div
                            key={tab.id}
                            className={`segmented-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="managerNavIndicator"
                                    className="segmented-indicator"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'list' && (
                <WorkspaceTab
                    blocks={displayBlocks}
                    engineers={displayEngineers}
                    analytics={analytics}
                    showForm={showForm}
                    setShowForm={setShowForm}
                    onCreateBlock={onCreateBlock}
                    onAssign={onAssign}
                    onReview={onReview}
                    onUpdateStatus={onUpdateStatus}
                    onEscalate={onEscalate}
                    onSelectBlock={onSelectBlock}
                    selectedBlockId={selectedBlockId}
                    isManager={isManager}
                    onLoadDemo={onLoadDemo}
                    onResetDataset={onResetDataset}
                />
            )}

            {activeTab !== 'list' && (
                <div className="page-content">
                    {/* Insight Banner */}
                    {analytics?.bottleneckStage && !stageFilter && healthFilter === 'ALL' && (
                        <div className="bottleneck-card fade-in">
                            <span className="stage-name">{analytics.bottleneckStage}</span>
                            <p style={{ margin: 0, fontSize: 13 }}>
                                detected as the current system bottleneck with an average duration of <strong>{(analytics.maxAvgHours || 0).toFixed(1)}h</strong>.
                            </p>
                        </div>
                    )}

                    {activeTab === 'controlCenter' && (
                        <ControlCenter onSelectBlock={onSelectBlock} />
                    )}

                    {activeTab === 'timeline' && (
                        <WorkflowTimeline
                            blocks={displayBlocks}
                            onSelectBlock={onSelectBlock}
                            onUpdateStatus={onUpdateStatus}
                        />
                    )}

                    {activeTab === 'execution' && (
                        <ExecutionTab blocks={displayBlocks} engineers={displayEngineers} onSelectBlock={onSelectBlock} onAssign={onAssign} onReview={onReview} />
                    )}

                    {activeTab === 'priorityEngine' && (
                        <PriorityEngine blocks={displayBlocks} onSelectBlock={onSelectBlock} />
                    )}

                    {activeTab === 'knowledgeBase' && (
                        <KnowledgeBase blocks={displayBlocks} engineers={displayEngineers} />
                    )}

                    {activeTab === 'auditTrail' && (
                        <AuditTrailTab blocks={displayBlocks} engineers={displayEngineers} />
                    )}
                </div>
            )}
            </div>
            
            {activeTab === 'list' && (
                <IntelligencePanel
                    collapsed={intelCollapsed} 
                    onToggle={() => setIntelCollapsed(!intelCollapsed)}
                />
            )}
        </div>
    );
};

export default ManagerDashboard;
