import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  format,
  addMonths,
  addWeeks,
  addDays,
  getDay,
  getDate,
  getMonth,
  endOfWeek,
  isWithinInterval,
  endOfMonth,
  differenceInDays,
  differenceInMinutes,
  isSameDay,
  parseISO,
  startOfWeek,
  startOfMonth,
  addMinutes
} from 'date-fns';
import {
  RefreshCw,
  WifiOff,
  LayoutGrid,
  Columns,
  Square,
  PieChart,
  Layout,
  X,
  Kanban,
  GanttChartSquare,
  ArrowDown,
  Timer,
  AlertTriangle
} from 'lucide-react';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import SettingsModal from './components/SettingsModal';
import EditTaskModal from './components/EditTaskModal';
import ConfirmModal from './components/ConfirmModal';
import ConflictWarningModal from './components/ConflictWarningModal';
import LoginScreen from './components/LoginScreen';
import AiAssistant from './components/AiAssistant';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNavigation from './components/MobileNavigation';
import DashboardView from './components/DashboardView';
import KanbanView from './components/KanbanView';
import TimelineView from './components/TimelineView';
import FocusView from './components/FocusView';
import ReminderModal from './components/ReminderModal';

import { Task, TelegramConfig, ViewMode, Tag, DEFAULT_TASK_TAGS, RecurringType, AppTheme, AppNotification } from './types';
import { parseTaskWithGemini, generateReport, checkProposedTaskConflict } from './services/geminiService';
import { sendTelegramMessage, fetchTelegramUpdates, formatTaskForTelegram, formatNewTaskForTelegram } from './services/telegramService';
import { subscribeToTasks, subscribeToTags, saveTagsToFirestore, addTaskToFirestore, deleteTaskFromFirestore, updateTaskInFirestore, auth, logOut, saveTelegramConfigToFirestore } from './services/firebase';
import { hapticFeedback } from './services/hapticService';
import { initializeFCM, onForegroundMessage, checkFCMSupport, FCMConfig } from './services/fcmService';
import { soundService } from './services/soundService';

