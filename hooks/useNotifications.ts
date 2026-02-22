import { useState, useCallback } from 'react';
import { AppNotification } from '../types';
import { ToastMessage, ToastType } from '../components/Toast';
import { soundService } from '../services/soundService';

export function useNotifications() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>(() => {
        try {
            const saved = localStorage.getItem('notifications');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const addNotification = useCallback(
        (
            title: string,
            message: string,
            type: 'info' | 'success' | 'warning' | 'error' = 'info',
            withSound = true
        ) => {
            const newNotif: AppNotification = {
                id: Date.now().toString() + Math.random().toString(),
                title,
                message,
                time: new Date().toISOString(),
                read: false,
                type,
            };

            setNotifications((prev) => {
                const updated = [newNotif, ...prev].slice(0, 50); // Keep last 50
                localStorage.setItem('notifications', JSON.stringify(updated));
                return updated;
            });

            if (withSound) {
                soundService.play();
            }
        },
        []
    );

    const markAllNotificationsAsRead = useCallback(() => {
        setNotifications((prev) => {
            const updated = prev.map((n) => ({ ...n, read: true }));
            localStorage.setItem('notifications', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
        localStorage.setItem('notifications', JSON.stringify([]));
    }, []);

    const markNotificationAsRead = useCallback((id: string) => {
        setNotifications((prev) => {
            const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
            localStorage.setItem('notifications', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now().toString() + Math.random().toString();
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return {
        toasts,
        notifications,
        addNotification,
        markAllNotificationsAsRead,
        clearAllNotifications,
        markNotificationAsRead,
        showToast,
        removeToast,
    };
}
