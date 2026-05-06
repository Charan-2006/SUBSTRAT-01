import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import ManagerDashboard from './ManagerDashboard';
import EngineerDashboard from './EngineerDashboard';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import TimelinePanel from '../components/TimelinePanel';
import AuditTrailModal from '../components/AuditTrailModal';

const Dashboard = () => {
    const { user, loading } = useContext(AuthContext);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Shared data ---
    const [blocks, setBlocks] = useState([]);
    const [engineers, setEngineers] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [requests, setRequests] = useState([]);

    // --- Filter state ---
    const [healthFilter, setHealthFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState(null);

    // --- UI state ---
    const [showForm, setShowForm] = useState(false);
    const [showAuditTrail, setShowAuditTrail] = useState(false);
    const [selectedBlock, setSelectedBlock] = useState(null);

    // --- Data fetching ---
    const fetchBlocks = useCallback(async () => {
        try {
            const res = await api.get('/blocks');
            setBlocks(res.data.data);
        } catch (err) {
            console.error("Frontend error:", err);
        }
    }, []);

    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await api.get('/blocks/analytics');
            setAnalytics(res.data);
        } catch (err) {
            console.error("Frontend error:", err);
        }
    }, []);

    const fetchEngineers = useCallback(async () => {
        try {
            const res = await api.get('/users');
            setEngineers(res.data.data);
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
        fetchBlocks();
        fetchAnalytics();
        fetchEngineers();
        fetchRequests();

        // Check for inactivity if Manager
        if (user?.role === 'Manager') {
            api.post('/notifications/check-inactivity').catch(e => console.error("Inactivity check failed", e));
        }
    }, [fetchBlocks, fetchAnalytics, fetchEngineers, fetchRequests, user?.role]);

    // Keep selectedBlock in sync with blocks data
    useEffect(() => {
        if (selectedBlock) {
            const updated = blocks.find(b => b._id === selectedBlock._id);
            if (updated) setSelectedBlock(updated);
        }
    }, [blocks]);

    // --- Filtered blocks ---
    const filteredBlocks = blocks.filter(b => {
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
        try {
            await api.post('/blocks', formData);
            setShowForm(false);
            await fetchBlocks();
            await fetchAnalytics();
        } catch (err) {
            console.error("Create error:", err);
            alert(err.response?.data?.message || "Something went wrong creating block");
        }
    };

    const handleAssign = async (blockId, engineerId) => {
        if (!engineerId) return;
        console.log(`[Action] Assigning block ${blockId} to engineer ${engineerId}`);
        try {
            await api.put(`/blocks/${blockId}/assign`, { engineerId });
            await fetchBlocks();
            await fetchAnalytics();
        } catch (err) {
            console.error("Assign error:", err);
            alert(err.response?.data?.message || "Something went wrong assigning engineer");
        }
    };

    const handleReview = async (blockId, action, reason) => {
        console.log(`[Action] Reviewing block ${blockId}: ${action}`, reason ? `Reason: ${reason}` : '');
        try {
            if (action === 'REJECT' && !reason) {
                alert('Please provide a rejection reason');
                return;
            }
            await api.put(`/blocks/${blockId}/review`, { action, rejectionReason: reason });
            await fetchBlocks();
            await fetchAnalytics();
        } catch (err) {
            console.error("Review error:", err);
            alert(err.response?.data?.message || "Something went wrong reviewing block");
        }
    };

    const handleUpdateStatus = async (blockId, newStatus) => {
        console.log(`[Action] Updating block ${blockId} to ${newStatus}`);
        try {
            await api.put(`/blocks/${blockId}/status`, { status: newStatus });
            await fetchBlocks();
            await fetchAnalytics();
        } catch (err) {
            console.error("Status update error:", err);
            alert(err.response?.data?.message || "Something went wrong updating status");
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

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-tertiary)', fontSize: 14 }}>Loading...</div>;
    if (!user) return <Navigate to="/" replace />;

    const isManager = user.role === 'Manager';

    return (
        <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Navbar 
                searchTerm={searchTerm} 
                onSearchChange={setSearchTerm} 
            />
            <div className="app-body">
                <Sidebar
                    blocks={blocks}
                    analytics={analytics}
                    requests={requests}
                    healthFilter={healthFilter}
                    stageFilter={stageFilter}
                    setFilter={setFilter}
                    clearFilters={clearFilters}
                    onNewBlock={() => setShowForm(true)}
                    onViewLogs={() => setShowAuditTrail(true)}
                    onLoadDemo={handleLoadDemo}
                    onResetDataset={handleResetDataset}
                    isManager={isManager}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
                <main className="app-main fade-in">
                    {isManager ? (
                        <ManagerDashboard
                            blocks={blocks}
                            filteredBlocks={filteredBlocks}
                            engineers={engineers}
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
                            onCreateRequest={handleCreateRequest}
                            onApproveRequest={handleApproveRequest}
                            onRejectRequest={handleRejectRequest}
                            selectedBlockId={selectedBlock?._id}
                            onSelectBlock={handleSelectBlock}
                        />
                    ) : (
                        <EngineerDashboard
                            user={user}
                            blocks={blocks}
                            filteredBlocks={filteredBlocks}
                            analytics={analytics}
                            engineers={engineers}
                            requests={requests}
                            onUpdateStatus={handleUpdateStatus}
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
                    />
                )}
                {showAuditTrail && (
                    <AuditTrailModal onClose={() => setShowAuditTrail(false)} />
                )}
            </div>
        </div>
    );
};

export default Dashboard;
