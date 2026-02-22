import { useState, useEffect, useCallback } from 'react';
import { Task, Tag, DEFAULT_TASK_TAGS, TelegramConfig } from '../types';
import { subscribeToTasks, subscribeToTags, addTaskToFirestore, updateTaskInFirestore, deleteTaskFromFirestore, getGoogleAccessToken } from '../services/firebase';
import { checkProposedTaskConflict } from '../services/geminiService';
import { addEventToGoogleCalendarAPI, updateEventInGoogleCalendarAPI, deleteEventFromGoogleCalendarAPI } from '../services/googleCalendarApiService';
import { sendTelegramMessage, formatNewTaskForTelegram } from '../services/telegramService';
import { hapticFeedback } from '../services/hapticService';
import { ToastType } from '../components/Toast';

export function useTasks(
    user: any,
    isOfflineMode: boolean,
    useFirebase: boolean,
    telegramConfig: TelegramConfig,
    showToast: (msg: string, type: ToastType) => void,
    addNotification: (title: string, message: string, type: any, withSound?: boolean) => void,
    setUseFirebase: (val: boolean) => void
) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [tags, setTags] = useState<Tag[]>(DEFAULT_TASK_TAGS);

    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [proposedTask, setProposedTask] = useState<Task | null>(null);
    const [pendingConflicts, setPendingConflicts] = useState<string[]>([]);

    const effectiveUserId = user ? user.uid : (isOfflineMode ? 'offline_user' : null);

    useEffect(() => {
        if (!effectiveUserId) return;
        let unsubscribe: () => void;
        if (useFirebase && !isOfflineMode) {
            unsubscribe = subscribeToTasks(
                effectiveUserId,
                (fetchedTasks) => setTasks(fetchedTasks),
                (error) => setUseFirebase(false)
            );
        } else {
            const saved = localStorage.getItem(isOfflineMode ? 'offlineTasks' : 'localTasks');
            if (saved) try { setTasks(JSON.parse(saved)); } catch (e) { setTasks([]); }
        }
        return () => unsubscribe && unsubscribe();
    }, [useFirebase, effectiveUserId, isOfflineMode, setUseFirebase]);

    useEffect(() => {
        if (!effectiveUserId) return;
        let unsubscribeTags: () => void;
        if (useFirebase && !isOfflineMode) {
            unsubscribeTags = subscribeToTags(
                effectiveUserId,
                (fetchedTags) => setTags(fetchedTags),
                (error) => { }
            );
        } else {
            const saved = localStorage.getItem(isOfflineMode ? 'offlineTags' : 'localTags');
            if (saved) try { setTags(JSON.parse(saved)); } catch (e) { setTags(DEFAULT_TASK_TAGS); }
        }
        return () => unsubscribeTags && unsubscribeTags();
    }, [useFirebase, effectiveUserId, isOfflineMode]);

    const saveTaskToDatabase = useCallback(async (task: Task) => {
        if (useFirebase && !isOfflineMode) {
            try {
                let taskToSave = { ...task };
                const hasGoogleToken = !!getGoogleAccessToken();
                let googleStatusMsg = "";

                if (task.id === 'temp') {
                    const taskDataForFirestore = { ...taskToSave };
                    delete (taskDataForFirestore as any).id;

                    if (hasGoogleToken) {
                        try {
                            const gEvent = await addEventToGoogleCalendarAPI(taskToSave);
                            if (gEvent && gEvent.id) {
                                taskDataForFirestore.googleEventId = gEvent.id;
                                googleStatusMsg = " & GCal";
                            }
                        } catch (e) {
                            console.warn("Failed to auto-sync create to Google Calendar", e);
                        }
                    }

                    const newId = await addTaskToFirestore(taskDataForFirestore);
                    taskToSave.id = newId;

                    showToast(`Đã thêm công việc mới${googleStatusMsg}`, "success");
                } else {
                    if (hasGoogleToken) {
                        try {
                            if (taskToSave.googleEventId) {
                                await updateEventInGoogleCalendarAPI(taskToSave.googleEventId, taskToSave);
                                googleStatusMsg = " & GCal";
                            } else {
                                const gEvent = await addEventToGoogleCalendarAPI(taskToSave);
                                if (gEvent && gEvent.id) {
                                    taskToSave.googleEventId = gEvent.id;
                                    googleStatusMsg = " & GCal Lần đầu";
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to auto-sync update to Google Calendar", e);
                        }
                    }
                    await updateTaskInFirestore(taskToSave);
                    showToast(`Đã lưu thay đổi${googleStatusMsg}`, "success");
                }
            } catch (e) {
                showToast("Lỗi đồng bộ Cloud", "warning");
            }
        } else {
            if (task.id === 'temp') {
                const newTask = { ...task, id: Date.now().toString() };
                setTasks(prev => {
                    const newTasks = [...prev, newTask];
                    localStorage.setItem(isOfflineMode ? 'offlineTasks' : 'localTasks', JSON.stringify(newTasks));
                    return newTasks;
                });
                showToast("Đã thêm (Offline)", "success");
            } else {
                setTasks(prev => {
                    const newTasks = prev.map(t => t.id === task.id ? task : t);
                    localStorage.setItem(isOfflineMode ? 'offlineTasks' : 'localTasks', JSON.stringify(newTasks));
                    return newTasks;
                });
                showToast("Đã lưu (Offline)", "success");
            }
        }
    }, [useFirebase, isOfflineMode, showToast]);

    const handleRequestAddTask = useCallback(async (task: Task, skipCheck = false) => {
        hapticFeedback.medium();

        if (skipCheck) {
            await saveTaskToDatabase(task);
        } else {
            const conflictList = await checkProposedTaskConflict(task, tasks);
            if (conflictList.length > 0) {
                setPendingConflicts(conflictList);
                setProposedTask(task);
                setIsConflictModalOpen(true);
                hapticFeedback.warning();
                return;
            }
            await saveTaskToDatabase(task);
        }

        if (task.id === 'temp') {
            addNotification("Tạo mới thành công", `Đã thêm công việc: ${task.title}`, "success");

            if (telegramConfig.botToken && telegramConfig.chatId) {
                try {
                    const msg = formatNewTaskForTelegram(task);
                    await sendTelegramMessage(telegramConfig, msg);
                } catch (error) {
                    console.error("Failed to send creation notification to Telegram", error);
                }
            }
        }
    }, [tasks, saveTaskToDatabase, addNotification, telegramConfig]);

    const handleUpdateTask = useCallback(async (updatedTask: Task, notify = true) => {
        const oldTask = tasks.find(t => t.id === updatedTask.id);
        const isReminderUpdate = oldTask && oldTask.reminderSent !== updatedTask.reminderSent && oldTask.time === updatedTask.time;

        if (!isReminderUpdate && oldTask && (oldTask.date !== updatedTask.date || oldTask.time !== updatedTask.time)) {
            const conflictList = await checkProposedTaskConflict(updatedTask, tasks.filter(t => t.id !== updatedTask.id));
            if (conflictList.length > 0) {
                setPendingConflicts(conflictList);
                setProposedTask(updatedTask);
                setIsConflictModalOpen(true);
                return;
            }
        }

        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

        if (useFirebase && !isOfflineMode) {
            try {
                const hasGoogleToken = !!getGoogleAccessToken();
                let googleStatusMsg = "";

                if (hasGoogleToken) {
                    try {
                        if (updatedTask.googleEventId) {
                            await updateEventInGoogleCalendarAPI(updatedTask.googleEventId, updatedTask);
                            googleStatusMsg = " & GCal";
                        } else {
                            const gEvent = await addEventToGoogleCalendarAPI(updatedTask);
                            if (gEvent && gEvent.id) {
                                updatedTask.googleEventId = gEvent.id;
                                googleStatusMsg = " & GCal Lần đầu";
                            }
                        }
                    } catch (e) {
                        console.warn("Failed to auto-sync update to Google Calendar", e);
                    }
                }
                await updateTaskInFirestore(updatedTask);
                if (notify) showToast(`Đã lưu thay đổi${googleStatusMsg}`, "success");
            } catch (e) {
                if (notify) showToast("Lỗi cập nhật", "warning");
            }
        } else {
            if (isOfflineMode) {
                const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
                localStorage.setItem('offlineTasks', JSON.stringify(newTasks));
                if (notify) showToast("Đã lưu (Offline)", "success");
            }
        }
    }, [tasks, useFirebase, isOfflineMode, showToast]);

    const executeDeleteTask = useCallback(async (taskId: string) => {
        try {
            const taskToDelete = tasks.find(t => t.id === taskId);

            if (taskToDelete && taskToDelete.googleEventId && !!getGoogleAccessToken()) {
                try {
                    await deleteEventFromGoogleCalendarAPI(taskToDelete.googleEventId);
                } catch (e) {
                    console.warn("Failed to delete event from Google Calendar", e);
                }
            }

            if (useFirebase && !isOfflineMode) await deleteTaskFromFirestore(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
            showToast("Đã xóa công việc", "info");

            addNotification("Đã xóa", "Công việc đã được xóa khỏi danh sách.", "info", false);
        } catch (e) {
            showToast("Lỗi khi xóa.", "error");
        }
    }, [tasks, useFirebase, isOfflineMode, showToast, addNotification]);

    return {
        tasks,
        setTasks,
        tags,
        setTags,
        isConflictModalOpen,
        setIsConflictModalOpen,
        proposedTask,
        setProposedTask,
        pendingConflicts,
        saveTaskToDatabase,
        handleRequestAddTask,
        handleUpdateTask,
        executeDeleteTask
    };
}
