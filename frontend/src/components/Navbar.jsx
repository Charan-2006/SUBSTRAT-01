import React, { useContext, useState, useRef, useEffect, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationContext } from '../context/NotificationContext';
import { Search, Bell, Sun, Moon, LogOut, Layout, User as UserIcon, Activity } from 'lucide-react';
import './Navbar.css';

const Navbar = ({ searchTerm, onSearchChange, blocks = [], engineers = [] }) => {
    const { user, logout } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { unreadCount } = useContext(NotificationContext);
    
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const dropdownRef = useRef(null);

    // Grouped search results
    const results = useMemo(() => {
        if (!searchTerm) return { blocks: [], engineers: [], stages: [] };
        
        const term = searchTerm.toLowerCase();
        
        const filteredBlocks = blocks.filter(b => b.name.toLowerCase().includes(term)).slice(0, 5);
        const filteredEngineers = engineers.filter(e => e.displayName.toLowerCase().includes(term)).slice(0, 3);
        const stages = ['DRC', 'LVS', 'REVIEW', 'IN_PROGRESS'].filter(s => s.toLowerCase().includes(term));

        return { blocks: filteredBlocks, engineers: filteredEngineers, stages };
    }, [searchTerm, blocks, engineers]);

    const allResults = [...results.blocks, ...results.engineers, ...results.stages];

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < allResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            // Logic to select result
            console.log("Selected:", allResults[activeIndex]);
            setShowDropdown(false);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <a href="/" className="navbar-brand">
                    <img src="/logo.png" alt="Substrat logo" className="logo-icon" />
                    <span className="brand-text">SUBSTRAT</span>
                </a>
            </div>

            <div className="navbar-center" ref={dropdownRef}>
                <div className="nav-search-container">
                    <div className="nav-search-input-wrapper">
                        <Search className="nav-search-icon" size={18} />
                        <input 
                            type="text" 
                            className="nav-search-input"
                            placeholder="Search blocks, engineers, stages..." 
                            value={searchTerm || ''}
                            onChange={(e) => {
                                onSearchChange(e.target.value);
                                setShowDropdown(true);
                                setActiveIndex(-1);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {showDropdown && (results.blocks.length > 0 || results.engineers.length > 0 || results.stages.length > 0) && (
                        <div className="search-dropdown">
                            {results.blocks.length > 0 && (
                                <div className="search-group">
                                    <div className="search-group-title">Blocks</div>
                                    {results.blocks.map((block, i) => (
                                        <div key={block._id} className={`search-item ${allResults.indexOf(block) === activeIndex ? 'active' : ''}`}>
                                            <div className="search-item-icon"><Layout size={14} /></div>
                                            <div className="search-item-content">
                                                <div className="search-item-title">{block.name}</div>
                                                <div className="search-item-subtitle">{block.status}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {results.engineers.length > 0 && (
                                <div className="search-group">
                                    <div className="search-group-title">Engineers</div>
                                    {results.engineers.map((eng, i) => (
                                        <div key={eng._id} className={`search-item ${allResults.indexOf(eng) === activeIndex ? 'active' : ''}`}>
                                            <div className="search-item-icon"><UserIcon size={14} /></div>
                                            <div className="search-item-content">
                                                <div className="search-item-title">{eng.displayName}</div>
                                                <div className="search-item-subtitle">Layout Engineer</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="navbar-right">
                <div className="theme-toggle-container" onClick={toggleTheme}>
                    <div className="theme-toggle-pill"></div>
                    <div className="theme-toggle-icons">
                        <div className={`theme-icon ${theme === 'light' ? 'active' : ''}`}>
                            <Sun size={14} />
                        </div>
                        <div className={`theme-icon ${theme === 'dark' ? 'active' : ''}`}>
                            <Moon size={14} />
                        </div>
                    </div>
                </div>
                
                <div className="nav-icon-btn" style={{ position: 'relative' }}>
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="notification-dot">{unreadCount}</span>}
                </div>
                
                <div className="nav-user-profile" onClick={logout}>
                    <div className="nav-avatar">{user?.displayName?.[0] || 'U'}</div>
                    <span className="nav-username">{user?.displayName || 'User'}</span>
                    <LogOut size={14} style={{ marginLeft: 4, opacity: 0.6 }} />
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
