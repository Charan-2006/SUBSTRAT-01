import React, { useContext, useState, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationContext } from '../context/NotificationContext';
import './Navbar.css';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useContext(NotificationContext);
    
    const [showNotifications, setShowNotifications] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkRead = (id) => {
        markAsRead(id);
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">Analog Layout System</div>
            <div className="navbar-user">
                {user && (
                    <>
                        <div className="nav-actions">
                            <button onClick={toggleTheme} className="nav-btn theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                                {theme === 'light' ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                    </svg>
                                )}
                            </button>

                            <div className="notification-wrapper" ref={dropdownRef}>
                                <button className="nav-btn notification-bell" onClick={() => setShowNotifications(!showNotifications)}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                                    </svg>
                                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                                </button>

                                {showNotifications && (
                                    <div className="notification-dropdown">
                                        <div className="notification-header">
                                            <span>Notifications</span>
                                            {unreadCount > 0 && <button onClick={markAllAsRead}>Mark all read</button>}
                                        </div>
                                        <div className="notification-list">
                                            {notifications.length === 0 ? (
                                                <div className="notification-empty">No notifications</div>
                                            ) : (
                                                notifications.map(n => (
                                                    <div 
                                                        key={n._id} 
                                                        className={`notification-item ${!n.read ? 'unread' : ''}`}
                                                        onClick={() => handleMarkRead(n._id)}
                                                    >
                                                        <div className="n-item-header">
                                                            <span className={`n-type type-${n.type}`}>{n.type}</span>
                                                            <span className="n-time">{formatTime(n.createdAt)}</span>
                                                        </div>
                                                        <div className="n-message">{n.message}</div>
                                                        {n.blockId && <div className="n-block">Block: {n.blockId.name}</div>}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <span className="user-info">
                            <img src={user.image} alt="avatar" className="avatar" />
                            {user.displayName} ({user.role})
                        </span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
