import React, { useContext } from 'react';
import { 
    Bell, CheckCircle2, AlertTriangle, AlertCircle, 
    X, Trash2, ExternalLink, Zap, Layers 
} from 'lucide-react';
import { NotificationContext } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import './NotificationPanel.css';

const NotificationPanel = ({ isOpen, onClose }) => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useContext(NotificationContext);
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleAction = (n) => {
        if (!n.read) markAsRead(n._id);
        if (n.actionUrl) {
            navigate(n.actionUrl);
            onClose();
        }
    };

    const getIcon = (type, severity) => {
        if (severity === 'critical') return <AlertTriangle className="text-red" size={16} />;
        if (severity === 'high') return <AlertCircle className="text-amber" size={16} />;
        
        switch (type) {
            case 'ASSIGNMENT': return <Zap className="text-accent" size={16} />;
            case 'APPROVAL': return <CheckCircle2 className="text-green" size={16} />;
            case 'REJECTION': return <X className="text-red" size={16} />;
            case 'BOTTLENECK': return <AlertTriangle className="text-red" size={16} />;
            case 'DEPENDENCY_RESOLVED': return <Layers className="text-green" size={16} />;
            default: return <Bell size={16} />;
        }
    };

    const formatTime = (date) => {
        const d = new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="notif-panel-overlay" onClick={onClose}>
            <div className="notif-panel glassmorphic" onClick={e => e.stopPropagation()}>
                <div className="notif-header">
                    <div className="notif-header-title">
                        Notifications
                        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                    </div>
                    <div className="notif-header-actions">
                        <button className="notif-action-btn" onClick={markAllAsRead} title="Mark all as read">
                            <CheckCircle2 size={14} />
                        </button>
                        <button className="notif-action-btn" onClick={clearNotifications} title="Clear all">
                            <Trash2 size={14} />
                        </button>
                        <button className="notif-action-btn" onClick={onClose}>
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="notif-list custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="notif-empty">
                            <Bell size={24} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <div>No new notifications</div>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div 
                                key={n._id} 
                                className={`notif-item ${!n.read ? 'unread' : ''} severity-${n.severity}`}
                                onClick={() => handleAction(n)}
                            >
                                <div className="notif-item-icon">
                                    {getIcon(n.type, n.severity)}
                                </div>
                                <div className="notif-item-content">
                                    <div className="notif-item-msg">{n.message}</div>
                                    <div className="notif-item-meta">
                                        <span>{n.type.replace('_', ' ')}</span>
                                        <span>•</span>
                                        <span>{formatTime(n.createdAt)}</span>
                                    </div>
                                </div>
                                {n.actionUrl && (
                                    <div className="notif-item-link">
                                        <ExternalLink size={12} />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="notif-footer">
                    <button className="notif-view-all" onClick={onClose}>
                        Close Panel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationPanel;
