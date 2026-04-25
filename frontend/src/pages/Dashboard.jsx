import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import ManagerDashboard from './ManagerDashboard';
import EngineerDashboard from './EngineerDashboard';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import TimelinePanel from '../components/TimelinePanel';

const Dashboard = () => {
    const { user, loading } = useContext(AuthContext);

    // --- Shared data ---
    const [blocks, setBlocks] = useState([]);
    const [engineers, setEngineers] = useState([]);
    const [analytics, setAnalytics] = useState(null);

    // --- Filter state ---
    const [healthFilter, setHealthFilter] = useState('ALL');
    const [stageFilter, setStageFilter] = useState(null);

    // --- UI state ---
    const [showForm, setShowForm] = useState(false);
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

    useEffect(() => {
        fetchBlocks();
        fetchAnalytics();
        fetchEngineers();

        // Check for inactivity if Manager
        if (user?.role === 'Manager') {
            api.post('/notifications/check-inactivity').catch(e => console.error("Inactivity check failed", e));
        }
    }, [fetchBlocks, fetchAnalytics, fetchEngineers, user?.role]);

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
        return true;
    });

    // --- Actions ---
    const handleLoadDemo = async () => {
        if (!window.confirm("This will reset all data and load the demo preset. Continue?")) return;
        try {
            await api.post('/blocks/demo');
            setSelectedBlock(null);
            fetchBlocks();
            fetchAnalytics();
        } catch (err) {
            console.error("Frontend error:", err);
            alert(err.response?.data?.message || "Something went wrong loading demo data");
        }
    };

    const handleCreateBlock = async (formData) => {
        try {
            await api.post('/blocks', formData);
            setShowForm(false);
            fetchBlocks();
        } catch (err) {
            console.error("Frontend error:", err);
            alert(err.response?.data?.message || "Something went wrong creating block");
        }
    };

    const handleAssign = async (blockId, engineerId) => {
        if (!engineerId) return;
        try {
            await api.put(`/blocks/${blockId}/assign`, { engineerId });
            fetchBlocks();
        } catch (err) {
            console.error("Frontend error:", err);
            alert(err.response?.data?.message || "Something went wrong assigning engineer");
        }
    };

    const handleReview = async (blockId, action, reason) => {
        try {
            if (action === 'REJECT' && !reason) {
                alert('Please provide a rejection reason');
                return;
            }
            await api.put(`/blocks/${blockId}/review`, { action, rejectionReason: reason });
            fetchBlocks();
        } catch (err) {
            console.error("Frontend error:", err);
            alert(err.response?.data?.message || "Something went wrong reviewing block");
        }
    };

    const handleUpdateStatus = async (blockId, newStatus) => {
        try {
            await api.put(`/blocks/${blockId}/status`, { status: newStatus });
            fetchBlocks();
        } catch (err) {
            console.error("Frontend error:", err);
            alert(err.response?.data?.message || "Something went wrong updating status");
        }
    };

    // --- Block selection for detail panel ---
    const handleSelectBlock = (block) => {
        setSelectedBlock(prev => prev?._id === block._id ? null : block);
    };

    // --- Filter helpers ---
    const setFilter = (type, value) => {
        if (type === 'health') {
            setHealthFilter(value);
            setStageFilter(null);
        } else if (type === 'stage') {
            setStageFilter(value === stageFilter ? null : value);
            setHealthFilter('ALL');
        }
    };

    const clearFilters = () => {
        setHealthFilter('ALL');
        setStageFilter(null);
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-tertiary)', fontSize: 14 }}>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;

    const isManager = user.role === 'Manager';

    return (
        <div className="app-shell">
            <Navbar />
            <div className="app-body">
                <Sidebar
                    blocks={blocks}
                    analytics={analytics}
                    healthFilter={healthFilter}
                    stageFilter={stageFilter}
                    setFilter={setFilter}
                    clearFilters={clearFilters}
                    onNewBlock={() => setShowForm(true)}
                    onLoadDemo={handleLoadDemo}
                    isManager={isManager}
                />
                <main className="app-main">
                    {isManager ? (
                        <ManagerDashboard
                            blocks={blocks}
                            filteredBlocks={filteredBlocks}
                            engineers={engineers}
                            analytics={analytics}
                            healthFilter={healthFilter}
                            stageFilter={stageFilter}
                            showForm={showForm}
                            setShowForm={setShowForm}
                            onCreateBlock={handleCreateBlock}
                            onAssign={handleAssign}
                            onReview={handleReview}
                            selectedBlockId={selectedBlock?._id}
                            onSelectBlock={handleSelectBlock}
                        />
                    ) : (
                        <EngineerDashboard
                            blocks={blocks}
                            filteredBlocks={filteredBlocks}
                            onUpdateStatus={handleUpdateStatus}
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
            </div>
        </div>
    );
};

export default Dashboard;
