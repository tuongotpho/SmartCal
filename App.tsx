
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
  startOfWeek,
  startOfMonth,
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
  Kanban
} from 'lucide-react';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import SettingsModal from './components/SettingsModal';
import EditTaskModal from './components/EditTaskModal';
import ConfirmModal from './components/ConfirmModal';
import LoginScreen from './components/LoginScreen';
import AiAssistant from './components/AiAssistant';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNavigation from './components/MobileNavigation';
import DashboardView from './components/DashboardView';
import KanbanView from './components/KanbanView';

import { Task, TelegramConfig, ViewMode, Tag, DEFAULT_TASK_TAGS, RecurringType } from './types';
import { parseTaskWithGemini, generateReport } from './services/geminiService';
import { sendTelegramMessage, fetchTelegramUpdates, formatTaskForTelegram } from './services/telegramService';
import { subscribeToTasks, subscribeToTags, saveTagsToFirestore, addTaskToFirestore, deleteTaskFromFirestore, updateTaskInFirestore, auth, logOut } from './services/firebase';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  // Tags Management State
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TASK_TAGS);
  
  // Filter & Search State
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Date Picker State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  
  // AI Report State
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Storage State
  const [useFirebase, setUseFirebase] = useState(true);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Telegram State
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('telegramConfig');
      return saved ? JSON.parse(saved) : { botToken: '', chatId: '' };
    } catch (e) {
      return { botToken: '', chatId: '' };
    }
  });
  
  const [lastTelegramUpdateId, setLastTelegramUpdateId] = useState<number>(() => {
    const saved = localStorage.getItem('lastTelegramUpdateId');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Capture PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      console.log("PWA install prompt captured");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        setIsOfflineMode(false);
        setUseFirebase(true); // Re-enable firebase if logged in
      }
    });
    return () => unsubscribe();
  }, []);

  // Toggle Dark Mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Auto focus search
  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  // --- Filter Logic ---
  
  const visibleTags = useMemo(() => {
    const usedTagNames = new Set(tasks.map(t => t.tag || 'Khác'));
    return tags.filter(t => usedTagNames.has(t.name));
  }, [tasks, tags]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (selectedTagFilter) {
      result = result.filter(t => (t.tag || 'Khác') === selectedTagFilter);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lowerQuery) || 
        t.description?.toLowerCase().includes(lowerQuery)
      );
    }

    return result;
  }, [tasks, selectedTagFilter, searchQuery]);

  // --- Toast Helper ---
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Click outside to close Date Picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effectiveUserId = user ? user.uid : (isOfflineMode ? 'offline_user' : null);

  // Load Tasks Effect
  useEffect(() => {
    if (!effectiveUserId) return;

    let unsubscribe: () => void;

    if (useFirebase && !isOfflineMode) {
      unsubscribe = subscribeToTasks(
        effectiveUserId,
        (fetchedTasks) => {
          setTasks(fetchedTasks);
          setFirebaseError(null);
        },
        (error) => {
          const isPermissionError = error.message.includes('permission-denied') || error.code === 'permission-denied';
          const errorMsg = isPermissionError 
            ? "Lỗi quyền truy cập. Vui lòng kiểm tra Firestore Rules." 
            : (error.message || "Lỗi kết nối Firebase");
            
          console.log("Chuyển sang chế độ Offline do lỗi:", errorMsg);
          if (useFirebase) showToast(`Chuyển sang Offline: ${errorMsg}`, 'error');
          setFirebaseError(errorMsg);
          setUseFirebase(false);
        }
      );
    } else {
      const storageKey = isOfflineMode ? 'offlineTasks' : 'localTasks';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {
          console.error("Lỗi đọc LocalStorage", e);
        }
      } else {
        setTasks([]);
      }
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [useFirebase, showToast, effectiveUserId, isOfflineMode]);

  // Load Tags Effect
  useEffect(() => {
    if (!effectiveUserId) return;

    let unsubscribeTags: () => void;
    if (useFirebase && !isOfflineMode) {
      unsubscribeTags = subscribeToTags(
        effectiveUserId,
        (fetchedTags) => {
          if (fetchedTags && fetchedTags.length > 0) {
             setTags(fetchedTags);
          }
        },
        (error) => {
          console.warn("Không thể load tags từ Firebase, dùng LocalStorage fallback");
          try {
            const saved = localStorage.getItem('taskTags');
            if (saved) setTags(JSON.parse(saved));
          } catch(e) {}
        }
      );
    } else {
       try {
        const saved = localStorage.getItem('taskTags');
        if (saved) setTags(JSON.parse(saved));
      } catch(e) {}
    }

    return () => {
      if (unsubscribeTags) unsubscribeTags();
    }
  }, [useFirebase, effectiveUserId, isOfflineMode]);

  // Sync LocalStorage when offline
  useEffect(() => {
    if (!useFirebase || isOfflineMode) {
      try {
        const storageKey = isOfflineMode ? 'offlineTasks' : 'localTasks';
        localStorage.setItem(storageKey, JSON.stringify(tasks));
        localStorage.setItem('taskTags', JSON.stringify(tags));
      } catch (e) {
        console.error("Error saving to LocalStorage", e);
      }
    }
  }, [tasks, tags, useFirebase, isOfflineMode]);

  useEffect(() => {
    try {
      localStorage.setItem('telegramConfig', JSON.stringify(telegramConfig));
    } catch (e) {
       console.error("Error saving telegramConfig", e);
    }
  }, [telegramConfig]);

  useEffect(() => {
    localStorage.setItem('lastTelegramUpdateId', lastTelegramUpdateId.toString());
  }, [lastTelegramUpdateId]);

  // --- Handlers (Memoized) ---

  const handleUpdateTask = useCallback(async (updatedTask: Task, showNotification: boolean = true) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    if (useFirebase && !isOfflineMode) {
      try {
        await updateTaskInFirestore(updatedTask);
        if (showNotification) showToast("Cập nhật thành công", "success");
      } catch (e) {
        setUseFirebase(false);
        setFirebaseError("Lỗi cập nhật online. Chuyển sang Offline.");
        showToast("Lỗi cập nhật online. Chuyển sang Offline.", "warning");
      }
    } else {
      if (showNotification) showToast("Đã lưu (Offline)", "success");
    }
  }, [useFirebase, showToast, isOfflineMode]);

  const handleUpdateStatusKanban = useCallback(async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedTask: Task = {
          ...task,
          completed: status === 'done', // Map done to completed
          customStatus: status
      };
      
      await handleUpdateTask(updatedTask, false);
  }, [tasks, handleUpdateTask]);

  const handleSaveTags = useCallback(async (newTags: Tag[]) => {
    setTags(newTags); // Optimistic UI update
    
    if (useFirebase && user && !isOfflineMode) {
      try {
        await saveTagsToFirestore(user.uid, newTags);
        showToast("Đã lưu danh sách thẻ vào Cloud", "success");
      } catch (e) {
        console.error("Lỗi lưu tags lên Firebase", e);
        showToast("Lỗi lưu thẻ lên Cloud", "error");
      }
    } else {
      try {
         localStorage.setItem('taskTags', JSON.stringify(newTags));
         showToast("Đã lưu thẻ (Offline)", "success");
      } catch(e) {
         showToast("Lỗi lưu thẻ vào máy", "error");
      }
    }
  }, [useFirebase, showToast, user, isOfflineMode]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const updatedTask = { ...task, completed: !task.completed };
    await handleUpdateTask(updatedTask, false);
  }, [handleUpdateTask]);

  const handleMoveTask = useCallback(async (taskId: string, newDate: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      if (task.recurringType && task.recurringType !== 'none') {
        showToast("Không thể kéo thả công việc lặp lại. Vui lòng chỉnh sửa trực tiếp.", "warning");
        return;
      }
      const updatedTask = { ...task, date: newDate };
      await handleUpdateTask(updatedTask, false);
    }
  }, [tasks, handleUpdateTask, showToast]);

  const handleGenerateReport = async () => {
    setIsReportLoading(true);
    setAiReport(null);
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      
      const tasksInView = filteredTasks.filter(t => {
        const tDate = new Date(t.date);
        return isWithinInterval(tDate, { start, end });
      });

      const report = await generateReport(tasksInView, `Tháng ${format(currentDate, 'MM/yyyy')}`);
      setAiReport(report);
      showToast("Đã tạo báo cáo thành công!", "success");
    } catch (error) {
      showToast("Không thể tạo báo cáo.", "error");
    } finally {
      setIsReportLoading(false);
    }
  };

  // --- Notifications & Timers ---
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date();
      const currentTimeOnly = format(now, 'HH:mm');
      const currentYMD = format(now, 'yyyy-MM-dd');
      
      tasks.forEach(task => {
        let shouldRemind = false;
        if (task.completed) return;
        const recType = task.recurringType || (task.isRecurring ? 'daily' : 'none');
        const taskStartDate = new Date(task.date);

        if (now.getTime() < taskStartDate.getTime() && currentYMD !== task.date) return;
        if (task.time !== currentTimeOnly) return;

        if (recType === 'none') {
           if (task.date === currentYMD && !task.reminderSent) shouldRemind = true;
        } else {
           switch (recType) {
              case 'daily': shouldRemind = true; break;
              case 'weekly': if (getDay(now) === getDay(taskStartDate)) shouldRemind = true; break;
              case 'monthly': if (getDate(now) === getDate(taskStartDate)) shouldRemind = true; break;
              case 'yearly': if (getDate(now) === getDate(taskStartDate) && getMonth(now) === getMonth(taskStartDate)) shouldRemind = true; break;
           }
        }
        
        if (shouldRemind) {
          new Notification("🔔 Nhắc việc", {
            body: `Đã đến giờ: ${task.title}\n${task.description || ''}`,
            icon: '/icon.png'
          });

          if (telegramConfig.botToken && telegramConfig.chatId) {
             let prefix = "⏰ ĐẾN GIỜ: ";
             if (recType !== 'none') prefix = `🔁 LẶP ${recType.toUpperCase()}: `;
             sendTelegramMessage(telegramConfig, `${prefix} <b>${task.title}</b>\n\n${task.description || ''}\nThời gian: ${task.time}`);
          }

          if (recType === 'none') {
            handleUpdateTask({ ...task, reminderSent: true }, false);
          }
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [tasks, telegramConfig, handleUpdateTask]);

  // --- Task Operations ---
  
  const handleAddTask = async (newTask: Task, syncTelegram: boolean = true) => {
    const tempId = Date.now().toString();
    const taskWithTempId = { ...newTask, id: tempId };
    setTasks(prev => [...prev, taskWithTempId]);

    if (useFirebase && user && !isOfflineMode) {
      try {
        await addTaskToFirestore({
          userId: user.uid,
          title: newTask.title,
          date: newTask.date,
          time: newTask.time,
          duration: newTask.duration || "",
          description: newTask.description,
          completed: newTask.completed,
          reminderSent: false,
          recurringType: newTask.recurringType || 'none',
          tag: newTask.tag || 'Khác',
          subtasks: newTask.subtasks || [],
          isRecurring: false,
          customStatus: 'todo' // Default for new tasks
        });
        if (syncTelegram) showToast("Đã thêm công việc mới", "success");
      } catch (e) {
        setUseFirebase(false);
        setFirebaseError("Không thể lưu online. Đã chuyển sang chế độ Offline.");
        showToast("Lỗi lưu online. Chuyển sang Offline.", "warning");
      }
    } else {
      showToast("Đã thêm công việc (Offline)", "success");
    }

    if (syncTelegram && telegramConfig.botToken) {
      sendTelegramMessage(telegramConfig, formatTaskForTelegram(newTask));
    }
  };

  const handleSaveTaskFromModal = async (taskToSave: Task) => {
    if (taskToSave.id === 'temp') {
       await handleAddTask(taskToSave);
    } else {
       await handleUpdateTask(taskToSave);
    }
  };

  const handleDeleteTask = useCallback((id: string) => {
    setTaskToDeleteId(id);
    setIsDeleteModalOpen(true);
  }, []);

  const executeDeleteTask = useCallback(async () => {
    if (!taskToDeleteId) return;
    const id = taskToDeleteId;
    const taskToDelete = tasks.find(t => t.id === id);

    if (taskToDelete) {
      if (telegramConfig.botToken && telegramConfig.chatId) {
        const deleteMsg = `🗑️ <b>Đã xóa nhắc việc!</b>\n\n❌ <b>${taskToDelete.title}</b>\n⏰ ${taskToDelete.time} - ${taskToDelete.date}`;
        sendTelegramMessage(telegramConfig, deleteMsg);
      }

      if (useFirebase && !isOfflineMode) {
        try {
          await deleteTaskFromFirestore(id);
          showToast("Đã xóa công việc", "success");
        } catch (e) {
          setUseFirebase(false);
          setTasks(prev => prev.filter(t => t.id !== id));
          showToast("Xóa offline (Lỗi kết nối)", "warning");
        }
      } else {
        setTasks(prev => prev.filter(t => t.id !== id));
        showToast("Đã xóa công việc", "success");
      }
    }
    setTaskToDeleteId(null);
  }, [taskToDeleteId, tasks, telegramConfig, useFirebase, showToast, isOfflineMode]);

  const openEditModal = useCallback((task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

  const handleCreateNewTask = () => {
    const now = new Date();
    const targetDate = format(currentDate, 'yyyy-MM-dd');
    
    const newTask: Task = {
      id: "temp",
      userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
      title: "",
      date: targetDate,
      time: format(now, "HH:mm"),
      duration: "",
      description: "",
      completed: false,
      reminderSent: false,
      recurringType: 'none',
      tag: 'Khác',
      subtasks: [],
      customStatus: 'todo'
    };
    setEditingTask(newTask);
    setIsEditModalOpen(true);
  };

  const handleDaySelect = (date: Date) => {
    setCurrentDate(date);
    setViewMode(ViewMode.DAY);
  };

  const executeTelegramSync = async (isManual: boolean = false) => {
    if (!telegramConfig.botToken || (!user && !isOfflineMode)) return;
    
    try {
      const offset = lastTelegramUpdateId ? lastTelegramUpdateId + 1 : 0;
      const updates = await fetchTelegramUpdates(telegramConfig, offset);
      let count = 0;
      let maxId = lastTelegramUpdateId;
      const availableTags = tags.map(t => t.name);
      
      for (const update of updates) {
        maxId = Math.max(maxId, update.update_id);
        const msg = update.message;

        const result = await parseTaskWithGemini(msg, availableTags);
        if (result) {
          const exists = tasks.some(t => t.date === result.date && t.time === result.time && t.title === result.title);
          if (!exists) {
            await handleAddTask({
              id: "temp",
              userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
              title: result.title,
              date: result.date,
              time: result.time,
              duration: result.duration || "",
              description: `Đồng bộ từ Telegram: "${msg}"`,
              completed: false,
              reminderSent: false,
              recurringType: (result.recurringType as RecurringType) || 'none',
              tag: result.tag || 'Khác',
              subtasks: [],
              customStatus: 'todo'
            }, false);
            count++;
          }
        }
      }

      setLastTelegramUpdateId(maxId);

      if (isManual) {
        if (count > 0) showToast(`Đã đồng bộ ${count} công việc mới!`, "success");
        else showToast("Không có tin nhắn mới nào.", "info");
      }
    } catch (e) {
      if (isManual) showToast("Lỗi khi đồng bộ Telegram.", "error");
    }
  };

  const handleSyncFromTelegram = () => executeTelegramSync(true);

  useEffect(() => {
    if (!telegramConfig.botToken) return;
    const intervalId = setInterval(() => {
      executeTelegramSync(false);
    }, 60 * 1000); 
    return () => clearInterval(intervalId);
  }, [telegramConfig, tasks, lastTelegramUpdateId, user, isOfflineMode]);

  const handlePrev = useCallback(() => {
    if (viewMode === ViewMode.WEEK) {
      setCurrentDate(prev => addWeeks(prev, -1));
    } else if (viewMode === ViewMode.DAY) {
      setCurrentDate(prev => addDays(prev, -1));
    } else {
      setCurrentDate(prev => addMonths(prev, -1));
    }
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === ViewMode.WEEK) {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else if (viewMode === ViewMode.DAY) {
      setCurrentDate(prev => addDays(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  }, [viewMode]);

  const getHeaderText = useMemo(() => {
    if (viewMode === ViewMode.DAY) return format(currentDate, 'dd/MM/yyyy');
    if (viewMode === ViewMode.WEEK) {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (getMonth(start) === getMonth(end)) {
         return `Tháng ${format(currentDate, 'MM/yyyy')}`;
      }
      return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
    }
    return `Tháng ${format(currentDate, 'MM/yyyy')}`;
  }, [currentDate, viewMode]);

  const renderContent = () => {
    if (viewMode === ViewMode.STATS) {
      return <StatsView currentDate={currentDate} tasks={tasks} tags={tags} />;
    }

    if (viewMode === ViewMode.LIST) {
        return (
          <DashboardView 
            filteredTasks={filteredTasks}
            tags={tags}
            onToggleComplete={handleToggleComplete}
            onOpenEditModal={openEditModal}
            onDeleteTask={handleDeleteTask}
          />
        );
    }

    if (viewMode === ViewMode.KANBAN) {
       return (
          <KanbanView 
             tasks={filteredTasks}
             tags={tags}
             onToggleComplete={handleToggleComplete}
             onOpenEditModal={openEditModal}
             onUpdateStatus={handleUpdateStatusKanban}
          />
       )
    }

    return (
      <CalendarView 
        currentDate={currentDate}
        viewMode={viewMode}
        tasks={filteredTasks}
        tags={tags}
        onDeleteTask={handleDeleteTask}
        onEditTask={openEditModal}
        onToggleComplete={handleToggleComplete}
        onMoveTask={handleMoveTask}
        onSelectDate={handleDaySelect}
      />
    );
  };

  // If loading auth state
  if (isAuthLoading) {
     return (
        <div className="flex h-screen items-center justify-center bg-[#fff7ed] dark:bg-gray-950 text-orange-600">
           <RefreshCw className="animate-spin" size={32} />
        </div>
     );
  }

  // If not logged in AND not in offline mode
  if (!user && !isOfflineMode) {
     return <LoginScreen onBypassAuth={() => { setIsOfflineMode(true); setUseFirebase(false); }} />;
  }

  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] text-gray-800 dark:text-gray-100 bg-[#fff7ed] dark:bg-gray-950 overflow-hidden transition-colors duration-300">
      <Toast toasts={toasts} onRemove={removeToast} />

      {!useFirebase ? (
        <div className="bg-stone-100 dark:bg-gray-800 border-b border-stone-200 dark:border-gray-700 text-stone-800 dark:text-gray-200 p-2 text-xs flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="text-stone-500 dark:text-gray-400" />
            <div>
              <span className="font-bold">Đang chạy chế độ Offline.</span>
              <span className="ml-1 text-stone-600 dark:text-gray-400 opacity-80">{isOfflineMode ? "Dữ liệu lưu trên máy." : firebaseError}</span>
            </div>
          </div>
          {!isOfflineMode && (
            <button onClick={() => { setFirebaseError(null); setUseFirebase(true); }} className="bg-stone-200 dark:bg-gray-700 hover:bg-stone-300 px-3 py-1 rounded flex items-center gap-1">
               <RefreshCw size={12} /> Kết nối lại
            </button>
          )}
          {isOfflineMode && (
             <button onClick={() => window.location.reload()} className="text-orange-600 dark:text-orange-400 hover:underline">
               Đăng nhập
             </button>
          )}
        </div>
      ) : null}

      {/* Replaced Monolithic Header with Component */}
      <Header 
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        getHeaderText={getHeaderText}
        onPrev={handlePrev}
        onNext={handleNext}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
        user={user}
        isOfflineMode={isOfflineMode}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        setIsSettingsOpen={setIsSettingsOpen}
        onLogout={() => { if(isOfflineMode) window.location.reload(); else logOut(); }}
        datePickerRef={datePickerRef}
        searchInputRef={searchInputRef}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Main Content Area */}
        <div className="flex-1 p-2 lg:p-3 flex flex-col min-w-0 order-1 lg:order-1 h-full overflow-hidden">
          {/* Desktop View Switcher & Filter */}
          <div className="hidden lg:flex flex-row items-center justify-between mb-3 px-1 flex-shrink-0 gap-2">
             <div className="flex gap-1 bg-orange-100 dark:bg-gray-800 p-1 rounded-lg shadow-sm">
                <button 
                  onClick={() => setViewMode(ViewMode.MONTH)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.MONTH ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                  <LayoutGrid size={14} /> Tháng
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.WEEK)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.WEEK ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                  <Columns size={14} /> Tuần
                </button>
                 <button 
                  onClick={() => setViewMode(ViewMode.DAY)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.DAY ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                  <Square size={14} /> Ngày
                </button>
                <div className="w-[1px] bg-orange-200 dark:bg-gray-700 mx-1"></div>
                <button 
                  onClick={() => setViewMode(ViewMode.LIST)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.LIST ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                   <Layout size={14} /> Dashboard
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.KANBAN)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.KANBAN ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                   <Kanban size={14} /> Kanban
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.STATS)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.STATS ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                   <PieChart size={14} /> Thống kê
                </button>
             </div>
             
             {/* Filter by Tag Section */}
             {viewMode !== ViewMode.STATS && visibleTags.length > 0 && (
               <div className="flex gap-2 items-center flex-wrap justify-end">
                  {visibleTags.map(t => {
                    const isActive = selectedTagFilter === t.name;
                    return (
                      <button 
                        key={t.name}
                        onClick={() => setSelectedTagFilter(isActive ? null : t.name)}
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all ${
                          isActive 
                            ? `bg-white dark:bg-gray-700 border-current shadow-sm ring-1 ring-offset-1 dark:ring-offset-gray-900 font-bold ${t.dot.replace('bg-', 'text-').replace('text-white', '')}` 
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 opacity-60 dark:opacity-100 hover:opacity-100' 
                        }`}
                        style={isActive ? { borderColor: 'currentColor' } : {}}
                        title={isActive ? "Bỏ lọc" : `Lọc theo thẻ ${t.name}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${t.dot}`}></span> {t.name}
                      </button>
                    )
                  })}
               </div>
             )}
          </div>
          
          {/* Mobile Filter Status */}
          <div className="lg:hidden px-1 mb-1">
             {searchQuery && (
                 <div className="flex items-center justify-between bg-orange-100 dark:bg-gray-800 px-3 py-1.5 rounded-md text-xs">
                    <span className="text-orange-800 dark:text-orange-200">Tìm: <b>{searchQuery}</b></span>
                    <button onClick={() => setSearchQuery("")} className="text-orange-600 dark:text-orange-400"><X size={14}/></button>
                 </div>
             )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {renderContent()}
          </div>
        </div>

        {/* Replaced Monolithic Sidebar with Component */}
        <Sidebar 
          onAddTask={handleAddTask}
          onGenerateReport={handleGenerateReport}
          isReportLoading={isReportLoading}
          aiReport={aiReport}
          tags={tags}
          user={user}
          isOfflineMode={isOfflineMode}
          isDarkMode={isDarkMode}
          showToast={showToast}
        />

        {/* Replaced Mobile Nav with Component */}
        <MobileNavigation 
          viewMode={viewMode}
          setViewMode={setViewMode}
          onCreateNewTask={handleCreateNewTask}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      <AiAssistant tasks={tasks} />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        telegramConfig={telegramConfig}
        tags={tags}
        onSaveConfig={setTelegramConfig}
        onSaveTags={handleSaveTags}
        onManualSync={handleSyncFromTelegram}
        isSyncing={false}
        lastSyncTime={format(new Date(), 'HH:mm')}
        showToast={showToast}
      />
      <EditTaskModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        task={editingTask} 
        tags={tags}
        onSave={handleSaveTaskFromModal} 
        showToast={showToast}
      />
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={executeDeleteTask} title="Xác nhận xóa" message="Bạn có chắc chắn muốn xóa công việc này không?" />
    </div>
  );
};

export default App;
