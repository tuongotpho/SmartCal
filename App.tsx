
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
  getWeek, 
  isToday, 
  isTomorrow, 
  isBefore, 
  isAfter, 
  startOfDay, 
  compareAsc, 
  differenceInDays, 
  add,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { 
  Settings, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Sparkles, 
  Bot, 
  CalendarPlus, 
  CloudOff, 
  WifiOff, 
  Edit3, 
  Repeat, 
  Flame, 
  CheckCircle2, 
  Circle, 
  Mic, 
  MicOff, 
  BarChart3, 
  PieChart, 
  ListChecks, 
  LayoutGrid, 
  Columns, 
  Square, 
  Trash2, 
  CalendarDays, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  Menu, 
  Filter, 
  ChevronDown, 
  Layout, 
  X, 
  Plus,
  Moon,
  Sun,
  LogOut,
  User
} from 'lucide-react';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import SettingsModal from './components/SettingsModal';
import EditTaskModal from './components/EditTaskModal';
import ConfirmModal from './components/ConfirmModal';
import DatePickerPopover from './components/DatePickerPopover';
import LoginScreen from './components/LoginScreen';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import { Task, TelegramConfig, ViewMode, RecurringType, Tag, DEFAULT_TASK_TAGS } from './types';
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
  
  // Filter State
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

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

  // Voice Input State (For Desktop Sidebar)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null); // Timer để tự động ngắt khi im lặng

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Telegram State
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('telegramConfig');
      return saved ? JSON.parse(saved) : { botToken: '', chatId: '' };
    } catch (e) {
      return { botToken: '', chatId: '' };
    }
  });
  
  // Lưu ID tin nhắn cuối cùng để tránh trùng lặp
  const [lastTelegramUpdateId, setLastTelegramUpdateId] = useState<number>(() => {
    const saved = localStorage.getItem('lastTelegramUpdateId');
    return saved ? parseInt(saved, 10) : 0;
  });

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

  // --- Filter Logic ---
  
  // Tính toán danh sách các thẻ ĐANG ĐƯỢC SỬ DỤNG
  const visibleTags = useMemo(() => {
    const usedTagNames = new Set(tasks.map(t => t.tag || 'Khác'));
    // Lọc danh sách tags gốc, chỉ giữ lại những tag có trong usedTagNames
    return tags.filter(t => usedTagNames.has(t.name));
  }, [tasks, tags]);

  const filteredTasks = useMemo(() => {
    if (!selectedTagFilter) return tasks;
    return tasks.filter(t => (t.tag || 'Khác') === selectedTagFilter);
  }, [tasks, selectedTagFilter]);

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

  // Determine effective user ID for data fetching
  const effectiveUserId = user ? user.uid : (isOfflineMode ? 'offline_user' : null);

  // Load Tasks Effect (Updated to use effectiveUserId)
  useEffect(() => {
    if (!effectiveUserId) return; // Wait for user or offline mode

    let unsubscribe: () => void;

    if (useFirebase && !isOfflineMode) {
      unsubscribe = subscribeToTasks(
        effectiveUserId, // Pass userId
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
      // Offline fallback: Use local storage
      const storageKey = isOfflineMode ? 'offlineTasks' : 'localTasks';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {
          console.error("Lỗi đọc LocalStorage", e);
        }
      } else {
        setTasks([]); // Reset if no data
      }
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [useFirebase, showToast, effectiveUserId, isOfflineMode]);

  // Load Tags Effect (Updated to use effectiveUserId)
  useEffect(() => {
    if (!effectiveUserId) return;

    let unsubscribeTags: () => void;
    if (useFirebase && !isOfflineMode) {
      unsubscribeTags = subscribeToTags(
        effectiveUserId,
        (fetchedTags) => {
          setTags(fetchedTags);
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

  const handleSaveTags = useCallback(async (newTags: Tag[]) => {
    setTags(newTags); // Optimistic UI update
    
    if (useFirebase && user && !isOfflineMode) {
      try {
        await saveTagsToFirestore(user.uid, newTags);
        showToast("Đã lưu danh sách thẻ", "success");
      } catch (e) {
        console.error("Lỗi lưu tags lên Firebase", e);
        showToast("Lỗi lưu thẻ lên Cloud", "error");
      }
    } else {
      showToast("Đã lưu thẻ (Offline)", "success");
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

  // --- Input State ---
  const [quickInput, setQuickInput] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  const handleAddTask = async (newTask: Task, syncTelegram: boolean = true) => {
    const tempId = Date.now().toString();
    const taskWithTempId = { ...newTask, id: tempId };
    setTasks(prev => [...prev, taskWithTempId]);

    if (useFirebase && user && !isOfflineMode) {
      try {
        await addTaskToFirestore({
          userId: user.uid, // Attach userId
          title: newTask.title,
          date: newTask.date,
          time: newTask.time,
          description: newTask.description,
          completed: newTask.completed,
          reminderSent: false,
          recurringType: newTask.recurringType || 'none',
          tag: newTask.tag || 'Khác',
          subtasks: newTask.subtasks || [],
          isRecurring: false
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

  // Mở modal tạo công việc mới (Reset form)
  const handleCreateNewTask = () => {
    const now = new Date();
    // Sử dụng currentDate nếu người dùng đang ở ngày khác, hoặc ngày hiện tại
    const targetDate = format(currentDate, 'yyyy-MM-dd');
    
    const newTask: Task = {
      id: "temp",
      userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
      title: "",
      date: targetDate,
      time: format(now, "HH:mm"),
      description: "",
      completed: false,
      reminderSent: false,
      recurringType: 'none',
      tag: 'Khác',
      subtasks: []
    };
    setEditingTask(newTask);
    setIsEditModalOpen(true);
  };

  // Handler khi click vào ngày trong CalendarView
  const handleDaySelect = (date: Date) => {
    setCurrentDate(date);
    setViewMode(ViewMode.DAY);
  };

  // --- Navigation & View Logic ---
  const handlePrev = useCallback(() => {
    if (viewMode === ViewMode.DAY) {
      setCurrentDate(prev => addDays(prev, -1));
    } else if (viewMode === ViewMode.WEEK) {
      setCurrentDate(prev => addWeeks(prev, -1));
    } else {
      setCurrentDate(prev => addMonths(prev, -1));
    }
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === ViewMode.DAY) {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (viewMode === ViewMode.WEEK) {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  }, [viewMode]);

  const getHeaderText = useMemo(() => {
    if (viewMode === ViewMode.DAY) {
      return format(currentDate, 'dd/MM/yyyy');
    }
    if (viewMode === ViewMode.WEEK) {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `Tuần ${getWeek(currentDate, { weekStartsOn: 1 })} (${format(start, 'dd/MM')} - ${format(end, 'dd/MM')})`;
    }
    return `Tháng ${format(currentDate, 'MM/yyyy')}`;
  }, [viewMode, currentDate]);

  const renderContent = useCallback(() => {
    if (viewMode === ViewMode.STATS) {
      return <StatsView currentDate={currentDate} tasks={filteredTasks} tags={tags} />;
    }
    
    if (viewMode === ViewMode.LIST) {
      const sortedTasks = [...filteredTasks].sort((a,b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });

      return (
        <div className="h-full overflow-y-auto p-2 sm:p-4 bg-white dark:bg-gray-900 pb-32 lg:pb-0 custom-scrollbar">
          <h3 className="font-bold mb-3 text-orange-800 dark:text-orange-400 flex items-center gap-2 sticky top-0 bg-white dark:bg-gray-900 py-2 z-10 border-b border-gray-100 dark:border-gray-800">
             <ListChecks size={20}/> Danh sách công việc
          </h3>
          <div className="space-y-3">
            {sortedTasks.length === 0 && (
              <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                <Sparkles size={40} className="mb-2 opacity-50"/>
                <p>Không có công việc nào trong danh sách.</p>
              </div>
            )}
            {sortedTasks.map(task => {
              const tagConfig = tags.find(t => t.name === task.tag) || tags.find(t => t.name === 'Khác');
              return (
                <div 
                  key={task.id} 
                  onClick={() => openEditModal(task)}
                  className={`p-3 rounded-lg border-l-4 shadow-sm bg-white dark:bg-gray-800 flex items-start gap-3 cursor-pointer hover:shadow-md transition group
                    ${task.completed 
                      ? 'border-gray-300 dark:border-gray-600 opacity-60' 
                      : (tagConfig?.color.split(' ')[1] || 'border-orange-400')}
                  `}
                >
                  <button onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }} className={`mt-1 flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-300 group-hover:text-green-500'}`}>
                    {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`font-semibold text-sm sm:text-base truncate ${task.completed ? 'line-through text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{task.title}</h4>
                      <span className="text-[10px] sm:text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                        {task.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1 font-mono"><Clock size={12}/> {task.time}</span>
                      {task.tag && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${tagConfig?.dot}`}></span> {task.tag}
                        </span>
                      )}
                      {task.recurringType !== 'none' && <Repeat size={12} className="text-blue-500"/>}
                    </div>
                    {task.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{task.description}</p>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                </div>
              )
            })}
          </div>
        </div>
      );
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
  }, [viewMode, currentDate, filteredTasks, tags, openEditModal, handleToggleComplete, handleDeleteTask, handleMoveTask]);

  const handleQuickAdd = async () => {
    if (!quickInput.trim()) return;

    const simpleRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(.+),\s*(\d{1,2}:\d{2})$/;
    const match = quickInput.match(simpleRegex);

    if (match) {
      const [_, d, m, y, title, time] = match;
      const fullYear = y.length === 2 ? `20${y}` : y;
      const date = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      
      const newTask: Task = {
        id: "temp",
        userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
        title: title.trim(),
        date,
        time,
        description: "Tạo nhanh từ input",
        completed: false,
        reminderSent: false,
        recurringType: 'none',
        tag: 'Khác',
        subtasks: []
      };
      await handleAddTask(newTask);
      setQuickInput("");
    } else {
      try {
        setIsProcessingAI(true);
        const availableTags = tags.map(t => t.name);
        const result = await parseTaskWithGemini(quickInput, availableTags);
        if (result) {
          const newTask: Task = {
            id: "temp",
            userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
            title: result.title,
            date: result.date,
            time: result.time,
            description: result.description || "Tạo tự động bởi AI",
            completed: false,
            reminderSent: false,
            recurringType: (result.recurringType as RecurringType) || 'none',
            tag: result.tag || 'Khác',
            subtasks: []
          };
          await handleAddTask(newTask);
          setQuickInput("");
        } else {
          showToast("AI không hiểu được yêu cầu. Vui lòng nhập rõ ràng hơn.", "warning");
        }
      } catch (e) {
        showToast("Lỗi khi xử lý AI. Kiểm tra cấu hình API Key.", "error");
      } finally {
        setIsProcessingAI(false);
      }
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    } else {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.", "error");
        return;
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'vi-VN';
      // Sử dụng continuous = true và interimResults = true để kiểm soát việc dừng
      recognitionRef.current.continuous = true; 
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current.onresult = (event: any) => {
        // Reset timer mỗi khi có kết quả (kể cả interim)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        
        // Thiết lập timer mới: Nếu 1.5s không nói gì thêm, tự động dừng
        silenceTimerRef.current = setTimeout(() => {
          if (recognitionRef.current) recognitionRef.current.stop();
        }, 1500);

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }

        if (finalTranscript) {
          setQuickInput(prev => (prev ? prev + "" : "") + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
            setIsListening(false);
        }
      };

      recognitionRef.current.start();
    }
  };

  const executeTelegramSync = async (isManual: boolean = false) => {
    if (!telegramConfig.botToken || (!user && !isOfflineMode)) return;
    if (isManual) setIsProcessingAI(true);
    
    try {
      // Gửi lastTelegramUpdateId + 1 làm offset để chỉ nhận tin nhắn mới
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
              description: `Đồng bộ từ Telegram: "${msg}"`,
              completed: false,
              reminderSent: false,
              recurringType: (result.recurringType as RecurringType) || 'none',
              tag: result.tag || 'Khác',
              subtasks: []
            }, false);
            count++;
          }
        }
      }

      setLastTelegramUpdateId(maxId);
      setLastSyncTime(format(new Date(), 'HH:mm'));

      if (isManual) {
        if (count > 0) showToast(`Đã đồng bộ ${count} công việc mới!`, "success");
        else showToast("Không có tin nhắn mới nào.", "info");
      }
    } catch (e) {
      if (isManual) showToast("Lỗi khi đồng bộ Telegram.", "error");
    } finally {
      if (isManual) setIsProcessingAI(false);
    }
  };

  const handleSyncFromTelegram = () => executeTelegramSync(true);

  useEffect(() => {
    if (!telegramConfig.botToken) return;
    const intervalId = setInterval(() => {
      executeTelegramSync(false);
    }, 60 * 1000); // 1 minute auto-sync
    return () => clearInterval(intervalId);
  }, [telegramConfig, tasks, lastTelegramUpdateId, user, isOfflineMode]);

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
    // Updated h-screen to supports-[height:100dvh]:h-[100dvh] for mobile browsers
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] text-gray-800 dark:text-gray-100 bg-[#fff7ed] dark:bg-gray-950 overflow-hidden transition-colors duration-300">
      {/* Toast Container */}
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Offline Banner or User Info */}
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

      {/* Modern Glass Header */}
      <div className="bg-gradient-to-r from-orange-500/95 to-red-600/95 backdrop-blur-md text-white p-3 shadow-md z-30 flex-shrink-0 sticky top-0">
        <div className="flex justify-between items-center px-1 lg:px-4">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm shadow-inner">
              <Flame size={20} className="text-yellow-200" fill="currentColor" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">SmartCal <span className="hidden sm:inline-block text-xs font-light opacity-80 bg-white/10 px-1 rounded">PRO</span></h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
             <button onClick={handlePrev} className="hover:bg-white/20 p-1.5 rounded-full transition active:scale-90"><ChevronLeft size={20} /></button>
             
             {/* Date Picker Trigger */}
             <div className="relative" ref={datePickerRef}>
               <button 
                 onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                 className="min-w-[100px] sm:min-w-[140px] flex items-center justify-center gap-1 text-sm sm:text-base font-bold bg-white/10 px-2 py-1 rounded-md border border-white/20 shadow-sm backdrop-blur-sm hover:bg-white/20 transition active:scale-95 cursor-pointer"
               >
                 {getHeaderText} <ChevronDown size={14} className="opacity-70" />
               </button>
               
               {isDatePickerOpen && (
                 <DatePickerPopover 
                   currentDate={currentDate}
                   onDateSelect={(date) => {
                     setCurrentDate(date);
                     setIsDatePickerOpen(false);
                   }}
                   onClose={() => setIsDatePickerOpen(false)}
                 />
               )}
             </div>

             <button onClick={handleNext} className="hover:bg-white/20 p-1.5 rounded-full transition active:scale-90"><ChevronRight size={20} /></button>
          </div>

          <div className="flex gap-2 sm:gap-3 items-center">
             {/* User Info / Logout (Desktop) */}
             <div className="hidden lg:flex items-center gap-2 mr-2 border-r border-white/20 pr-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-white/50" />
                ) : (
                  <User size={20} />
                )}
                <span className="text-xs font-medium max-w-[80px] truncate">
                  {user?.displayName || (isOfflineMode ? 'Offline' : 'User')}
                </span>
             </div>

            {/* Dark Mode Toggle */}
             <button 
                onClick={toggleTheme} 
                className="hover:bg-white/20 p-2 rounded-full transition text-xs font-semibold backdrop-blur-sm active:scale-95"
                title="Chuyển chế độ Sáng/Tối"
             >
               {isDarkMode ? <Sun size={20} className="text-yellow-300" /> : <Moon size={20} className="text-white" />}
             </button>

             {/* Settings Button */}
            <button onClick={() => setIsSettingsOpen(true)} className="hidden lg:flex items-center gap-1 hover:bg-white/20 px-2 py-1.5 rounded-md transition text-xs font-semibold backdrop-blur-sm active:scale-95">
              <Settings size={20} /> <span className="hidden sm:inline">Cài đặt</span>
            </button>
            
            {/* Logout Button (or Exit Offline) */}
            <button 
              onClick={() => {
                if (isOfflineMode) {
                  window.location.reload();
                } else {
                  logOut();
                }
              }} 
              className="hover:bg-white/20 p-2 rounded-full transition text-xs font-semibold backdrop-blur-sm active:scale-95" 
              title={isOfflineMode ? "Thoát chế độ Offline" : "Đăng xuất"}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

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
                  onClick={() => setViewMode(ViewMode.STATS)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.STATS ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-orange-900/60 dark:text-gray-200 hover:text-orange-900 dark:hover:text-white'}`}
                >
                   <PieChart size={14} /> Thống kê
                </button>
             </div>
             
             {/* Filter by Tag Section */}
             {viewMode !== ViewMode.STATS && visibleTags.length > 0 && (
               <div className="flex gap-2 items-center flex-wrap justify-end">
                  {/* Removed "All" button per request */}
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

          <div className="flex-1 overflow-hidden relative">
            {renderContent()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:flex w-[320px] bg-white dark:bg-gray-900 border-l border-orange-200 dark:border-gray-800 shadow-xl z-20 flex-col order-2 h-full">
           {/* Quick Add */}
           <div className="p-4 bg-orange-50 dark:bg-gray-800 border-b border-orange-200 dark:border-gray-700 flex-shrink-0">
              <h2 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-orange-500" /> Thêm nhanh (AI)
              </h2>
              <div className="relative">
                <textarea
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="VD: Họp lúc 9h sáng mai... (Bấm mic để nói)"
                  style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                  className="w-full border border-orange-200 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none min-h-[80px] resize-none shadow-inner bg-white dark:bg-gray-700 dark:text-white"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(); } }}
                />
                <button onClick={toggleVoiceInput} className={`absolute bottom-2 left-2 p-1.5 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:text-orange-600 border dark:border-gray-500'}`}>
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button onClick={handleQuickAdd} disabled={isProcessingAI || !quickInput.trim()} className={`absolute bottom-2 right-2 p-1.5 rounded-md transition-all shadow-sm ${isProcessingAI ? 'bg-gray-200 dark:bg-gray-600' : 'bg-orange-600 text-white'}`}>
                  {isProcessingAI ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                </button>
              </div>
           </div>

           {/* Button Bar */}
           <div className="p-4 border-b border-orange-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
             <button 
               onClick={handleGenerateReport}
               disabled={isReportLoading}
               className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 rounded-lg hover:shadow-lg transition font-medium text-sm active:scale-95"
             >
               {isReportLoading ? <RefreshCw size={14} className="animate-spin" /> : <BarChart3 size={14} />} 
               Phân tích & Báo cáo
             </button>
           </div>

           {/* Scrollable Content */}
           <div className="flex-1 p-4 overflow-y-auto space-y-6">
              {aiReport && (
                 <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 text-gray-700 dark:text-gray-300 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <div className="font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1 border-b border-indigo-200 dark:border-indigo-800 pb-1 text-sm">
                      <Bot size={14}/> Báo cáo AI:
                    </div>
                    <div 
                      className="text-xs leading-relaxed space-y-2 [&>h4]:font-bold [&>h4]:text-indigo-700 dark:[&>h4]:text-indigo-400 [&>h4]:mt-2 [&>h4]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-1" 
                      dangerouslySetInnerHTML={{ __html: aiReport }} 
                    />
                 </div>
               )}
           </div>
           
           <div className="p-2 border-t border-orange-100 dark:border-gray-800 text-[10px] text-center text-gray-400 bg-orange-50 dark:bg-gray-800 flex-shrink-0">
             v2.4.2 • SmartCal Pro • AI Powered
           </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-orange-100 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-safe h-[64px]">
          <div className="grid grid-cols-5 h-full items-center max-w-md mx-auto">
            {/* 1. Dashboard */}
            <button onClick={() => setViewMode(ViewMode.LIST)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.LIST ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <Layout size={22} strokeWidth={viewMode === ViewMode.LIST ? 2.5 : 2} />
              <span className="text-[9px] font-medium">Dashboard</span>
            </button>

            {/* 2. Calendar */}
            <button onClick={() => setViewMode(ViewMode.MONTH)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.MONTH ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <LayoutGrid size={22} strokeWidth={viewMode === ViewMode.MONTH ? 2.5 : 2} />
              <span className="text-[9px] font-medium">Lịch</span>
            </button>
            
            {/* 3. Center FAB (Floating Action Button) */}
            <div className="relative flex justify-center items-center h-full pointer-events-none">
              <button 
                 onClick={handleCreateNewTask}
                 className="pointer-events-auto absolute -top-6 bg-gradient-to-tr from-orange-500 to-red-600 text-white p-3.5 rounded-full shadow-xl shadow-orange-500/30 border-4 border-[#fff7ed] dark:border-gray-950 active:scale-90 transition-all hover:scale-105"
              >
                 <Plus size={28} />
              </button>
            </div>

            {/* 4. Stats */}
            <button onClick={() => setViewMode(ViewMode.STATS)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.STATS ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <PieChart size={22} strokeWidth={viewMode === ViewMode.STATS ? 2.5 : 2} />
              <span className="text-[9px] font-medium">Thống kê</span>
            </button>

            {/* 5. Settings */}
            <button onClick={() => setIsSettingsOpen(true)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}>
              <Settings size={22} />
              <span className="text-[9px] font-medium">Cài đặt</span>
            </button>
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        telegramConfig={telegramConfig}
        tags={tags}
        onSaveConfig={setTelegramConfig}
        onSaveTags={handleSaveTags}
        onManualSync={handleSyncFromTelegram}
        isSyncing={isProcessingAI}
        lastSyncTime={lastSyncTime}
        showToast={showToast}
      />
      <EditTaskModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        task={editingTask} 
        tags={tags}
        onSave={handleUpdateTask} 
        showToast={showToast}
      />
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={executeDeleteTask} title="Xác nhận xóa" message="Bạn có chắc chắn muốn xóa công việc này không?" />
    </div>
  );
};

export default App;