export const APP_THEMES: AppTheme[] = [
  {
    name: 'orange',
    label: 'Cam (Mặc định)',
    colors: {
      50: '255 247 237', 100: '255 237 213', 200: '254 215 170', 300: '253 186 116',
      400: '251 146 60', 500: '249 115 22', 600: '234 88 12', 700: '194 65 12',
      800: '154 52 18', 900: '124 45 18', 950: '67 20 7'
    }
  },
  {
    name: 'blue',
    label: 'Xanh Dương',
    colors: {
      50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
      400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
      800: '30 64 175', 900: '30 58 138', 950: '23 37 84'
    }
  },
  {
    name: 'purple',
    label: 'Tím Mộng Mơ',
    colors: {
      50: '250 245 255', 100: '243 232 255', 200: '233 213 255', 300: '216 180 254',
      400: '192 132 252', 500: '168 85 247', 600: '147 51 234', 700: '126 34 206',
      800: '107 33 168', 900: '88 28 135', 950: '59 7 100'
    }
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('app_theme') || 'orange');
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TASK_TAGS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  // In-memory snooze map: taskId -> snoozedUntil (timestamp). Lives in ref so interval always reads latest without re-registering.
  const snoozedTasksRef = useRef<Map<string, number>>(new Map());
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [useFirebase, setUseFirebase] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('notifications');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastTelegramUpdateId, setLastTelegramUpdateId] = useState<number>(() => {
    return parseInt(localStorage.getItem('lastTelegramUpdateId') || '0');
  });

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // FCM State
  const [fcmConfig, setFcmConfig] = useState<FCMConfig>({ enabled: false, token: null });

  // Reminder Modal State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTask, setReminderTask] = useState<Task | null>(null);

  // Reminder Settings (thời gian nhắc trước, mặc định 60 phút)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('reminder_minutes_before');
      return saved ? parseInt(saved) : 60;
    } catch {
      return 60;
    }
  });

  // Pre-save conflict states (Keep these for the Popup)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [proposedTask, setProposedTask] = useState<Task | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<string[]>([]);
  // AI Assistant open state (for mobile nav)
  const [isAIOpen, setIsAIOpen] = useState(false);

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('telegramConfig');
      return saved ? JSON.parse(saved) : { botToken: '', chatId: '' };
    } catch (e) {
      return { botToken: '', chatId: '' };
    }
  });

  const addNotification = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', withSound = true) => {
    const newNotif: AppNotification = {
      id: Date.now().toString() + Math.random().toString(),
      title,
      message,
      time: new Date().toISOString(),
      read: false,
      type
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50); // Keep last 50
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });

    // Play Sound
    if (withSound) {
      soundService.play();
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    localStorage.setItem('notifications', JSON.stringify([]));
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
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

  // Request Notification Permission on Load
  useEffect(() => {
    const requestNotifPermission = async () => {
      if ((window as any).__TAURI_INTERNALS__) {
        // Tauri: dùng native notification plugin
        try {
          const invoke = (window as any).__TAURI_INTERNALS__.invoke;
          const granted = await invoke('plugin:notification|is_permission_granted');
          if (!granted) await invoke('plugin:notification|request_permission');
        } catch (e) {
          console.warn('Tauri notification plugin not available:', e);
        }
      } else if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    };
    requestNotifPermission();
  }, []);

  // ==========================================
  // FCM INITIALIZATION
  // ==========================================
  useEffect(() => {
    if (!user || isOfflineMode) return;

    const initFCM = async () => {
      const supported = await checkFCMSupport();
      if (!supported) {
        console.log("FCM không được hỗ trợ");
        return;
      }

      const result = await initializeFCM(user.uid);
      setFcmConfig(result);

      if (result.enabled) {
        showToast("Đã bật thông báo Push!", "success");
      }
    };

    initFCM();
  }, [user, isOfflineMode, showToast]);

  // Listen for foreground FCM messages
  useEffect(() => {
    if (!fcmConfig.enabled) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log("Received FCM message:", payload);

      // Show toast notification & Add to Notification Center
      if (payload.notification) {
        const title = payload.notification.title || "Thông báo mới";
        const body = payload.notification.body || "";

        showToast(`${title}: ${body}`, 'info');
        addNotification(title, body, 'info', true);
      }
    });

    return () => unsubscribe();
  }, [fcmConfig.enabled, showToast, addNotification]);



  // PWA Install Event Listener
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      showToast("Đang cài đặt ứng dụng...", "success");
    }
  }, [deferredPrompt, showToast]);

  useEffect(() => {
    const themeObj = APP_THEMES.find(t => t.name === currentTheme) || APP_THEMES[0];
    const root = document.documentElement;
    Object.entries(themeObj.colors).forEach(([shade, rgb]) => {
      root.style.setProperty(`--color-primary-${shade}`, rgb);
    });
    localStorage.setItem('app_theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        setIsOfflineMode(false);
        setUseFirebase(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleTouchStart = (e: React.TouchEvent) => { if (window.scrollY === 0) startY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current > 0) {
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0 && diff < 150) setPullY(diff);
    }
  };
  const handleTouchEnd = async () => {
    if (pullY > 80) {
      setIsRefreshing(true);
      hapticFeedback.light();
      await new Promise(res => setTimeout(res, 800));
      hapticFeedback.medium();
      showToast("Đã làm mới dữ liệu", "success");
      setIsRefreshing(false);
    }
    setPullY(0);
    startY.current = 0;
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedTagFilter) result = result.filter(t => (t.tags || ['Khác']).includes(selectedTagFilter));
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(lowerQuery) || t.description?.toLowerCase().includes(lowerQuery));
    }
    return result;
  }, [tasks, selectedTagFilter, searchQuery]);

  const effectiveUserId = user ? user.uid : (isOfflineMode ? 'offline_user' : null);
  useEffect(() => {
    if (!effectiveUserId) return;
    let unsubscribe: () => void;
    if (useFirebase && !isOfflineMode) {
      unsubscribe = subscribeToTasks(effectiveUserId, (fetchedTasks) => setTasks(fetchedTasks), (error) => setUseFirebase(false));
    } else {
      const saved = localStorage.getItem(isOfflineMode ? 'offlineTasks' : 'localTasks');
      if (saved) try { setTasks(JSON.parse(saved)); } catch (e) { setTasks([]); }
    }
    return () => unsubscribe && unsubscribe();
  }, [useFirebase, effectiveUserId, isOfflineMode]);

  useEffect(() => {
    if (!effectiveUserId) return;
    let unsubscribeTags: () => void;
    if (useFirebase && !isOfflineMode) {
      unsubscribeTags = subscribeToTags(effectiveUserId, (fetchedTags) => setTags(fetchedTags), (error) => { });
    } else {
      const saved = localStorage.getItem(isOfflineMode ? 'offlineTags' : 'localTags');
      if (saved) try { setTags(JSON.parse(saved)); } catch (e) { setTags(DEFAULT_TASK_TAGS); }
    }
    return () => unsubscribeTags && unsubscribeTags();
  }, [useFirebase, effectiveUserId, isOfflineMode]);

  const saveTaskToDatabase = useCallback(async (task: Task) => {
    if (useFirebase && !isOfflineMode) {
      try {
        if (task.id === 'temp') {
          await addTaskToFirestore(task);
          showToast("Đã thêm công việc mới", "success");
        } else {
          await updateTaskInFirestore(task);
          showToast("Đã lưu thay đổi", "success");
        }
      } catch (e) {
        showToast("Lỗi đồng bộ Cloud", "warning");
      }
    } else {
      if (task.id === 'temp') {
        setTasks(prev => [...prev, { ...task, id: Date.now().toString() }]);
        showToast("Đã thêm (Offline)", "success");
      } else {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        showToast("Đã lưu (Offline)", "success");
      }
    }
  }, [useFirebase, isOfflineMode, showToast]);

  const handleRequestAddTask = useCallback(async (task: Task, skipCheck = false) => {
    hapticFeedback.medium();

    if (skipCheck) {
      await saveTaskToDatabase(task);
    } else {
      // AI Check Conflict BEFORE adding
      const conflictList = await checkProposedTaskConflict(task, tasks);
      if (conflictList.length > 0) {
        setPendingConflicts(conflictList);
        setProposedTask(task);
        setIsConflictModalOpen(true);
        hapticFeedback.warning();
        return; // Don't proceed to save or notify if conflict exists
      }
      await saveTaskToDatabase(task);
    }

    // Gửi thông báo Telegram khi tạo mới (nếu có config)
    // Chạy cho cả trường hợp skipCheck (Import từ Telegram/QuickAdd) và normal add
    if (task.id === 'temp') {
      addNotification("Tạo mới thành công", `Đã thêm công việc: ${task.title}`, "success");

      if (telegramConfig.botToken && telegramConfig.chatId) {
        try {
          const msg = formatNewTaskForTelegram(task);
          await sendTelegramMessage(telegramConfig, msg);
          console.log("Sent Telegram notification for new task:", task.title);
        } catch (error) {
          console.error("Failed to send creation notification to Telegram", error);
        }
      }
    }
  }, [tasks, saveTaskToDatabase, addNotification]);

  const handleUpdateTask = useCallback(async (updatedTask: Task, notify = true) => {
    // Only check conflict for updates if time/date changed AND it's not just a reminder flag update
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

    // Save to persistence
    if (useFirebase && !isOfflineMode) {
      try {
        await updateTaskInFirestore(updatedTask);
        if (notify) showToast("Đã lưu thay đổi", "success");
      } catch (e) {
        if (notify) showToast("Lỗi cập nhật", "warning");
      }
    } else {
      // Offline persistence
      if (isOfflineMode) {
        const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        localStorage.setItem('offlineTasks', JSON.stringify(newTasks));
        if (notify) showToast("Đã lưu (Offline)", "success");
      }
    }
  }, [tasks, useFirebase, isOfflineMode, showToast]);

  // ==========================================
  // LOGIC NHẮC VIỆC & TELEGRAM (REALTIME)
  // ==========================================
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    // Chạy kiểm tra mỗi 30 giây
    const checkInterval = setInterval(async () => {
      const now = new Date();

      for (const task of tasks) {
        // Bỏ qua nếu đã xong
        if (task.completed) continue;

        // Kiểm tra Snooze TRƯỚC (ưu tiên cao hơn reminderSent)
        const snoozedUntil = snoozedTasksRef.current.get(task.id);
        let snoozeJustExpired = false;
        if (snoozedUntil) {
          if (now.getTime() < snoozedUntil) {
            continue; // Chưa hết giờ ngủ, bỏ qua
          } else {
            // Snooze vừa hết hạn: dọn map, cho phép nhắc lại dù reminderSent = true
            snoozedTasksRef.current.delete(task.id);
            snoozeJustExpired = true;
          }
        }

        // Bỏ qua nếu đã nhắc — TRỪ KHI snooze vừa hết
        if (task.reminderSent && !snoozeJustExpired) continue;

        // Parse thời gian task
        const taskDateTime = parseISO(`${task.date}T${task.time}`);
        if (isNaN(taskDateTime.getTime())) continue;

        const diffInMinutes = differenceInMinutes(taskDateTime, now);

        // Điều kiện nhắc: Còn <= reminderMinutesBefore phút và chưa quá giờ
        const shouldRemind = isSameDay(taskDateTime, now) &&
          diffInMinutes <= reminderMinutesBefore &&
          diffInMinutes > 0;

        if (shouldRemind) {
          // 1. Hiển thị Reminder Modal & Notification Center
          setReminderTask(task);
          setIsReminderModalOpen(true);
          // Don't play sound in addNotification here because ReminderModal handles looping sound
          addNotification(
            `Sắp đến hạn: ${task.title}`,
            `${task.time} - ${task.description || 'Không có mô tả'}`,
            'warning',
            false
          );

          // 2. Gửi Browser / Native Notification
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

          // 3. Gửi Telegram Message (Nếu có cấu hình)
          if (telegramConfig.botToken && telegramConfig.chatId) {
            const msg = formatTaskForTelegram(task);
            await sendTelegramMessage(telegramConfig, msg);
          }

          // 4. Cập nhật flag reminderSent = true để không nhắc lại
          const updatedTask = { ...task, reminderSent: true };
          await handleUpdateTask(updatedTask, false);
          console.log(`Đã gửi nhắc nhở cho task: ${task.title}`);
        }
      }
    }, 30 * 1000); // 30 giây check 1 lần

    return () => clearInterval(checkInterval);
  }, [tasks, telegramConfig, reminderMinutesBefore, addNotification, handleUpdateTask]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const nextState = !task.completed;
    const updated = { ...task, completed: nextState };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));

    if (useFirebase && !isOfflineMode) {
      await updateTaskInFirestore(updated);
    }

    if (nextState) {
      hapticFeedback.medium();
      showToast(`Đã xong: ${task.title}`, "success");
      // Notify completion
      addNotification("Đã hoàn thành", `Chúc mừng bạn đã hoàn thành: ${task.title}`, "success", false); // No sound for completion, just helpful
    }
  }, [useFirebase, isOfflineMode, showToast, addNotification]);

  // Handler cho Reminder Modal
  const handleReminderClose = useCallback(() => {
    setIsReminderModalOpen(false);
    setReminderTask(null);
  }, []);

  const handleReminderSnooze = useCallback((minutes: number) => {
    if (reminderTask) {
      // Lưu thời gian "ngủ đông" trong bộ nhớ (ref) — KHÔNG dùng Firestore để tránh race condition với real-time listener
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

  const executeDeleteTask = useCallback(async () => {
    if (!taskToDeleteId) return;
    try {
      if (useFirebase && !isOfflineMode) await deleteTaskFromFirestore(taskToDeleteId);
      setTasks(prev => prev.filter(t => t.id !== taskToDeleteId));
      showToast("Đã xóa công việc", "info");

      // Notify deletion
      addNotification("Đã xóa", "Công việc đã được xóa khỏi danh sách.", "info", false);
    } catch (e) { showToast("Lỗi khi xóa.", "error"); }
    setTaskToDeleteId(null);
  }, [taskToDeleteId, useFirebase, isOfflineMode, showToast, addNotification]);

  // ==========================================
  // MANUAL SYNC: FETCH FROM TELEGRAM -> ADD TASKS
  // ==========================================
  const handleManualSync = useCallback(async (isSilent = false) => {
    if (!telegramConfig.botToken) {
      if (!isSilent) showToast("Chưa cấu hình Bot Token", "warning");
      return;
    }

    // Nếu đang sync thì thôi, tránh chồng chéo
    if (isSyncing) return; // Note: isSyncing ref might be better here to avoid dependency change, but let's stick to simple fix first

    if (!isSilent) setIsSyncing(true);

    try {
      // 1. Lấy tin nhắn mới nhất (dựa trên offset)
      const updates = await fetchTelegramUpdates(telegramConfig, lastTelegramUpdateId + 1);

      if (updates.length > 0) {
        let addedCount = 0;
        let maxId = lastTelegramUpdateId;
        const availableTags = tags.map(t => t.name);

        for (const update of updates) {
          if (update.update_id > maxId) maxId = update.update_id;

          // 2. Dùng AI phân tích
          console.log("Processing update:", update.message);
          // Rate limit: Wait 1s between Gemini calls if needed, but important for Tele updates loop
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

              // Rate limit: Delay 1s between adds to avoid hitting Telegram "send message" limit
              await new Promise(res => setTimeout(res, 1000));
            }
          } else {
            console.warn("AI returned no tasks for message:", update.message);
          }
          // Delay between messages
          await new Promise(res => setTimeout(res, 500));
        }

        // Lưu offset mới
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
      if (!isSilent) setIsSyncing(false);
    }
  }, [telegramConfig, lastTelegramUpdateId, tags, handleRequestAddTask, showToast, isSyncing, user, isOfflineMode]);

  // Use a ref to store the latest sync function ensures useEffect doesn't reset interval
  const savedSyncCallback = useRef(handleManualSync);
  useEffect(() => {
    savedSyncCallback.current = handleManualSync;
  }, [handleManualSync]);

  // Auto-Sync Effect
  useEffect(() => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) return;

    const intervalId = setInterval(() => {
      savedSyncCallback.current(true); // Silent sync
    }, 60 * 1000); // 60 seconds

    return () => clearInterval(intervalId);
  }, [telegramConfig]); // Only restart if config changes

  const renderContent = () => {
    switch (viewMode) {
      case ViewMode.STATS: return <StatsView currentDate={currentDate} tasks={tasks} tags={tags} />;
      case ViewMode.LIST: return <DashboardView filteredTasks={filteredTasks} tags={tags} onToggleComplete={handleToggleComplete} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onDeleteTask={(id) => { setTaskToDeleteId(id); setIsDeleteModalOpen(true); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.KANBAN: return <KanbanView tasks={filteredTasks} tags={tags} onToggleComplete={handleToggleComplete} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onUpdateStatus={(id, s) => { const t = tasks.find(x => x.id === id); if (t) handleUpdateTask({ ...t, customStatus: s, completed: s === 'done' }); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.TIMELINE: return <TimelineView currentDate={currentDate} tasks={filteredTasks} tags={tags} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.FOCUS: return <FocusView tasks={filteredTasks} tags={tags} onCompleteSession={(id) => { const t = tasks.find(x => x.id === id); if (t) handleUpdateTask({ ...t, pomodoroSessions: (t.pomodoroSessions || 0) + 1 }, false); }} />;
      default: return <CalendarView currentDate={currentDate} viewMode={viewMode} tasks={filteredTasks} tags={tags} onDeleteTask={(id) => { setTaskToDeleteId(id); setIsDeleteModalOpen(true); }} onEditTask={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onToggleComplete={handleToggleComplete} onMoveTask={(id, d) => { const t = tasks.find(x => x.id === id); if (t) handleUpdateTask({ ...t, date: d }); }} onSelectDate={(d) => { setCurrentDate(d); setViewMode(ViewMode.DAY); }} onTagClick={setSelectedTagFilter} />;
    }
  };

  if (isAuthLoading) return <div className="flex h-screen items-center justify-center bg-primary-50 dark:bg-gray-950"><RefreshCw className="animate-spin text-primary-600" size={32} /></div>;

  const isDesktopAuth = new URLSearchParams(window.location.search).get('desktop_auth') === 'true';
  if ((!user && !isOfflineMode) || isDesktopAuth) {
    return <LoginScreen onBypassAuth={() => { setIsOfflineMode(true); setUseFirebase(false); }} />;
  }

  return (
    <div
      className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] text-gray-800 dark:text-gray-100 bg-primary-50 dark:bg-gray-950 overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Header with Install Logic passed down */}
      <Header
        currentDate={currentDate} setCurrentDate={setCurrentDate} getHeaderText={format(currentDate, viewMode === ViewMode.DAY ? 'dd/MM/yyyy' : 'MM/yyyy')}
        onPrev={() => setCurrentDate(prev => addMonths(prev, -1))} onNext={() => setCurrentDate(prev => addMonths(prev, 1))}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearchActive={isSearchActive} setIsSearchActive={setIsSearchActive}
        isDatePickerOpen={isDatePickerOpen} setIsDatePickerOpen={setIsDatePickerOpen} user={user} isOfflineMode={isOfflineMode}
        isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} setIsSettingsOpen={setIsSettingsOpen}
        onLogout={() => { if (isOfflineMode) window.location.reload(); else logOut(); }}
        datePickerRef={datePickerRef} searchInputRef={searchInputRef} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        deferredPrompt={deferredPrompt}
        onInstallApp={handleInstallClick}
        notifications={notifications}
        onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
        onClearAllNotifications={clearAllNotifications}
        onMarkNotificationAsRead={markNotificationAsRead}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <main className="flex-1 p-2 lg:p-3 overflow-hidden flex flex-col">
          <div className="hidden lg:flex gap-1 mb-3">
            {[ViewMode.MONTH, ViewMode.WEEK, ViewMode.DAY, ViewMode.LIST, ViewMode.KANBAN, ViewMode.TIMELINE, ViewMode.FOCUS, ViewMode.STATS].map(mode => (
              <button
                key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === mode ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
              >
                {mode === ViewMode.FOCUS && <Timer size={12} />} {mode}
              </button>
            ))}
          </div>
          <div className="flex-1 relative overflow-hidden">{renderContent()}</div>
        </main>

        <aside className={`hidden lg:flex flex-col border-l border-primary-200 dark:border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0'}`}>
          <Sidebar onAddTask={handleRequestAddTask} onGenerateReport={() => { setIsReportLoading(true); generateReport(tasks, "Tháng").then(r => { setAiReport(r); setIsReportLoading(false); }); }} isReportLoading={isReportLoading} aiReport={aiReport} tags={tags} user={user} isOfflineMode={isOfflineMode} isDarkMode={isDarkMode} showToast={showToast} />
        </aside>

        <MobileNavigation viewMode={viewMode} setViewMode={setViewMode} onCreateNewTask={() => { setEditingTask({ id: 'temp', title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', completed: false, tags: ['Khác'] }); setIsEditModalOpen(true); }} onOpenSettings={() => setIsSettingsOpen(true)} onOpenAI={() => setIsAIOpen(true)} />
      </div>

      <AiAssistant tasks={tasks} externalOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        telegramConfig={telegramConfig}
        tags={tags}
        onSaveConfig={(cfg) => {
          setTelegramConfig(cfg);
          localStorage.setItem('telegramConfig', JSON.stringify(cfg));
          // Save to Firestore when updating
          if (user && useFirebase) {
            saveTelegramConfigToFirestore(user.uid, cfg);
            showToast("Cấu hình Telegram đã được đồng bộ lên Cloud", "success");
          }
        }}
        onSaveTags={(t) => setTags(t)}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
        lastSyncTime={format(new Date(), 'HH:mm')}
        showToast={showToast}
        currentTheme={currentTheme}
        setCurrentTheme={setCurrentTheme}
        themes={APP_THEMES}
        fcmConfig={fcmConfig}
        onFCMChange={setFcmConfig}
        userId={user?.uid}
        reminderMinutesBefore={reminderMinutesBefore}
        onReminderMinutesChange={(minutes) => {
          setReminderMinutesBefore(minutes);
          localStorage.setItem('reminder_minutes_before', minutes.toString());
        }}
      />

      <EditTaskModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} task={editingTask} tags={tags} onSave={async (t) => { if (t.id === 'temp') await handleRequestAddTask(t); else await handleUpdateTask(t); setIsEditModalOpen(false); }} showToast={showToast} />

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={executeDeleteTask} title="Xác nhận" message="Bạn có chắc muốn xóa không?" />

      {/* AI Conflict Modal (This stays as requested) */}
      <ConflictWarningModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onConfirm={() => {
          if (proposedTask) {
            saveTaskToDatabase(proposedTask);
            setProposedTask(null);
          }
        }}
        conflicts={pendingConflicts}
        taskTitle={proposedTask?.title || ""}
      />

      {/* Reminder Modal */}
      <ReminderModal
        isOpen={isReminderModalOpen}
        task={reminderTask}
        tags={tags}
        onClose={handleReminderClose}
        onSnooze={handleReminderSnooze}
        onMarkComplete={handleReminderComplete}
      />
    </div>
  );
};

export default App;