import { useEffect, useRef, useCallback, useState } from 'react';
import { Task } from '../types';
import { parseISO, differenceInMinutes, isSameDay } from 'date-fns';
import { formatTaskForTelegram, sendTelegramMessage } from '../services/telegramService';
import { ToastType } from '../components/Toast';

export function useReminders(
    tasks: Task[],
    telegramConfig: any,
    addNotification: (title: string, message: string, type: any, withSound?: boolean) => void,
    showToast: (msg: string, type: ToastType) => void,
    handleUpdateTask: (task: Task, notify?: boolean) => Promise<void>
) {
    const snoozedTasksRef = useRef<Map<string, number>>(new Map());

    const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('reminder_minutes_before');
            return saved ? parseInt(saved) : 60;
        } catch {
            return 60;
        }
    });

    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [reminderTask, setReminderTask] = useState<Task | null>(null);

    useEffect(() => {
        if (!tasks || tasks.length === 0) return;

        const checkInterval = setInterval(async () => {
            const now = new Date();

            for (const task of tasks) {
                if (task.completed) continue;

                const snoozedUntil = snoozedTasksRef.current.get(task.id);
                let snoozeJustExpired = false;
                if (snoozedUntil) {
                    if (now.getTime() < snoozedUntil) continue;
                    else {
                        snoozedTasksRef.current.delete(task.id);
                        snoozeJustExpired = true;
                    }
                }

                if (task.reminderSent && !snoozeJustExpired) continue;

                const taskDateTime = parseISO(`${task.date}T${task.time}`);
                if (isNaN(taskDateTime.getTime())) continue;

                const diffInMinutes = differenceInMinutes(taskDateTime, now);

                const shouldRemind = isSameDay(taskDateTime, now) &&
                    diffInMinutes <= reminderMinutesBefore &&
                    diffInMinutes > 0;

                if (shouldRemind) {
                    setReminderTask(task);
                    setIsReminderModalOpen(true);

                    addNotification(
                        `Sắp đến hạn: ${task.title}`,
                        `${task.time} - ${task.description || 'Không có mô tả'}`,
                        'warning',
                        false
                    );

                    if ((window as any).__TAURI_INTERNALS__) {
                        try {
                            const invoke = (window as any).__TAURI_INTERNALS__.invoke;
                            await invoke('plugin:notification|notify', {
                                body: `${task.time} - ${task.description || 'Không có mô tả'}`,
                                title: `🔔 Sắp đến hạn: ${task.title}`
                            });
                        } catch (e) {
                            console.warn('Tauri notification failed:', e);
                        }
                    } else if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(`🔔 Sắp đến hạn: ${task.title}`, {
                            body: `${task.time} - ${task.description || 'Không có mô tả'}`,
                            icon: '/icon.png'
                        });
                    }

                    if (telegramConfig.botToken && telegramConfig.chatId) {
                        const msg = formatTaskForTelegram(task);
                        await sendTelegramMessage(telegramConfig, msg);
                    }

                    const updatedTask = { ...task, reminderSent: true };
                    await handleUpdateTask(updatedTask, false);
                }
            }
        }, 30 * 1000);

        return () => clearInterval(checkInterval);
    }, [tasks, telegramConfig, reminderMinutesBefore, addNotification, handleUpdateTask]);

    const handleReminderClose = useCallback(() => {
        setIsReminderModalOpen(false);
        setReminderTask(null);
    }, []);

    const handleReminderSnooze = useCallback((minutes: number) => {
        if (reminderTask) {
            snoozedTasksRef.current.set(reminderTask.id, Date.now() + minutes * 60000);
            showToast(`Sẽ nhắc lại sau ${minutes} phút`, "info");
            addNotification("Hoãn nhắc nhở", `Đã hoãn việc "${reminderTask.title}" thêm ${minutes} phút.`, "info", false);
        }
        setIsReminderModalOpen(false);
        setReminderTask(null);
    }, [reminderTask, showToast, addNotification]);

    const handleReminderComplete = useCallback(async () => {
        if (reminderTask) {
            const updatedTask = { ...reminderTask, completed: true };
            await handleUpdateTask(updatedTask, false);
            showToast(`Đã hoàn thành: ${reminderTask.title}`, "success");
            addNotification("Đã hoàn thành", `Chúc mừng bạn đã hoàn thành: ${reminderTask.title}`, "success");
        }
        setIsReminderModalOpen(false);
        setReminderTask(null);
    }, [reminderTask, handleUpdateTask, showToast, addNotification]);

    return {
        reminderMinutesBefore,
        setReminderMinutesBefore,
        isReminderModalOpen,
        reminderTask,
        handleReminderClose,
        handleReminderSnooze,
        handleReminderComplete
    };
}
