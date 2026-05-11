import React, { createContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await api.get('/auth/me');
            const userData = res?.data?.data || null;
            setUser(userData);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn('[AuthContext] Auth check timed out. Forcing loading to false.');
                setLoading(false);
            }
        }, 5000); // 5s safety timeout

        checkAuth().then(() => clearTimeout(timeoutId));
        return () => clearTimeout(timeoutId);
    }, []);

    const logout = async () => {
        await api.get('/auth/logout');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
