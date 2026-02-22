import { useState, useEffect, useRef, useCallback } from 'react';
import { TelegramConfig, Task, RecurringType, Tag } from '../types';
import { fetchTelegramUpdates } from '../services/telegramService';
import { parseTaskWithGemini } from '../services/geminiService';
import { ToastType } from '../components/Toast';

export function useTelegramSync(
    user: any,
    isOfflineMode: boolean,
    telegramConfig: TelegramConfig,
    tags: Tag[],
    handleRequestAddTask: (task: Task, skipCheck?: boolean) => Promise<void>,
    showToast: (msg: string, type: ToastType) => void,
    addNotification: (title: string, message: string, type: any) => void
) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastTelegramUpdateId, setLastTelegramUpdateId] = useState<number>(() => {
        return parseInt(localStorage.getItem('lastTelegramUpdateId') || '0');
    });

    const handleManualSync = useCallback(async (isSilent = false) => {
        if (!telegramConfig.botToken) {
            if (!isSilent) showToast("Chưa cấu hình Bot Token", "warning");
            return;
        }

        if (isSyncing) return;
        setIsSyncing(true);

        try {
            const updates = await fetchTelegramUpdates(telegramConfig, lastTelegramUpdateId + 1);

            if (updates.length > 0) {
                let addedCount = 0;
                let maxId = lastTelegramUpdateId;
                const availableTags = tags.map(t => t.name);

                for (const update of updates) {
                    if (update.update_id > maxId) maxId = update.update_id;

                    console.log("Processing update:", update.message);
                    const parsedTasks = await parseTaskWithGemini(update.message, availableTags);

                    if (parsedTasks && parsedTasks.length > 0) {
                        for (const taskData of parsedTasks) {
                            const newTask: Task = {
                                id: "temp",
                                userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
                                title: taskData.title,
                                date: taskData.date,
                                endDate: taskData.endDate || taskData.date,
                                time: taskData.time,
                                duration: taskData.duration || "",
                                description: `Import từ Telegram: "${update.message}"`,
                                completed: false,
                                reminderSent: false,
                                recurringType: (taskData.recurringType as RecurringType) || 'none',
                                tags: taskData.tags || ['Khác'],
                                subtasks: []
                            };

                            console.log("Adding task from Telegram:", newTask.title);
                            await handleRequestAddTask(newTask, true);
                            addedCount++;

                            await new Promise(res => setTimeout(res, 1000));
                        }
                    } else {
                        console.warn("AI returned no tasks for message:", update.message);
                    }
                    await new Promise(res => setTimeout(res, 500));
                }

                setLastTelegramUpdateId(maxId);
                localStorage.setItem('lastTelegramUpdateId', maxId.toString());

                if (addedCount > 0) {
                    const msg = `Đã đồng bộ ${addedCount} công việc từ Telegram!`;
                    showToast(msg, "success");
                    addNotification("Đồng bộ Telegram", msg, "success");
                } else if (!isSilent) {
                    showToast("Có tin nhắn nhưng AI không nhận dạng được lịch.", "info");
                }
            } else if (!isSilent) {
                showToast("Không có tin nhắn mới trên Telegram.", "info");
            }
        } catch (e) {
            console.error("Sync error", e);
            if (!isSilent) {
                showToast("Lỗi kết nối Telegram (Many Requests?).", "error");
                addNotification("Lỗi Đồng bộ", "Không thể kết nối Telegram. Vui lòng thử lại sau.", "error");
            }
        } finally {
            setIsSyncing(false);
        }
    }, [telegramConfig, lastTelegramUpdateId, tags, handleRequestAddTask, showToast, isSyncing, user, isOfflineMode, addNotification]);

    const savedSyncCallback = useRef(handleManualSync);
    useEffect(() => {
        savedSyncCallback.current = handleManualSync;
    }, [handleManualSync]);

    useEffect(() => {
        if (!telegramConfig.botToken || !telegramConfig.chatId) return;

        const intervalId = setInterval(() => {
            savedSyncCallback.current(true);
        }, 60 * 1000);

        return () => clearInterval(intervalId);
    }, [telegramConfig]);

    return {
        isSyncing,
        handleManualSync
    };
}
