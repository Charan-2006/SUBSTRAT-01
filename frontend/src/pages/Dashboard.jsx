import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import ManagerDashboard from './ManagerDashboard';
import EngineerDashboard from './EngineerDashboard';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import TimelinePanel from '../components/TimelinePanel';
import toast from 'react-hot-toast';
import { OrchestrationProvider, useOrchestration } from '../context/OrchestrationContext';
import { STAGES } from '../constants/workflowStates';
import RejectionModal from '../components/RejectionModal';

const Dashboard = () => {
    const { user, loading } = useContext(AuthContext);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const { 
        blocks: contextBlocks = [], 
        engineers: contextEngineers = [],
        kpis = {},
        fetchBlocks,
        fetchEngineers,
        createBlock,
        updateBlockStatus,
        assignEngineer,
        unassignEngineer,
        escalateBlock,
        reviewBlock
    } = useOrchestration();

    // Use local state for analytics and requests as they aren't in orchestration context yet
    const [analytics, setAnalytics] = useState(null);
    const [requests, setRequests] = useState([]);

    // --- Filter state ---
    const [healthFilter, setHealthFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState(null);

    // --- UI state ---
    const [showForm, setShowForm] = useState(false);
    const [rejectionModal, setRejectionModal] = useState({ isOpen: false, blockId: null, blockName: '' });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [activeTab, setActiveTab] = useState('list');

    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await api.get('/blocks/analytics');
            setAnalytics(res.data);
        } catch (err) {
            console.error("Frontend error:", err);
        }
    }, []);
    const fetchRequests = useCallback(async () => {
        try {
            const res = await api.get('/requests');
            setRequests(res.data.data);
        } catch (err) {
            console.error("Frontend error:", err);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
        fetchRequests();
    }, [fetchAnalytics, fetchRequests, user?.role]);

    // Handle deep-linking from notifications
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const blockId = params.get('blockId');
        if (blockId && contextBlocks.length > 0) {
            const block = contextBlocks.find(b => b._id === blockId);
            if (block) {
                setSelectedBlock(block);
                // Clear the param after opening to avoid re-opening on refresh if desired
                // window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [contextBlocks]);

    const blocks = contextBlocks;
    const engineers = contextEngineers;

    // --- Filtered blocks ---
    const filteredBlocks = contextBlocks.filter(b => {
        if (healthFilter !== 'ALL' && b.healthStatus !== healthFilter) return false;
        if (stageFilter && b.status !== stageFilter) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return b.name.toLowerCase().includes(term) || b.status.toLowerCase().includes(term);
        }
        return true;
    });

    // --- Actions ---
    const handleLoadDemo = async () => {
        if (!window.confirm("This will reset all data and load the demo preset. Continue?")) return;
        console.log('[Action] Loading demo data');
        try {
            await api.post('/blocks/demo');
            setSelectedBlock(null);
            await fetchBlocks();
            await fetchAnalytics();
        } catch (err) {
            console.error("Demo load error:", err);
            alert(err.response?.data?.message || "Something went wrong loading demo data");
        }
    };

    const handleResetDataset = async () => {
        if (!window.confirm("CRITICAL: This will permanently delete ALL blocks and audit logs. This action cannot be undone. Proceed?")) return;
        console.log('[Action] Resetting dataset');
        try {
            await api.delete('/blocks/reset');
            setSelectedBlock(null);
            await fetchBlocks();
            await fetchAnalytics();
            alert("Dataset has been completely wiped.");
        } catch (err) {
            console.error("Dataset reset error:", err);
            alert(err.response?.data?.message || "Something went wrong resetting dataset");
        }
    };

    const handleCreateBlock = async (formData) => {
        console.log('[Action] Creating new block:', formData.name);
        const toastId = toast.loading('Creating layout block...');
        try {
            await createBlock(formData);
            setShowForm(false);
            await fetchAnalytics();
            toast.success('Layout block created successfully', { id: toastId });
        } catch (err) {
            console.error("Create error:", err);
            toast.error(err.response?.data?.message || "Failed to create block", { id: toastId });
        }
    };

    const handleImportBlocks = async (rows) => {
        console.log(`[Action] Importing ${rows.length} blocks`);
        for (const row of rows) {
            try {
                await api.post('/blocks', row);
            } catch (err) {
                console.error(`Import error for ${row.name}:`, err);
            }
        }
        await fetchBlocks();
        await fetchAnalytics();
    };

    const handleAssign = async (blockId, engineerId) => {
        const toastId = toast.loading(engineerId ? 'Assigning engineer...' : 'Removing assignment...');
        try {
            if (engineerId) {
                await assignEngineer(blockId, engineerId);
                toast.success('Engineer assigned successfully', { id: toastId });
            } else {
                await unassignEngineer(blockId);
                toast.success('Assignment removed', { id: toastId });
            }
            await fetchAnalytics();
        } catch (err) {
            console.error("Assign error:", err);
            toast.error(err.response?.data?.message || "Failed to update assignment", { id: toastId });
        }
    };

    const handleReview = async (blockId, action, reason) => {
        if (action === 'REJECT' && !reason) {
            toast.error('Please provide a rejection reason');
            return;
        }
        const toastId = toast.loading(action === 'APPROVE' ? 'Approving workflow...' : 'Rejecting workflow...');
        try {
            await reviewBlock(blockId, action, reason);
            await fetchAnalytics();
            toast.success(action === 'APPROVE' ? 'Workflow approved' : 'Workflow reset to In Progress', { id: toastId });
        } catch (err) {
            console.error("Review error:", err);
            toast.error(err.response?.data?.message || "Failed to review workflow", { id: toastId });
        }
    };

    const handleReviewRequest = (blockId, action, reason) => {
        if (action === 'REJECT' && !reason) {
            const b = blocks.find(x => x._id === blockId);
            setRejectionModal({ isOpen: true, blockId, blockName: b?.name || 'Unknown Block' });
        } else {
            handleReview(blockId, action, reason);
        }
    };

    const handleUpdateStatus = async (blockId, newStatus) => {
        const toastId = toast.loading('Updating workflow state...');
        try {
            await updateBlockStatus(blockId, newStatus);
            await fetchBlocks();
            await fetchAnalytics();
            toast.success(`Workflow moved to ${newStatus}`, { id: toastId });
        } catch (err) {
            console.error("Status update error:", err);
            toast.error(err.response?.data?.message || "Failed to update workflow state", { id: toastId });
        }
    };

    const handleEscalate = async (blockId) => {
        const toastId = toast.loading('Escalating workflow...');
        try {
            await escalateBlock(blockId);
            await fetchBlocks();
            await fetchAnalytics();
            toast.success('Workflow escalated successfully', { id: toastId });
        } catch (err) {
            console.error("Escalate error:", err);
            toast.error(err.response?.data?.message || "Failed to escalate workflow", { id: toastId });
        }
    };

    const handleResumeWorkflow = async (blockId) => {
        const toastId = toast.loading('Executing workflow action...');
        try {
            const res = await api.post(`/blocks/${blockId}/resume`);
            await fetchBlocks();
            await fetchAnalytics();
            
            const { message, unblockedCount } = res.data;
            toast.success(message, { id: toastId, duration: 4000 });
            
            if (unblockedCount > 0) {
                setTimeout(() => {
                    toast.success(`Orchestration update: ${unblockedCount} downstream nodes ready`, { icon: '🚀' });
                }, 1000);
            }
        } catch (err) {
            console.error("Resume error:", err);
            toast.error(err.response?.data?.message || "Execution failed", { id: toastId });
        }
    };

    const handleCreateRequest = async (formData) => {
        console.log('[Action] Creating new request:', formData.title);
        try {
            await api.post('/requests', formData);
            await fetchRequests();
        } catch (err) {
            console.error("Create request error:", err);
            alert(err.response?.data?.message || "Something went wrong creating request");
        }
    };

    const handleApproveRequest = async (requestId) => {
        console.log('[Action] Approving request:', requestId);
        try {
            await api.put(`/requests/${requestId}/status`, { status: 'APPROVED' });
            await fetchRequests();
            await fetchBlocks();
            await fetchAnalytics();
        } catch (err) {
            console.error("Approve request error:", err);
            alert(err.response?.data?.message || "Something went wrong approving request");
        }
    };

    const handleRejectRequest = async (requestId) => {
        console.log('[Action] Rejecting request:', requestId);
        try {
            await api.put(`/requests/${requestId}/status`, { status: 'REJECTED' });
            await fetchRequests();
        } catch (err) {
            console.error("Reject request error:", err);
            alert(err.response?.data?.message || "Something went wrong rejecting request");
        }
    };

    // --- Block selection for detail panel ---
    const handleSelectBlock = (block) => {
        setSelectedBlock(prev => prev?._id === block._id ? null : block);
    };

    // --- Filter helpers ---
    const setFilter = (type, value) => {
        if (type === 'health') {
            setHealthFilter(value === healthFilter ? 'ALL' : value);
        } else if (type === 'stage') {
            setStageFilter(value === stageFilter ? null : value);
        }
    };

    const clearFilters = () => {
        setHealthFilter('ALL');
        setStageFilter(null);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-tertiary)', gap: 16 }}>
                <div className="loading-spinner" />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Initializing Execution Platform...</div>
            </div>
        );
    }

    if (!user) {
        console.warn('[Dashboard] No user found, redirecting to login.');
        return <Navigate to="/" replace />;
    }

    const isManager = user?.role?.toUpperCase() === 'MANAGER';

    return (
        <>
            <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Navbar 
                    searchTerm={searchTerm} 
                    onSearchChange={setSearchTerm}
                    blocks={blocks}
                    engineers={engineers}
                />
            <div className="app-body">
                <Sidebar
                    analytics={analytics}
                    requests={requests}
                    healthFilter={healthFilter}
                    stageFilter={stageFilter}
                    setFilter={setFilter}
                    clearFilters={clearFilters}
                    onNewBlock={() => setShowForm(true)}
                    onViewLogs={() => setActiveTab('auditTrail')}
                    onLoadDemo={handleLoadDemo}
                    onResetDataset={handleResetDataset}
                    isManager={isManager}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
                    <main className="app-main fade-in">
                     {isManager ? (
                        <ManagerDashboard
                            analytics={analytics}
                            requests={requests}
                            healthFilter={healthFilter}
                            stageFilter={stageFilter}
                            showForm={showForm}
                            setShowForm={setShowForm}
                            onCreateBlock={handleCreateBlock}
                            onAssign={handleAssign}
                            onReview={handleReview}
                            onUpdateStatus={handleUpdateStatus}
                            onEscalate={handleEscalate}
                            onCreateRequest={handleCreateRequest}
                            onApproveRequest={handleApproveRequest}
                            onRejectRequest={handleRejectRequest}
                            selectedBlockId={selectedBlock?._id}
                            onSelectBlock={handleSelectBlock}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            isManager={isManager}
                            onLoadDemo={handleLoadDemo}
                            onResetDataset={handleResetDataset}
                        />
                    ) : (
                        <EngineerDashboard
                            user={user}
                            analytics={analytics}
                            requests={requests}
                            onUpdateStatus={handleUpdateStatus}
                            onReview={handleReview}
                            onResumeWorkflow={handleResumeWorkflow}
                            onEscalate={handleEscalate}
                            onCreateRequest={handleCreateRequest}
                            selectedBlockId={selectedBlock?._id}
                            onSelectBlock={handleSelectBlock}
                        />
                    )}
                    </main>
                    {selectedBlock && (
                        <TimelinePanel
                            block={selectedBlock}
                            onClose={() => setSelectedBlock(null)}
                            onUpdateStatus={handleUpdateStatus}
                            onReview={handleReviewRequest}
                            onResumeWorkflow={handleResumeWorkflow}
                            onEscalate={handleEscalate}
                            isManager={isManager}
                            user={user}
                        />
                    )}
                </div>
            </div>

            <RejectionModal 
                isOpen={rejectionModal.isOpen}
                onClose={() => setRejectionModal({ isOpen: false, blockId: null, blockName: '' })}
                blockName={rejectionModal.blockName}
                onConfirm={(reason) => handleReview(rejectionModal.blockId, 'REJECT', reason)}
            />
        </>
    );
};

export default Dashboard;
