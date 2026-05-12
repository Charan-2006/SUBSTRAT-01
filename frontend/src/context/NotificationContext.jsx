import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import api from '../api/axios';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const prevNotifsRef = useRef([]);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/notifications');
            const data = res.data.data || [];
            
            // Logic to trigger toasts only for NEW notifications arriving after initial load
            if (prevNotifsRef.current.length > 0) {
                const prevIds = new Set(prevNotifsRef.current.map(n => n._id));
                const newItems = data.filter(n => !prevIds.has(n._id));
                
                newItems.forEach(n => {
                    const isAlert = n.type === 'REJECTION' || n.type === 'ESCALATION' || n.severity === 'high';
                    toast(n.message, {
                        icon: n.type === 'REJECTION' ? '❌' : n.type === 'APPROVAL' ? '✅' : '🔔',
                        duration: 6000,
                        style: {
                            borderRadius: '12px',
                            background: 'var(--surface)',
                            color: 'var(--text-primary)',
                            border: `1px solid ${isAlert ? 'var(--red)' : 'var(--border)'}`,
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '12px 16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            backdropFilter: 'blur(8px)'
                        }
                    });
                });
            }

            prevNotifsRef.current = data;
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
        // Poll every 3 seconds to match orchestration cycle
        const interval = setInterval(fetchNotifications, 3000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAsRead = async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const clearNotifications = async () => {
        try {
            await api.delete('/notifications');
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error('Error clearing notifications:', err);
        }
    };

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            fetchNotifications, 
            markAsRead, 
            markAllAsRead,
            clearNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
