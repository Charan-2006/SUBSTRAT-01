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
import { 
    Layers, Zap, Clock, PlayCircle, BarChart3, BookOpen, History 
} from 'lucide-react';

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
    selectedBlockEditMode = false,
    onSelectBlock,
    activeTab,
    setActiveTab,
    isManager,
    onLoadDemo,
    onResetDataset,
    onDeleteBlock,
    onRelease
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
        <div className="ws-layout" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            <div className="ws-main" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                        { id: 'list', label: 'Workspace', icon: Layers },
                        { id: 'controlCenter', label: 'Control Center', icon: Zap },
                        { id: 'timeline', label: 'Timeline', icon: Clock },
                        { id: 'execution', label: 'Execution', icon: PlayCircle },
                        { id: 'priorityEngine', label: 'Priority Engine', icon: BarChart3 },
                        { id: 'knowledgeBase', label: 'Knowledge Base', icon: BookOpen },
                        { id: 'auditTrail', label: 'Audit Trail', icon: History }
                    ].map(tab => (
                        <div
                            key={tab.id}
                            className={`segmented-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <tab.icon size={14} className="tab-icon" />
                            {tab.label}
                            {tab.id === 'list' && (requests || []).filter(r => r.status === 'PENDING').length > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -8,
                                    background: 'var(--red)',
                                    color: 'white',
                                    fontSize: 9,
                                    fontWeight: 900,
                                    minWidth: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 4px',
                                    border: '2px solid var(--surface)',
                                    zIndex: 10
                                }}>
                                    {(requests || []).filter(r => r.status === 'PENDING').length}
                                </span>
                            )}
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
                    selectedBlockEditMode={selectedBlockEditMode}
                    isManager={isManager}
                    onLoadDemo={onLoadDemo}
                    onResetDataset={onResetDataset}
                    onDeleteBlock={onDeleteBlock}
                    requests={requests}
                    onApproveRequest={onApproveRequest}
                    onRejectRequest={onRejectRequest}
                />
            )}

            {activeTab !== 'list' && (
                <div className="page-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                        <ExecutionTab blocks={displayBlocks} engineers={displayEngineers} onSelectBlock={onSelectBlock} onAssign={onAssign} onReview={onReview} onRelease={onRelease} />
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
                    requests={requests}
                    onApproveRequest={onApproveRequest}
                    onRejectRequest={onRejectRequest}
                />
            )}
        </div>
    );
};

export default ManagerDashboard;
