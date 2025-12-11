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
  Plus 
} from 'lucide-react';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import SettingsModal from './components/SettingsModal';
import EditTaskModal from './components/EditTaskModal';
import ConfirmModal from './components/ConfirmModal';
import DatePickerPopover from './components/DatePickerPopover';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import { Task, TelegramConfig, ViewMode, RecurringType, Tag, DEFAULT_TASK_TAGS } from './types';
import { parseTaskWithGemini, generateReport } from './services/geminiService';
import { sendTelegramMessage, fetchTelegramUpdates, formatTaskForTelegram } from './services/telegramService';
import { subscribeToTasks, subscribeToTags, saveTagsToFirestore, addTaskToFirestore, deleteTaskFromFirestore, updateTaskInFirestore } from './services/firebase';

const App: React.FC = () => {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);
  
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

  // Load Tasks Effect (Hybrid Strategy)
  useEffect(() => {
    let unsubscribe: () => void;

    if (useFirebase) {
      unsubscribe = subscribeToTasks(
        (fetchedTasks) => {
          setTasks(fetchedTasks);
          setFirebaseError(null);
        },
        (error) => {
          const isPermissionError = error.message.includes('permission-denied') || error.code === 'permission-denied';
          const errorMsg = isPermissionError 
            ? "API Firestore chưa được bật hoặc Rules chặn truy cập." 
            : (error.message || "Lỗi kết nối Firebase");
            
          console.log("Chuyển sang chế độ Offline do lỗi:", errorMsg);
          // Only show error toast once when switching modes
          if (useFirebase) showToast(`Chuyển sang Offline: ${errorMsg}`, 'error');
          setFirebaseError(errorMsg);
          setUseFirebase(false);
        }
      );
    } else {
      const saved = localStorage.getItem('localTasks');
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {
          console.error("Lỗi đọc LocalStorage", e);
        }
      }
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [useFirebase, showToast]);

  // Load Tags Effect (Firebase)
  useEffect(() => {
    let unsubscribeTags: () => void;
    if (useFirebase) {
      unsubscribeTags = subscribeToTags(
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
  }, [useFirebase]);

  // Sync LocalStorage when offline
  useEffect(() => {
    if (!useFirebase) {
      try {
        localStorage.setItem('localTasks', JSON.stringify(tasks));
        localStorage.setItem('taskTags', JSON.stringify(tags));
      } catch (e) {
        console.error("Error saving to LocalStorage", e);
      }
    }
  }, [tasks, tags, useFirebase]);

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

    if (useFirebase) {
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
  }, [useFirebase, showToast]);

  const handleSaveTags = useCallback(async (newTags: Tag[]) => {
    setTags(newTags); // Optimistic UI update
    
    if (useFirebase) {
      try {
        await saveTagsToFirestore(newTags);
        showToast("Đã lưu danh sách thẻ", "success");
      } catch (e) {
        console.error("Lỗi lưu tags lên Firebase", e);
        showToast("Lỗi lưu thẻ lên Cloud", "error");
      }
    } else {
      showToast("Đã lưu thẻ (Offline)", "success");
    }
  }, [useFirebase, showToast]);

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

    if (useFirebase) {
      try {
        await addTaskToFirestore({
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

      if (useFirebase) {
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
  }, [taskToDeleteId, tasks, telegramConfig, useFirebase, showToast]);

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
    if (!telegramConfig.botToken) return;
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
  }, [telegramConfig, tasks, lastTelegramUpdateId]);

  // Navigation Handlers
  const handlePrev = useCallback(() => {
    if (viewMode === ViewMode.WEEK) setCurrentDate(prev => addWeeks(prev, -1));
    else if (viewMode === ViewMode.DAY) setCurrentDate(prev => addDays(prev, -1));
    else setCurrentDate(prev => addMonths(prev, -1));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === ViewMode.WEEK) setCurrentDate(prev => addWeeks(prev, 1));
    else if (viewMode === ViewMode.DAY) setCurrentDate(prev => addDays(prev, 1));
    else setCurrentDate(prev => addMonths(prev, 1));
  }, [viewMode]);

  // Header Text
  const getHeaderText = useMemo(() => {
    if (viewMode === ViewMode.WEEK) {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `Tuần ${getWeek(currentDate)} (${format(start, 'dd/MM')} - ${format(end, 'dd/MM')})`;
    }
    if (viewMode === ViewMode.DAY) {
      return format(currentDate, 'dd/MM/yyyy');
    }
    return `Tháng ${format(currentDate, 'MM/yyyy')}`;
  }, [viewMode, currentDate]);

  const GreetingSection = useMemo(() => {
    const hour = new Date().getHours();
    let greeting = "Chào buổi sáng";
    if (hour >= 12 && hour < 18) greeting = "Chào buổi chiều";
    else if (hour >= 18) greeting = "Buổi tối vui vẻ";

    const todayTasks = filteredTasks.filter(t => isToday(new Date(t.date)) && !t.completed).length;

    return (
      <div className="mb-4 px-1 lg:col-span-3">
        <h2 className="text-2xl font-bold text-gray-800">{greeting} 👋</h2>
        <p className="text-sm text-gray-500 mt-1">
          Hôm nay bạn có <span className="font-bold text-orange-600">{todayTasks}</span> công việc cần hoàn thành.
        </p>
      </div>
    );
  }, [filteredTasks]);

  const renderContent = () => {
    switch (viewMode) {
      case ViewMode.STATS:
        return <StatsView currentDate={currentDate} tasks={filteredTasks} tags={tags} />;
      case ViewMode.LIST:
        // Helper function to check if a task is active on a specific date
        // considering recurrence and multi-day duration
        const checkIsActiveOnDate = (task: Task, dateToCheck: Date) => {
           const tStart = startOfDay(new Date(task.date));
           const tEnd = task.endDate ? startOfDay(new Date(task.endDate)) : tStart;
           const check = startOfDay(dateToCheck);
           
           // 1. Recurring Logic (Simplification: Only checking Start Date patterns currently for List view)
           // In a full implementation, we'd need to generate instances. 
           // For now, if it's recurring, we only match the start pattern.
           const recType = task.recurringType || (task.isRecurring ? 'daily' : 'none');
           if (recType !== 'none') {
              if (check.getTime() < tStart.getTime()) return false;
              switch (recType) {
                 case 'daily': return true;
                 case 'weekly': return getDay(check) === getDay(tStart);
                 case 'monthly': return getDate(check) === getDate(tStart);
                 case 'yearly': return getDate(check) === getDate(tStart) && getMonth(check) === getMonth(tStart);
                 default: return false;
              }
           }
           
           // 2. Multi-day / Single-day Logic
           return isWithinInterval(check, { start: tStart, end: tEnd });
        };

        const today = new Date();
        const startOfToday = startOfDay(today);
        const startOfTomorrow = addDays(startOfToday, 1);

        const groups = {
          overdue: [] as Task[],
          today: [] as Task[],
          tomorrow: [] as Task[],
          upcoming: [] as Task[],
        };

        const sortedTasks = [...filteredTasks].sort((a, b) => {
           return compareAsc(new Date(`${a.date}T${a.time}`), new Date(`${b.date}T${b.time}`));
        });

        sortedTasks.forEach(task => {
          if (task.completed) return; 

          const tStart = startOfDay(new Date(task.date));
          const tEnd = task.endDate ? startOfDay(new Date(task.endDate)) : tStart;

          // Overdue: Only if End Date is strictly before Today
          if (isBefore(tEnd, startOfToday)) {
             groups.overdue.push(task);
             return; 
          }

          // Active Today?
          if (checkIsActiveOnDate(task, startOfToday)) {
             groups.today.push(task);
          }

          // Active Tomorrow?
          if (checkIsActiveOnDate(task, startOfTomorrow)) {
             groups.tomorrow.push(task);
          }

          // Upcoming: Starts STRICTLY after Tomorrow
          // (If it started today and spans to next week, it's already in Today/Tomorrow, 
          //  so we don't put it in Upcoming to reduce noise, unless user wants to see future start dates)
          if (isAfter(tStart, startOfTomorrow)) {
             groups.upcoming.push(task);
          }
        });
        
        const renderTaskCard = (task: Task) => {
           const tagConfig = tags.find(t => t.name === task.tag) || tags.find(t => t.name === 'Khác');
           const totalSub = task.subtasks?.length || 0;
           const doneSub = task.subtasks?.filter(s => s.completed).length || 0;
           const progress = totalSub > 0 ? (doneSub / totalSub) * 100 : 0;
           
           // Calculate dates for display
           const taskDate = new Date(task.date);
           const taskEndDate = task.endDate ? new Date(task.endDate) : taskDate;
           const dateDisplay = format(taskDate, 'dd/MM');
           const isTaskToday = isToday(taskDate);
           
           // Multi-day info
           const isMultiDay = !isToday(taskDate) || (task.endDate && !isToday(new Date(task.endDate)));
           let multiDayInfo = "";
           
           if (task.endDate && task.date !== task.endDate && (task.recurringType === 'none')) {
              const start = startOfDay(new Date(task.date));
              const end = startOfDay(new Date(task.endDate));
              const now = startOfDay(new Date());
              const totalDays = differenceInDays(end, start) + 1;
              
              // Calculate current day index relative to Today
              // If viewing in "Tomorrow" column, this logic is slightly off visually but acceptable.
              // Better to show "Day X/Y" based on real time.
              let currentDayIndex = differenceInDays(now, start) + 1;
              if (currentDayIndex < 1) currentDayIndex = 1; // Future start
              if (currentDayIndex > totalDays) currentDayIndex = totalDays; // Overdue

              multiDayInfo = `(Ngày ${currentDayIndex}/${totalDays})`;
           }

           return (
             <div 
                key={task.id} 
                onClick={() => openEditModal(task)}
                className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-orange-50 p-4 mb-3 relative overflow-hidden group active:scale-[0.98] transition-transform duration-200 cursor-pointer"
             >
                {/* Colored Left Border */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${tagConfig?.color ? tagConfig.dot.replace('text', 'bg') : 'bg-gray-400'}`}></div>
                
                <div className="pl-3 flex justify-between items-start">
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                         {/* Date Badge */}
                         <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isTaskToday ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'}`}>
                            <CalendarDays size={12}/> {dateDisplay}
                         </span>

                         <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock size={12}/> {task.time}
                         </span>
                         {task.recurringType && task.recurringType !== 'none' && (
                            <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1">
                               <Repeat size={12}/> {task.recurringType}
                            </span>
                         )}
                         <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tagConfig?.color} bg-opacity-10 border-opacity-20`}>
                            {task.tag || 'Khác'}
                         </span>
                      </div>
                      <h3 className={`font-bold text-gray-800 text-sm sm:text-base ${task.completed ? 'line-through text-gray-400' : ''}`}>
                        {task.title} {multiDayInfo && <span className="text-xs font-normal text-orange-600 ml-1">{multiDayInfo}</span>}
                      </h3>
                      {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>}
                      
                      {/* Subtask Progress Bar */}
                      {totalSub > 0 && (
                        <div className="mt-3">
                           <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium">
                              <span className="flex items-center gap-1"><ListChecks size={12}/> Tiến độ</span>
                              <span>{Math.round(progress)}%</span>
                           </div>
                           <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                           </div>
                        </div>
                      )}
                   </div>

                   <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }}
                        className={`p-2 rounded-full ${task.completed ? 'text-green-500 bg-green-50' : 'text-gray-300 hover:text-green-500 hover:bg-gray-50'}`}
                      >
                         {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full"
                      >
                         <Trash2 size={20} />
                      </button>
                   </div>
                </div>
             </div>
           );
        }

        const renderGroup = (title: string, groupTasks: Task[], icon: React.ReactNode, colorClass: string, isSticky: boolean = true) => {
          if (groupTasks.length === 0) return (
             <div className="hidden lg:block opacity-50 text-sm text-gray-400 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                Không có việc {title.toLowerCase()}
             </div>
          );
          return (
            <div className="mb-6 lg:mb-0 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full">
               <div className={`${isSticky ? 'sticky top-[-1px]' : ''} z-10 bg-[#fff7ed]/95 backdrop-blur-sm py-2 flex items-center gap-2 font-bold text-sm uppercase tracking-wider mb-2 ${colorClass} border-b border-gray-100 lg:bg-transparent lg:border-none lg:text-base lg:mb-4`}>
                  {icon} {title} <span className="text-xs opacity-70 font-normal ml-auto bg-white px-2 py-0.5 rounded-full border shadow-sm">{groupTasks.length} việc</span>
               </div>
               <div className="lg:h-full lg:overflow-y-auto lg:pr-1 custom-scrollbar">
                  {groupTasks.map(renderTaskCard)}
               </div>
            </div>
          )
        }

        return (
          <div className="h-full bg-[#fff7ed] rounded-lg p-4 overflow-y-auto custom-scrollbar pb-32 lg:pb-4">
             {sortedTasks.length === 0 ? (
               <div className="text-center text-gray-400 py-20 flex flex-col items-center">
                  <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                    <CloudOff size={32} className="text-orange-300"/>
                  </div>
                  <p className="font-medium">Không tìm thấy công việc nào.</p>
                  {selectedTagFilter ? (
                    <p className="text-xs opacity-70 mt-1">Thử bỏ bộ lọc thẻ "{selectedTagFilter}" xem sao.</p>
                  ) : (
                    <p className="text-xs opacity-70 mt-1">Hãy thêm việc mới hoặc đồng bộ từ Telegram.</p>
                  )}
               </div>
             ) : (
               <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 h-full items-start content-start">
                  {/* Greeting takes full width */}
                  {GreetingSection}

                  {/* Column 1: Priority (Overdue + Today) */}
                  <div className="flex flex-col gap-4 lg:bg-orange-50/50 lg:p-3 lg:rounded-2xl lg:border lg:border-orange-100 lg:min-h-[500px]">
                     {renderGroup("Quá hạn / Chưa xong", groups.overdue, <AlertCircle size={16}/>, "text-red-600")}
                     {renderGroup("Hôm nay", groups.today, <CalendarDays size={16}/>, "text-orange-600")}
                  </div>

                  {/* Column 2: Tomorrow */}
                  <div className="flex flex-col gap-4 lg:bg-blue-50/50 lg:p-3 lg:rounded-2xl lg:border lg:border-blue-100 lg:min-h-[500px]">
                     {renderGroup("Ngày mai", groups.tomorrow, <ArrowRight size={16}/>, "text-blue-600")}
                     
                     {/* On Large Desktop (XL), Upcoming is in Col 3. On Laptop (LG), Upcoming is here in Col 2 */}
                     <div className="block xl:hidden mt-4 pt-4 border-t border-blue-100 border-dashed">
                        {renderGroup("Sắp tới", groups.upcoming, <CalendarPlus size={16}/>, "text-gray-600", false)}
                     </div>
                  </div>

                  {/* Column 3: Upcoming (Visible only on XL screens) */}
                  <div className="hidden xl:flex flex-col gap-4 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 min-h-[500px]">
                     {renderGroup("Sắp tới", groups.upcoming, <CalendarPlus size={16}/>, "text-gray-600")}
                  </div>
               </div>
             )}
          </div>
        );
      case ViewMode.MONTH:
      case ViewMode.WEEK:
      case ViewMode.DAY:
      default:
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
    }
  };

  return (
    // Updated h-screen to supports-[height:100dvh]:h-[100dvh] for mobile browsers
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] text-gray-800 bg-[#fff7ed] overflow-hidden">
      {/* Toast Container */}
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Offline Banner */}
      {!useFirebase && (
        <div className="bg-stone-100 border-b border-stone-200 text-stone-800 p-2 text-xs flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="text-stone-500" />
            <div>
              <span className="font-bold">Đang chạy chế độ Offline.</span>
              <span className="ml-1 text-stone-600 opacity-80">{firebaseError}</span>
            </div>
          </div>
          <button onClick={() => { setFirebaseError(null); setUseFirebase(true); }} className="bg-stone-200 hover:bg-stone-300 px-3 py-1 rounded flex items-center gap-1">
             <RefreshCw size={12} /> Kết nối lại
          </button>
        </div>
      )}

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

          <div className="flex gap-2 sm:gap-3">
             {/* Settings Button: Hidden on Mobile, Visible on Desktop (lg:flex) */}
            <button onClick={() => setIsSettingsOpen(true)} className="hidden lg:flex items-center gap-1 hover:bg-white/20 px-2 py-1.5 rounded-md transition text-xs font-semibold backdrop-blur-sm active:scale-95">
              <Settings size={20} /> <span className="hidden sm:inline">Cài đặt</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Main Content Area */}
        <div className="flex-1 p-2 lg:p-3 flex flex-col min-w-0 order-1 lg:order-1 h-full overflow-hidden">
          {/* Desktop View Switcher & Filter */}
          <div className="hidden lg:flex flex-row items-center justify-between mb-3 px-1 flex-shrink-0 gap-2">
             <div className="flex gap-1 bg-orange-100 p-1 rounded-lg shadow-sm">
                <button 
                  onClick={() => setViewMode(ViewMode.MONTH)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.MONTH ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-900/60 hover:text-orange-900'}`}
                >
                  <LayoutGrid size={14} /> Tháng
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.WEEK)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.WEEK ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-900/60 hover:text-orange-900'}`}
                >
                  <Columns size={14} /> Tuần
                </button>
                 <button 
                  onClick={() => setViewMode(ViewMode.DAY)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.DAY ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-900/60 hover:text-orange-900'}`}
                >
                  <Square size={14} /> Ngày
                </button>
                <div className="w-[1px] bg-orange-200 mx-1"></div>
                <button 
                  onClick={() => setViewMode(ViewMode.LIST)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.LIST ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-900/60 hover:text-orange-900'}`}
                >
                   <Layout size={14} /> Dashboard
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.STATS)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === ViewMode.STATS ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-900/60 hover:text-orange-900'}`}
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
                            ? `bg-white border-current shadow-sm ring-1 ring-offset-1 font-bold ${t.dot.replace('bg-', 'text-').replace('text-white', '')}` 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 opacity-60 hover:opacity-100' 
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
        <div className="hidden lg:flex w-[320px] bg-white border-l border-orange-200 shadow-xl z-20 flex-col order-2 h-full">
           {/* Quick Add */}
           <div className="p-4 bg-orange-50 border-b border-orange-200 flex-shrink-0">
              <h2 className="font-bold text-orange-800 flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-orange-500" /> Thêm nhanh (AI)
              </h2>
              <div className="relative">
                <textarea
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="VD: Họp lúc 9h sáng mai... (Bấm mic để nói)"
                  style={{ colorScheme: 'light' }}
                  className="w-full border border-orange-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none min-h-[80px] resize-none shadow-inner bg-white"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(); } }}
                />
                <button onClick={toggleVoiceInput} className={`absolute bottom-2 left-2 p-1.5 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-500 hover:text-orange-600 border'}`}>
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button onClick={handleQuickAdd} disabled={isProcessingAI || !quickInput.trim()} className={`absolute bottom-2 right-2 p-1.5 rounded-md transition-all shadow-sm ${isProcessingAI ? 'bg-gray-200' : 'bg-orange-600 text-white'}`}>
                  {isProcessingAI ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                </button>
              </div>
           </div>

           {/* Button Bar */}
           <div className="p-4 border-b border-orange-100 bg-white flex-shrink-0">
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
                 <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-gray-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <div className="font-bold text-indigo-800 mb-2 flex items-center gap-1 border-b border-indigo-200 pb-1 text-sm">
                      <Bot size={14}/> Báo cáo AI:
                    </div>
                    <div 
                      className="text-xs leading-relaxed space-y-2 [&>h4]:font-bold [&>h4]:text-indigo-700 [&>h4]:mt-2 [&>h4]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-1" 
                      dangerouslySetInnerHTML={{ __html: aiReport }} 
                    />
                 </div>
               )}
           </div>
           
           <div className="p-2 border-t border-orange-100 text-[10px] text-center text-gray-400 bg-orange-50 flex-shrink-0">
             v2.4.1 • SmartCal Pro • AI Powered
           </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-orange-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-safe h-[64px]">
          <div className="grid grid-cols-5 h-full items-center max-w-md mx-auto">
            {/* 1. Dashboard */}
            <button onClick={() => setViewMode(ViewMode.LIST)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.LIST ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <Layout size={22} strokeWidth={viewMode === ViewMode.LIST ? 2.5 : 2} />
              <span className="text-[9px] font-medium">Dashboard</span>
            </button>

            {/* 2. Calendar */}
            <button onClick={() => setViewMode(ViewMode.MONTH)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.MONTH ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid size={22} strokeWidth={viewMode === ViewMode.MONTH ? 2.5 : 2} />
              <span className="text-[9px] font-medium">Lịch</span>
            </button>
            
            {/* 3. Center FAB (Floating Action Button) */}
            <div className="relative flex justify-center items-center h-full pointer-events-none">
              <button 
                 onClick={handleCreateNewTask}
                 className="pointer-events-auto absolute -top-6 bg-gradient-to-tr from-orange-500 to-red-600 text-white p-3.5 rounded-full shadow-xl shadow-orange-500/30 border-4 border-[#fff7ed] active:scale-90 transition-all hover:scale-105"
              >
                 <Plus size={28} />
              </button>
            </div>

            {/* 4. Stats */}
            <button onClick={() => setViewMode(ViewMode.STATS)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.STATS ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <PieChart size={22} strokeWidth={viewMode === ViewMode.STATS ? 2.5 : 2} />
              <span className="text-[9px] font-medium">Thống kê</span>
            </button>

            {/* 5. Settings */}
            <button onClick={() => setIsSettingsOpen(true)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all text-gray-400 hover:text-gray-600`}>
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