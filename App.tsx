
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
  Kanban,
  GanttChartSquare,
  ArrowDown
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
import TimelineView from './components/TimelineView';

import { Task, TelegramConfig, ViewMode, Tag, DEFAULT_TASK_TAGS, RecurringType, AppTheme } from './types';
import { parseTaskWithGemini, generateReport } from './services/geminiService';
import { sendTelegramMessage, fetchTelegramUpdates, formatTaskForTelegram } from './services/telegramService';
import { subscribeToTasks, subscribeToTags, saveTagsToFirestore, addTaskToFirestore, deleteTaskFromFirestore, updateTaskInFirestore, auth, logOut } from './services/firebase';
import { hapticFeedback } from './services/hapticService';

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
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // General State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentTheme, setCurrentTheme] = useState<string>(() => localStorage.getItem('app_theme') || 'orange');
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TASK_TAGS);
  
  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);

  // Filter & UI State
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
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Telegram Config
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

  // --- Handlers & Performance ---
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Theme Sync
  useEffect(() => {
    const themeObj = APP_THEMES.find(t => t.name === currentTheme) || APP_THEMES[0];
    const root = document.documentElement;
    Object.entries(themeObj.colors).forEach(([shade, rgb]) => {
      root.style.setProperty(`--color-primary-${shade}`, rgb);
    });
    localStorage.setItem('app_theme', currentTheme);
  }, [currentTheme]);

  // Auth Listener
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

  // Dark Mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Pull to refresh logic (simplified mobile implementation)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current > 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 0 && diff < 150) {
        setPullY(diff);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullY > 80) {
      setIsRefreshing(true);
      hapticFeedback.light();
      // Simulate refresh
      await new Promise(res => setTimeout(res, 800));
      hapticFeedback.medium();
      showToast("Đã làm mới dữ liệu", "success");
      setIsRefreshing(false);
    }
    setPullY(0);
    startY.current = 0;
  };

  // --- Memoized Filters ---
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedTagFilter) {
      result = result.filter(t => (t.tags || ['Khác']).includes(selectedTagFilter));
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

  const visibleTags = useMemo(() => {
    const usedTagNames = new Set<string>();
    tasks.forEach(t => (t.tags || ['Khác']).forEach(tag => usedTagNames.add(tag)));
    return tags.filter(t => usedTagNames.has(t.name));
  }, [tasks, tags]);

  // Firebase Load
  const effectiveUserId = user ? user.uid : (isOfflineMode ? 'offline_user' : null);
  useEffect(() => {
    if (!effectiveUserId) return;
    let unsubscribe: () => void;
    if (useFirebase && !isOfflineMode) {
      unsubscribe = subscribeToTasks(effectiveUserId, 
        (fetchedTasks) => { setTasks(fetchedTasks); setFirebaseError(null); },
        (error) => { setFirebaseError(error.message); setUseFirebase(false); showToast("Đã chuyển sang Offline do lỗi kết nối.", "warning"); }
      );
    } else {
      const saved = localStorage.getItem(isOfflineMode ? 'offlineTasks' : 'localTasks');
      if (saved) try { setTasks(JSON.parse(saved)); } catch (e) { setTasks([]); }
    }
    return () => unsubscribe && unsubscribe();
  }, [useFirebase, showToast, effectiveUserId, isOfflineMode]);

  // Fix: Sync tags from Firebase or LocalStorage
  useEffect(() => {
    if (!effectiveUserId) return;
    let unsubscribeTags: () => void;
    if (useFirebase && !isOfflineMode) {
      unsubscribeTags = subscribeToTags(effectiveUserId,
        (fetchedTags) => setTags(fetchedTags),
        (error) => console.warn("Tags subscription error", error)
      );
    } else {
      const key = isOfflineMode ? 'offlineTags' : 'localTags';
      const saved = localStorage.getItem(key);
      if (saved) {
        try { setTags(JSON.parse(saved)); } catch (e) { setTags(DEFAULT_TASK_TAGS); }
      }
    }
    return () => unsubscribeTags && unsubscribeTags();
  }, [useFirebase, effectiveUserId, isOfflineMode]);

  // --- Handlers ---
  
  // Fix: Added missing handleSaveTags to handle tag updates and cloud sync
  const handleSaveTags = useCallback(async (newTags: Tag[]) => {
    setTags(newTags);
    if (useFirebase && user && !isOfflineMode) {
      try {
        await saveTagsToFirestore(user.uid, newTags);
        showToast("Đã cập nhật danh sách thẻ", "success");
      } catch (e) {
        showToast("Lỗi khi lưu thẻ online. Đã lưu tạm trên máy.", "warning");
      }
    } else {
      const key = isOfflineMode ? 'offlineTags' : 'localTags';
      localStorage.setItem(key, JSON.stringify(newTags));
      showToast("Đã lưu danh sách thẻ (Ngoại tuyến)", "info");
    }
  }, [useFirebase, user, isOfflineMode, showToast]);

  const handleUpdateTask = useCallback(async (updatedTask: Task, notify = true) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    if (useFirebase && !isOfflineMode) {
      try {
        await updateTaskInFirestore(updatedTask);
        if (notify) {
          showToast("Đã lưu thay đổi", "success");
          hapticFeedback.light();
        }
      } catch (e) {
        showToast("Lỗi cập nhật. Đang lưu tạm trên máy.", "warning");
      }
    }
  }, [useFirebase, isOfflineMode, showToast]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const nextState = !task.completed;
    await handleUpdateTask({ ...task, completed: nextState }, false);
    if (nextState) {
      hapticFeedback.medium();
      showToast(`Đã xong: ${task.title}`, "success");
    } else {
      hapticFeedback.light();
    }
  }, [handleUpdateTask, showToast]);

  const handleAddTask = useCallback(async (newTask: Task) => {
    hapticFeedback.medium();
    if (useFirebase && user && !isOfflineMode) {
      try {
        await addTaskToFirestore(newTask);
        showToast("Đã thêm công việc mới", "success");
      } catch (e) {
        showToast("Không thể lưu online. Đã lưu tạm trên máy.", "warning");
        setTasks(prev => [...prev, { ...newTask, id: Date.now().toString() }]);
      }
    } else {
      setTasks(prev => [...prev, { ...newTask, id: Date.now().toString() }]);
      showToast("Đã thêm (Offline)", "success");
    }
    if (telegramConfig.botToken) sendTelegramMessage(telegramConfig, formatTaskForTelegram(newTask));
  }, [useFirebase, user, isOfflineMode, telegramConfig, showToast]);

  const executeDeleteTask = useCallback(async () => {
    if (!taskToDeleteId) return;
    hapticFeedback.error();
    try {
      if (useFirebase && !isOfflineMode) await deleteTaskFromFirestore(taskToDeleteId);
      setTasks(prev => prev.filter(t => t.id !== taskToDeleteId));
      showToast("Đã xóa công việc", "info");
    } catch (e) {
      showToast("Lỗi khi xóa.", "error");
    }
    setTaskToDeleteId(null);
  }, [taskToDeleteId, useFirebase, isOfflineMode, showToast]);

  const renderContent = () => {
    switch (viewMode) {
      case ViewMode.STATS: return <StatsView currentDate={currentDate} tasks={tasks} tags={tags} />;
      case ViewMode.LIST: return <DashboardView filteredTasks={filteredTasks} tags={tags} onToggleComplete={handleToggleComplete} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onDeleteTask={(id) => { setTaskToDeleteId(id); setIsDeleteModalOpen(true); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.KANBAN: return <KanbanView tasks={filteredTasks} tags={tags} onToggleComplete={handleToggleComplete} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onUpdateStatus={(id, s) => { const t = tasks.find(x => x.id === id); if(t) handleUpdateTask({...t, customStatus: s, completed: s === 'done'}); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.TIMELINE: return <TimelineView currentDate={currentDate} tasks={filteredTasks} tags={tags} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onTagClick={setSelectedTagFilter} />;
      default: return <CalendarView currentDate={currentDate} viewMode={viewMode} tasks={filteredTasks} tags={tags} onDeleteTask={(id) => { setTaskToDeleteId(id); setIsDeleteModalOpen(true); }} onEditTask={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onToggleComplete={handleToggleComplete} onMoveTask={(id, d) => { const t = tasks.find(x => x.id === id); if(t) handleUpdateTask({...t, date: d}); }} onSelectDate={(d) => { setCurrentDate(d); setViewMode(ViewMode.DAY); }} onTagClick={setSelectedTagFilter} />;
    }
  };

  if (isAuthLoading) return <div className="flex h-screen items-center justify-center bg-primary-50 dark:bg-gray-950"><RefreshCw className="animate-spin text-primary-600" size={32} /></div>;
  if (!user && !isOfflineMode) return <LoginScreen onBypassAuth={() => { setIsOfflineMode(true); setUseFirebase(false); }} />;

  return (
    <div 
      className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] text-gray-800 dark:text-gray-100 bg-primary-50 dark:bg-gray-950 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Toast toasts={toasts} onRemove={removeToast} />
      
      {/* Pull-to-refresh UI */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-transform"
        style={{ transform: `translateY(${pullY - 40}px)`, opacity: pullY / 100 }}
      >
        <div className={`p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
           <ArrowDown size={20} className={`text-primary-600 transition-transform ${pullY > 80 ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {!useFirebase && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-2 text-[10px] text-center font-bold">
          Đang ở chế độ Offline. Dữ liệu lưu trên thiết bị này.
        </div>
      )}

      <Header 
        currentDate={currentDate} setCurrentDate={setCurrentDate} getHeaderText={format(currentDate, viewMode === ViewMode.DAY ? 'dd/MM/yyyy' : 'MM/yyyy')}
        onPrev={() => setCurrentDate(prev => addMonths(prev, -1))} onNext={() => setCurrentDate(prev => addMonths(prev, 1))}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearchActive={isSearchActive} setIsSearchActive={setIsSearchActive}
        isDatePickerOpen={isDatePickerOpen} setIsDatePickerOpen={setIsDatePickerOpen} user={user} isOfflineMode={isOfflineMode}
        isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} setIsSettingsOpen={setIsSettingsOpen}
        onLogout={() => { if(isOfflineMode) window.location.reload(); else logOut(); }}
        datePickerRef={datePickerRef} searchInputRef={searchInputRef} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <main className="flex-1 p-2 lg:p-3 overflow-hidden flex flex-col">
          {/* Desktop View Selection (Memoized View) */}
          <div className="hidden lg:flex gap-1 mb-3">
             {[ViewMode.MONTH, ViewMode.WEEK, ViewMode.DAY, ViewMode.LIST, ViewMode.KANBAN, ViewMode.TIMELINE, ViewMode.STATS].map(mode => (
               <button 
                 key={mode} onClick={() => setViewMode(mode)}
                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === mode ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
               >
                 {mode}
               </button>
             ))}
          </div>
          <div className="flex-1 relative overflow-hidden">{renderContent()}</div>
        </main>

        <aside className={`hidden lg:flex flex-col border-l border-primary-200 dark:border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0'}`}>
          <Sidebar onAddTask={handleAddTask} onGenerateReport={() => { setIsReportLoading(true); generateReport(tasks, "Tháng").then(r => {setAiReport(r); setIsReportLoading(false);}); }} isReportLoading={isReportLoading} aiReport={aiReport} tags={tags} user={user} isOfflineMode={isOfflineMode} isDarkMode={isDarkMode} showToast={showToast} />
        </aside>

        <MobileNavigation viewMode={viewMode} setViewMode={setViewMode} onCreateNewTask={() => { setEditingTask({ id: 'temp', title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', completed: false, tags: ['Khác'] }); setIsEditModalOpen(true); }} onOpenSettings={() => setIsSettingsOpen(true)} />
      </div>

      <AiAssistant tasks={tasks} />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} telegramConfig={telegramConfig} tags={tags} onSaveConfig={setTelegramConfig} onSaveTags={handleSaveTags} onManualSync={() => {}} isSyncing={false} lastSyncTime={format(new Date(), 'HH:mm')} showToast={showToast} currentTheme={currentTheme} setCurrentTheme={setCurrentTheme} themes={APP_THEMES} />
      <EditTaskModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} task={editingTask} tags={tags} onSave={async (t) => { if(t.id === 'temp') await handleAddTask(t); else await handleUpdateTask(t); setIsEditModalOpen(false); }} showToast={showToast} />
      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={executeDeleteTask} title="Xác nhận" message="Bạn có chắc muốn xóa không?" />
    </div>
  );
};

export default App;
