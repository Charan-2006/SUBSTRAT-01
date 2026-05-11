import React from 'react';
import { Layers, Settings, Database, Trash2, Menu } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({
    onLoadDemo = () => {},
    onResetDataset = () => {},
    isManager,
    isCollapsed,
    onToggleCollapse,
}) => {
    return (
        <aside className="sidebar">
            {/* Brand Section */}
            <div className="sidebar-brand">
                {!isCollapsed && (
                    <div className="logo-tagline-container">
                        <span className="logo-tagline">STRUCTURE. VISIBILITY. CLARITY.</span>
                    </div>
                )}
                <button 
                    onClick={onToggleCollapse}
                    className="sidebar-collapse-btn"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <Menu size={16} />
                </button>
            </div>

            <div className="sidebar-scroll" style={{ paddingTop: 16 }}>
                {/* Navigation Section */}
                <div className="sidebar-section">
                    {!isCollapsed && <div className="sidebar-section-label">Navigation</div>}
                    
                    <button className="sidebar-filter-item sidebar-filter-item--active" title="Dashboard">
                        <Layers size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        {!isCollapsed && <span>Dashboard</span>}
                    </button>

                    {isManager && (
                        <>
                            {!isCollapsed && <div className="sidebar-section-label" style={{ marginTop: 24 }}>System Admin</div>}
                            <button className="sidebar-filter-item" onClick={onLoadDemo} title="Load Demo Data">
                                <Database size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                {!isCollapsed && <span>Load Demo Data</span>}
                            </button>
                            <button className="sidebar-filter-item" onClick={onResetDataset} title="Wipe Dataset">
                                <Trash2 size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
                                {!isCollapsed && <span style={{ color: 'var(--red)' }}>Wipe Dataset</span>}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
