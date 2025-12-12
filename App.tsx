
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
  isValid,
  startOfDay
} from 'date-fns';
import { 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  RefreshCw, 
  Sparkles, 
  Bot, 
  CalendarPlus, 
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
  LayoutGrid, 
  Columns, 
  Square, 
  Trash2, 
  Calendar, 
  Layout, 
  X, 
  Plus,
  Moon,
  Sun,
  LogOut,
  User,
  PenLine,
  History,
  Timer,
  Search
} from 'lucide-react';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import SettingsModal from './components/SettingsModal';
import EditTaskModal from './components/EditTaskModal';
import ConfirmModal from './components/ConfirmModal';
import DatePickerPopover from './components/DatePickerPopover';
import LoginScreen from './components/LoginScreen';
import AiAssistant from './components/AiAssistant';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import { Task, TelegramConfig, ViewMode, RecurringType, Tag, DEFAULT_TASK_TAGS, Subtask } from './types';
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

  // Dashboard Mobile Tab State
  const [mobileListTab, setMobileListTab] = useState<'past' | 'today' | 'upcoming'>('today');

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

  // Sidebar Tabs State
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'manual'>('manual');
  
  // Manual Input State - Extended
  const [manualForm, setManualForm] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    duration: '',
    tag: 'Khác',
    recurringType: 'none' as RecurringType,
    description: '',
    checklistText: '' // New: For parsing simple checklist
  });

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

  // Auto focus search
  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  // --- Filter Logic ---
  
  // Tính toán danh sách các thẻ ĐANG ĐƯỢC SỬ DỤNG
  const visibleTags = useMemo(() => {
    const usedTagNames = new Set(tasks.map(t => t.tag || 'Khác'));
    // Lọc danh sách tags gốc, chỉ giữ lại những tag có trong usedTagNames
    return tags.filter(t => usedTagNames.has(t.name));
  }, [tasks, tags]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by Tag
    if (selectedTagFilter) {
      result = result.filter(t => (t.tag || 'Khác') === selectedTagFilter);
    }

    // Filter by Search Query
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
          // Chỉ setTags khi có dữ liệu trả về từ Firebase
          // Nếu fetchedTags rỗng (do user mới), subscribeToTags đã handle trả về Default
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

  const handleSaveTags = useCallback(async (newTags: Tag[]) => {
    setTags(newTags); // Optimistic UI update
    
    if (useFirebase && user && !isOfflineMode) {
      try {
        // user.uid is guaranteed by check above
        await saveTagsToFirestore(user.uid, newTags);
        showToast("Đã lưu danh sách thẻ vào Cloud", "success");
      } catch (e) {
        console.error("Lỗi lưu tags lên Firebase", e);
        showToast("Lỗi lưu thẻ lên Cloud", "error");
      }
    } else {
      // Offline mode save
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
          duration: newTask.duration || "",
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

  // --- Wrapper xử lý Save từ Modal (Fix lỗi không thêm mới được từ Mobile) ---
  const handleSaveTaskFromModal = async (taskToSave: Task) => {
    if (taskToSave.id === 'temp') {
       // Nếu là task mới (ID là temp), gọi hàm thêm mới
       await handleAddTask(taskToSave);
    } else {
       // Nếu là task cũ, gọi hàm cập nhật
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

  // Mở modal tạo công việc mới (Reset form)
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

  // --- Manual Add Logic ---
  const handleManualSubmit = async () => {
    if (!manualForm.title.trim()) {
      showToast("Vui lòng nhập tiêu đề công việc", "warning");
      return;
    }
    if (!manualForm.date) {
      showToast("Vui lòng chọn ngày", "warning");
      return;
    }

    // Process Checklist
    let subtasks: Subtask[] = [];
    if (manualForm.checklistText.trim()) {
        subtasks = manualForm.checklistText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => ({
                id: Date.now().toString() + Math.random().toString(),
                title: line,
                completed: false
            }));
    }

    const newTask: Task = {
      id: "temp",
      userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
      title: manualForm.title.trim(),
      date: manualForm.date,
      endDate: manualForm.endDate || manualForm.date,
      time: manualForm.time || "08:00",
      duration: manualForm.duration.trim(),
      description: manualForm.description.trim() || "Tạo thủ công",
      completed: false,
      reminderSent: false,
      recurringType: manualForm.recurringType,
      tag: manualForm.tag,
      subtasks: subtasks
    };

    await handleAddTask(newTask);
    
    // Reset form mostly, but maybe keep date/tag context for rapid entry?
    setManualForm({ 
        ...manualForm, 
        title: '', 
        description: '', 
        checklistText: '',
        duration: ''
    }); 
    showToast("Đã tạo công việc!", "success");
  };

  // --- Quick Add Logic with Manual Parser Fallback ---
  
  // Hàm phân tích thủ công (Rule-based)
  const parseManualInput = (input: string): { title: string; date: string; time: string } => {
    let text = input;
    const now = new Date();
    let targetDate = now;
    let targetTime = format(now, "HH:mm");

    // 1. Phân tích giờ (HH:mm hoặc HHhMM hoặc HH giờ)
    // Regex: tìm số giờ (1-2 chữ số) theo sau là :, h, giờ và số phút tùy chọn
    const timeRegex = /(?:lúc\s+)?(\d{1,2})[:h](\d{2})?(?:\s*(?:sáng|chiều|tối))?/i;
    const timeMatch = text.match(timeRegex);

    if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const period = (timeMatch[0].toLowerCase().match(/chiều|tối/) && hours < 12) ? 'pm' : 'am';
        
        if (period === 'pm') hours += 12;
        // Chuẩn hóa giờ phút
        if (hours >= 24) hours = 23;
        if (minutes >= 60) minutes = 59;
        
        targetTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        // Xóa phần thời gian khỏi text
        text = text.replace(timeMatch[0], "").trim();
    } else {
        // Nếu không có giờ cụ thể, mặc định là 08:00 nếu là ngày khác, hoặc giữ nguyên giờ hiện tại
        targetTime = "08:00";
    }

    // 2. Phân tích ngày
    // Keywords
    const lowerText = text.toLowerCase();
    let dateFound = false;

    if (lowerText.includes("hôm nay") || lowerText.includes("nay")) {
        targetDate = now;
        text = text.replace(/hôm nay|nay/gi, "").trim();
        dateFound = true;
    } else if (lowerText.includes("ngày mai") || lowerText.includes("mai")) {
        targetDate = addDays(now, 1);
        text = text.replace(/ngày mai|mai/gi, "").trim();
        dateFound = true;
    } else if (lowerText.includes("ngày kia") || lowerText.includes("mốt")) {
        targetDate = addDays(now, 2);
        text = text.replace(/ngày kia|mốt/gi, "").trim();
        dateFound = true;
    }

    // Regex Date dd/MM(/yyyy)
    if (!dateFound) {
        const dateRegex = /(?:ngày\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/;
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1; // 0-based
            let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
            
            // Nếu năm chỉ có 2 chữ số (vd: 24 -> 2024)
            if (year < 100) year += 2000;

            const parsedDate = new Date(year, month, day);
            if (isValid(parsedDate)) {
                targetDate = parsedDate;
                text = text.replace(dateMatch[0], "").trim();
            }
        }
    }

    // Xóa các từ nối dư thừa
    text = text.replace(/\s+(vào|lúc)\s*$/i, "").replace(/^\s*(vào|lúc)\s+/i, "").trim();
    
    // Nếu tiêu đề trống sau khi cắt, dùng input gốc (trừ khi input gốc cũng chỉ là ngày giờ)
    if (!text) text = "Công việc mới";

    return {
        title: text,
        date: format(targetDate, 'yyyy-MM-dd'),
        time: targetTime
    };
  };

  const handleQuickAdd = async () => {
    if (!quickInput.trim()) return;
    setIsProcessingAI(true);

    try {
        const apiKey = localStorage.getItem('gemini_api_key');
        let taskData: { title: string; date: string; time: string; duration?: string; description?: string; tag?: string } | null = null;
        let method = 'manual';

        // 1. Ưu tiên dùng AI nếu có Key
        if (apiKey) {
            try {
                const availableTags = tags.map(t => t.name);
                const aiResult = await parseTaskWithGemini(quickInput, availableTags);
                if (aiResult) {
                    taskData = aiResult;
                    method = 'ai';
                }
            } catch (error) {
                console.warn("AI failed, falling back to manual parser", error);
                // AI lỗi thì fall back xuống manual
            }
        }

        // 2. Nếu không có AI hoặc AI lỗi, dùng Manual Parser
        if (!taskData) {
            const manualResult = parseManualInput(quickInput);
            taskData = {
                ...manualResult,
                description: "Tạo nhanh (Không dùng AI)",
                tag: 'Khác' // Manual không tự phân loại được
            };
            method = 'manual';
        }

        if (taskData) {
             const newTask: Task = {
                id: "temp",
                userId: user?.uid || (isOfflineMode ? 'offline_user' : undefined),
                title: taskData.title,
                date: taskData.date,
                time: taskData.time,
                duration: taskData.duration || "",
                description: taskData.description || (method === 'ai' ? "Tạo tự động bởi AI" : "Tạo nhanh"),
                completed: false,
                reminderSent: false,
                recurringType: (taskData as any).recurringType || 'none', // AI có thể trả về recurring
                tag: taskData.tag || 'Khác',
                subtasks: []
              };
              await handleAddTask(newTask);
              setQuickInput("");
              
              if (method === 'manual' && apiKey) {
                  showToast("Đã tạo việc (AI gặp lỗi nên dùng chế độ thường)", "info");
              } else if (method === 'manual') {
                  showToast("Đã tạo việc (Chế độ không AI)", "success");
              }
        }

    } catch (e) {
        showToast("Lỗi không xác định khi tạo công việc.", "error");
    } finally {
        setIsProcessingAI(false);
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
              duration: result.duration || "",
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
        // Categorize Tasks for 3-Column View
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        // 1. Past / Overdue (Ends before Today)
        const pastTasks = filteredTasks
            .filter(t => {
                const end = t.endDate || t.date;
                return end < todayStr;
            })
            .sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
            });

        // 2. Today (Active Today: Start <= Today <= End)
        const todayTasks = filteredTasks
            .filter(t => {
                const start = t.date;
                const end = t.endDate || t.date;
                return start <= todayStr && end >= todayStr;
            })
            .sort((a, b) => a.time.localeCompare(b.time));

        // 3. Upcoming (Starts after Today)
        const upcomingTasks = filteredTasks
            .filter(t => t.date > todayStr)
            .sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
            });

        const renderTaskCard = (task: Task) => {
            const tagConfig = tags.find(t => t.name === task.tag) || tags.find(t => t.name === 'Khác');
            
            // Check multi-day for label
            const isMultiDay = task.endDate && task.endDate !== task.date;
            
            return (
                <div key={task.id} className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all group ${task.completed ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}>
                    <button onClick={() => handleToggleComplete(task)} className={`flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-gray-600 hover:text-green-500'}`}>
                    {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditModal(task)}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{task.time}</span>
                        {task.duration && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center gap-0.5 border border-blue-100 dark:border-blue-800">
                             <Timer size={10} /> {task.duration}
                          </span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${task.completed ? 'bg-gray-100 text-gray-500' : (tagConfig?.color || 'bg-gray-100 text-gray-700')}`}>
                            {task.date}
                            {isMultiDay && <span className="ml-1 opacity-70">→ {task.endDate}</span>}
                        </span>
                        {task.recurringType !== 'none' && <Repeat size={12} className="text-blue-500" />}
                        <span className={`w-2 h-2 rounded-full ${tagConfig?.dot}`}></span>
                    </div>
                    {/* Updated: No line-through, just opacity applied to parent */}
                    <h3 className={`font-semibold text-sm truncate text-gray-800 dark:text-gray-200`}>{task.title}</h3>
                    {task.description && <p className="text-xs text-gray-500 truncate">{task.description}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(task)} className="p-2 text-gray-400 hover:text-orange-500"><Edit3 size={16}/></button>
                    <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                </div>
            );
        };

        return (
            <div className="flex flex-col h-full overflow-hidden pb-32 lg:pb-0">
               {/* Mobile Tabs */}
               <div className="lg:hidden flex gap-1 mb-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-orange-100 dark:border-gray-700 shadow-sm mx-1 mt-1 shrink-0">
                  <button 
                    onClick={() => setMobileListTab('past')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                      mobileListTab === 'past' 
                        ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-sm ring-1 ring-stone-200 dark:ring-stone-700' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <History size={12}/> Việc cũ
                  </button>
                  <button 
                    onClick={() => setMobileListTab('today')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                      mobileListTab === 'today' 
                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 shadow-sm ring-1 ring-orange-200 dark:ring-orange-800' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Flame size={12}/> Hôm nay
                  </button>
                  <button 
                    onClick={() => setMobileListTab('upcoming')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                      mobileListTab === 'upcoming' 
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Calendar size={12}/> Sắp tới
                  </button>
               </div>

               {/* 3 Column Grid - Optimized for Mobile (No container styles on mobile) */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full overflow-y-auto lg:overflow-hidden p-1 custom-scrollbar">
                  
                  {/* Column 1: Past / Overdue */}
                  <div className={`${mobileListTab === 'past' ? 'flex' : 'hidden'} lg:flex flex-col h-full lg:bg-stone-50 lg:dark:bg-stone-900/10 lg:rounded-xl lg:border lg:border-stone-100 lg:dark:border-stone-800 overflow-hidden lg:mb-0`}>
                      {/* Header hidden on mobile */}
                      <div className="hidden lg:flex p-3 border-b border-stone-100 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-900/30 justify-between items-center sticky top-0 z-10">
                          <h3 className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <History size={16} /> Việc cũ / Quá hạn
                          </h3>
                          <span className="bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold px-2 py-0.5 rounded-full">
                              {pastTasks.length}
                          </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1 lg:p-2 space-y-2 custom-scrollbar min-h-[100px]">
                          {pastTasks.length > 0 ? pastTasks.map(renderTaskCard) : (
                              <div className="flex flex-col items-center justify-center h-40 text-stone-300 dark:text-stone-800/50">
                                  <History size={40} className="mb-2 opacity-50"/>
                                  <p className="text-xs font-medium">Không có việc cũ.</p>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Column 2: Today */}
                   <div className={`${mobileListTab === 'today' ? 'flex' : 'hidden'} lg:flex flex-col h-full lg:bg-orange-50 lg:dark:bg-orange-900/10 lg:rounded-xl lg:border lg:border-orange-100 lg:dark:border-orange-900/30 overflow-hidden lg:mb-0`}>
                      {/* Header hidden on mobile */}
                      <div className="hidden lg:flex p-3 border-b border-orange-100 dark:border-orange-900/30 bg-orange-100/50 dark:bg-orange-900/30 justify-between items-center sticky top-0 z-10">
                          <h3 className="font-bold text-orange-700 dark:text-orange-300 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <Flame size={16} /> Việc hôm nay
                          </h3>
                          <span className="bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 text-xs font-bold px-2 py-0.5 rounded-full">
                              {todayTasks.length}
                          </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1 lg:p-2 space-y-2 custom-scrollbar min-h-[100px]">
                          {todayTasks.length > 0 ? todayTasks.map(renderTaskCard) : (
                               <div className="flex flex-col items-center justify-center h-40 text-orange-300 dark:text-orange-800/50">
                                  <CheckCircle2 size={40} className="mb-2 opacity-50"/>
                                  <p className="text-xs font-medium">Hôm nay rảnh rỗi!</p>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Column 3: Upcoming */}
                   <div className={`${mobileListTab === 'upcoming' ? 'flex' : 'hidden'} lg:flex flex-col h-full lg:bg-blue-50 lg:dark:bg-blue-900/10 lg:rounded-xl lg:border lg:border-blue-100 lg:dark:border-blue-900/30 overflow-hidden lg:mb-0`}>
                      {/* Header hidden on mobile */}
                      <div className="hidden lg:flex p-3 border-b border-blue-100 dark:border-blue-900/30 bg-blue-100/50 dark:bg-blue-900/30 justify-between items-center sticky top-0 z-10">
                          <h3 className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <Calendar size={16} /> Việc sắp tới
                          </h3>
                          <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-0.5 rounded-full">
                              {upcomingTasks.length}
                          </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-1 lg:p-2 space-y-2 custom-scrollbar min-h-[100px]">
                          {upcomingTasks.length > 0 ? upcomingTasks.map(renderTaskCard) : (
                               <div className="flex flex-col items-center justify-center h-40 text-blue-300 dark:text-blue-800/50">
                                  <Calendar size={40} className="mb-2 opacity-50"/>
                                  <p className="text-xs font-medium">Chưa có kế hoạch xa.</p>
                              </div>
                          )}
                      </div>
                  </div>

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
            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm shadow-inner hidden sm:block">
              <Flame size={20} className="text-yellow-200" fill="currentColor" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">SmartCal <span className="hidden sm:inline-block text-xs font-light opacity-80 bg-white/10 px-1 rounded">PRO</span></h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
             <button onClick={handlePrev} className="hover:bg-white/20 p-1.5 rounded-full transition active:scale-90"><ChevronLeft size={20} /></button>
             
             {/* Date Picker & Search Trigger */}
             <div className="flex items-center gap-1">
               {/* Search Input */}
                <div className={`transition-all duration-300 overflow-hidden flex items-center ${isSearchActive ? 'w-32 sm:w-48 bg-white/20 rounded-md' : 'w-0'}`}>
                    <input 
                      ref={searchInputRef}
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => !searchQuery && setIsSearchActive(false)}
                      placeholder="Tìm kiếm..."
                      className="w-full bg-transparent border-none outline-none text-white text-xs px-2 py-1 placeholder-white/50"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="p-1 hover:text-red-200"><X size={12}/></button>
                    )}
                </div>

                {!isSearchActive && (
                    <button onClick={() => setIsSearchActive(true)} className="p-1.5 hover:bg-white/20 rounded-full transition active:scale-95">
                        <Search size={18} />
                    </button>
                )}

               <div className="relative" ref={datePickerRef}>
                  <button 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="min-w-[80px] sm:min-w-[140px] flex items-center justify-center gap-1 text-sm sm:text-base font-bold bg-white/10 px-2 py-1 rounded-md border border-white/20 shadow-sm backdrop-blur-sm hover:bg-white/20 transition active:scale-95 cursor-pointer"
                  >
                    <span className="hidden sm:inline">{getHeaderText}</span>
                    <span className="sm:hidden">{format(currentDate, 'dd/MM')}</span>
                     <ChevronDown size={14} className="opacity-70" />
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
          
          {/* Mobile Filter / Search Status */}
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

        {/* Sidebar */}
        <div className="hidden lg:flex w-[320px] bg-white dark:bg-gray-900 border-l border-orange-200 dark:border-gray-800 shadow-xl z-20 flex-col order-2 h-full">
           {/* Quick Add Area */}
           <div className="p-4 bg-orange-50 dark:bg-gray-800 border-b border-orange-200 dark:border-gray-700 flex-shrink-0">
              <h2 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-3">
                <CalendarPlus size={16} className="text-orange-500" /> Thêm công việc mới
              </h2>
              
              {/* Tabs Switcher */}
              <div className="flex gap-1 mb-3 bg-white dark:bg-gray-700 p-1 rounded-lg border border-orange-100 dark:border-gray-600 shadow-sm">
                  <button 
                    onClick={() => setSidebarTab('manual')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                      sidebarTab === 'manual' 
                        ? 'bg-orange-100 dark:bg-gray-600 text-orange-700 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <PenLine size={12}/> Thủ công
                  </button>
                  <button 
                    onClick={() => setSidebarTab('ai')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                      sidebarTab === 'ai' 
                        ? 'bg-orange-100 dark:bg-gray-600 text-orange-700 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Sparkles size={12}/> AI Nhập nhanh
                  </button>
              </div>

              {/* Tab Content */}
              {sidebarTab === 'ai' ? (
                /* AI Input Mode */
                <div className="relative animate-in fade-in zoom-in-95 duration-200">
                  <textarea
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    placeholder="VD: Họp 9h sáng mai... (Hỗ trợ giọng nói)"
                    style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                    className="w-full border border-orange-200 dark:border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none min-h-[120px] resize-none shadow-inner bg-white dark:bg-gray-700 dark:text-white"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(); } }}
                  />
                  <button onClick={toggleVoiceInput} className={`absolute bottom-2 left-2 p-1.5 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:text-orange-600 border dark:border-gray-500'}`}>
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                  <button onClick={handleQuickAdd} disabled={isProcessingAI || !quickInput.trim()} className={`absolute bottom-2 right-2 p-1.5 rounded-md transition-all shadow-sm ${isProcessingAI ? 'bg-gray-200 dark:bg-gray-600' : 'bg-orange-600 text-white'}`}>
                    {isProcessingAI ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                  </button>
                  <p className="text-[10px] text-gray-400 mt-2 italic text-center">
                    * AI tự động nhận diện ngày giờ từ văn bản.
                  </p>
                </div>
              ) : (
                /* Manual Input Mode - Extended */
                <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-1">
                   <div>
                     <input 
                        type="text"
                        value={manualForm.title}
                        onChange={(e) => setManualForm({...manualForm, title: e.target.value})}
                        placeholder="Tiêu đề công việc"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                     />
                   </div>
                   
                   {/* Date & Time Row */}
                   <div className="grid grid-cols-2 gap-2">
                       <div>
                           <label className="text-[10px] font-bold text-gray-500 uppercase">Ngày bắt đầu</label>
                           <input 
                             type="date"
                             value={manualForm.date}
                             onChange={(e) => setManualForm({...manualForm, date: e.target.value})}
                             className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                           />
                       </div>
                        <div>
                           <label className="text-[10px] font-bold text-gray-500 uppercase">Ngày kết thúc</label>
                           <input 
                             type="date"
                             min={manualForm.date}
                             value={manualForm.endDate}
                             onChange={(e) => setManualForm({...manualForm, endDate: e.target.value})}
                             className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                           />
                       </div>
                   </div>

                   {/* Time & Tag */}
                   <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Giờ</label>
                        <input 
                          type="time"
                          value={manualForm.time}
                          onChange={(e) => setManualForm({...manualForm, time: e.target.value})}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Phân loại</label>
                        <select
                            value={manualForm.tag}
                            onChange={(e) => setManualForm({ ...manualForm, tag: e.target.value })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                        >
                            {tags.map(t => (
                                <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                      </div>
                   </div>

                   {/* Recurring */}
                   <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Lặp lại</label>
                        <select
                            value={manualForm.recurringType}
                            onChange={(e) => setManualForm({ ...manualForm, recurringType: e.target.value as RecurringType })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                        >
                            <option value="none">Không lặp lại</option>
                            <option value="daily">Hàng ngày</option>
                            <option value="weekly">Hàng tuần</option>
                            <option value="monthly">Hàng tháng</option>
                            <option value="yearly">Hàng năm</option>
                        </select>
                   </div>
                   
                   {/* Description */}
                   <div>
                       <textarea
                            rows={2}
                            value={manualForm.description}
                            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                            placeholder="Chi tiết / Ghi chú..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none resize-none bg-white dark:bg-gray-700 dark:text-white"
                        />
                   </div>

                    {/* Checklist (Simplified) */}
                   <div>
                       <textarea
                            rows={2}
                            value={manualForm.checklistText}
                            onChange={(e) => setManualForm({ ...manualForm, checklistText: e.target.value })}
                            placeholder="Checklist (mỗi dòng 1 việc)..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none resize-none bg-white dark:bg-gray-700 dark:text-white border-dashed"
                        />
                   </div>

                   <button 
                    onClick={handleManualSubmit}
                    className="w-full bg-orange-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-sm active:scale-95"
                   >
                     <Plus size={14} /> Tạo công việc
                   </button>
                </div>
              )}
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
             v2.5.0 • SmartCal Pro • AI Powered
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

      <AiAssistant tasks={tasks} />

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
        onSave={handleSaveTaskFromModal} 
        showToast={showToast}
      />
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={executeDeleteTask} title="Xác nhận xóa" message="Bạn có chắc chắn muốn xóa công việc này không?" />
    </div>
  );
};

export default App;
