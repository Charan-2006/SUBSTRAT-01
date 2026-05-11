import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import { AuthContext } from './AuthContext';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/notifications');
            const data = res.data.data || [];
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
