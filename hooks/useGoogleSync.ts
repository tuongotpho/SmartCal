import { useEffect, useRef, useState } from 'react';
import { Task } from '../types';
import { getGoogleAccessToken, updateTaskInFirestore, deleteTaskFromFirestore } from '../services/firebase';
import { fetchUpdatedGoogleEvents } from '../services/googleCalendarApiService';
import { format } from 'date-fns';

export function useGoogleSync(
    user: any,
    isOfflineMode: boolean,
    tasks: Task[]
) {
    const [isGCalSyncing, setIsGCalSyncing] = useState(false);
    const tasksRef = useRef(tasks);

    // Giữ tasks cập nhật mà không phải trigger lại useEffect bên dưới
    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(() => {
        if (isOfflineMode || !user) return;

        const syncGoogleCalendar = async () => {
            const token = getGoogleAccessToken();
            if (!token) return;

            try {
                // Lấy thời điểm đồng bộ lần cuối
                let lastSync = localStorage.getItem('lastGCalSyncTime');
                if (!lastSync) {
                    // Nếu chưa đồng bộ bao giờ, lấy từ 30 ngày trước
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    lastSync = d.toISOString();
                }

                setIsGCalSyncing(true);
                const gEvents = await fetchUpdatedGoogleEvents(lastSync);

                if (gEvents && gEvents.length > 0) {
                    let hasUpdates = false;
                    const currentTasks = tasksRef.current;

                    for (const gEvent of gEvents) {
                        // Tìm task tương ứng dựa vào googleEventId
                        const matchingTasks = currentTasks.filter(t => t.googleEventId === gEvent.id);

                        if (matchingTasks.length > 0) {
                            for (const task of matchingTasks) {
                                if (gEvent.status === 'cancelled') {
                                    // Bị người dùng xóa trên Google Calendar -> Xóa cắn DB
                                    await deleteTaskFromFirestore(task.id);
                                    hasUpdates = true;
                                } else {
                                    // Lấy startDate (có thể là dateTime hoặc date tùy theo loại event)
                                    const startDateTime = gEvent.start?.dateTime || gEvent.start?.date;
                                    if (startDateTime) {
                                        const dateObj = new Date(startDateTime);
                                        const newDate = format(dateObj, 'yyyy-MM-dd');
                                        const newTime = format(dateObj, 'HH:mm');

                                        // Update nếu có bất kỳ thay đổi nào
                                        if (
                                            task.title !== gEvent.summary ||
                                            task.date !== newDate ||
                                            task.time !== newTime ||
                                            (task.description || '') !== (gEvent.description || '')
                                        ) {
                                            const updatedTask = {
                                                ...task,
                                                title: gEvent.summary || 'Không có tiêu đề',
                                                description: gEvent.description || '',
                                                date: newDate,
                                                time: newTime
                                            };

                                            // Gọi Firebase thẳng để update DB (không qua logic auto-sync ngược lại GCal nữa)
                                            await updateTaskInFirestore(updatedTask);
                                            hasUpdates = true;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (hasUpdates) {
                        console.log("Light 2-Way Sync: Đã đồng bộ các thay đổi từ Google Calendar về SmartCal.");
                    }
                }

                // Cập nhật timestamp lần sync cuối
                localStorage.setItem('lastGCalSyncTime', new Date().toISOString());
            } catch (err) {
                console.warn("Light 2-way sync failed:", err);
            } finally {
                setIsGCalSyncing(false);
            }
        };

        // Chạy lần đầu khi load app (delay 2s để không lag UI)
        const timer = setTimeout(() => {
            syncGoogleCalendar();
        }, 2000);

        // Lắng nghe sự kiện người dùng mở lại tab/ứng dụng
        const handleFocus = () => {
            const lastSync = localStorage.getItem('lastGCalSyncTime');
            if (lastSync) {
                // Chỉ đồng bộ nếu lớn hơn 1 phút kể từ lần cuối (tránh spam API)
                const diff = Date.now() - new Date(lastSync).getTime();
                if (diff > 60000) {
                    syncGoogleCalendar();
                }
            } else {
                syncGoogleCalendar();
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user, isOfflineMode]);

    return { isGCalSyncing };
}
