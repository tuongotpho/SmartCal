import React, { useRef, useEffect } from 'react';
import { AppNotification } from '../types';
import { X, Check, Trash2, Bell, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface NotificationPopoverProps {
    notifications: AppNotification[];
    onClose: () => void;
    onMarkAllAsRead: () => void;
    onClearAll: () => void;
    onMarkAsRead: (id: string) => void;
}

const NotificationPopover: React.FC<NotificationPopoverProps> = ({
    notifications,
    onClose,
    onMarkAllAsRead,
    onClearAll,
    onMarkAsRead
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={16} className="text-green-500" />;
            case 'warning': return <AlertTriangle size={16} className="text-yellow-500" />;
            case 'error': return <AlertCircle size={16} className="text-red-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    const sortedNotifications = [...notifications].sort((a, b) =>
        new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    return (
        <div
            ref={popoverRef}
            className="absolute top-12 right-0 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
        >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Bell size={16} /> Thông báo
                </h3>
                <div className="flex gap-1">
                    {notifications.length > 0 && (
                        <>
                            <button
                                onClick={onMarkAllAsRead}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400"
                                title="Đánh dấu tất cả đã đọc"
                            >
                                <Check size={16} />
                            </button>
                            <button
                                onClick={onClearAll}
                                className="p-1.5 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 rounded-md text-gray-500 dark:text-gray-400"
                                title="Xóa tất cả"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Không có thông báo mới</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {sortedNotifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer flex gap-3 relative ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                onClick={() => onMarkAsRead(notif.id)}
                            >
                                {!notif.read && (
                                    <span className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full"></span>
                                )}
                                <div className="mt-0.5 flex-shrink-0">
                                    {getIcon(notif.type)}
                                </div>
                                <div className="flex-1">
                                    <h4 className={`text-sm font-medium ${!notif.read ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {notif.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                        {notif.message}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {format(new Date(notif.time), 'HH:mm dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationPopover;
