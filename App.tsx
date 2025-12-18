
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

import { Task, TelegramConfig, ViewMode, Tag, DEFAULT_TASK_TAGS, RecurringType, AppTheme } from './types';
import { parseTaskWithGemini, generateReport, checkProposedTaskConflict } from './services/geminiService';
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
  
  // Pre-save conflict states (Keep these for the Popup)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [proposedTask, setProposedTask] = useState<Task | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<string[]>([]);

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('telegramConfig');
      return saved ? JSON.parse(saved) : { botToken: '', chatId: '' };
    } catch (e) {
      return { botToken: '', chatId: '' };
    }
  });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
      unsubscribeTags = subscribeToTags(effectiveUserId, (fetchedTags) => setTags(fetchedTags), (error) => {});
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
      return;
    }

    // AI Check Conflict BEFORE adding
    const conflictList = await checkProposedTaskConflict(task, tasks);
    if (conflictList.length > 0) {
      setPendingConflicts(conflictList);
      setProposedTask(task);
      setIsConflictModalOpen(true);
      hapticFeedback.warning();
    } else {
      await saveTaskToDatabase(task);
    }
  }, [tasks, saveTaskToDatabase]);

  const handleUpdateTask = useCallback(async (updatedTask: Task, notify = true) => {
    // Only check conflict for updates if time/date changed
    const oldTask = tasks.find(t => t.id === updatedTask.id);
    if (oldTask && (oldTask.date !== updatedTask.date || oldTask.time !== updatedTask.time)) {
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
        await updateTaskInFirestore(updatedTask);
        if (notify) showToast("Đã lưu thay đổi", "success");
      } catch (e) { showToast("Lỗi cập nhật", "warning"); }
    }
  }, [tasks, useFirebase, isOfflineMode, showToast]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const nextState = !task.completed;
    const updated = { ...task, completed: nextState };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    
    if (useFirebase && !isOfflineMode) {
      await updateTaskInFirestore(updated);
    }
    
    if (nextState) { hapticFeedback.medium(); showToast(`Đã xong: ${task.title}`, "success"); }
  }, [useFirebase, isOfflineMode, showToast]);

  const executeDeleteTask = useCallback(async () => {
    if (!taskToDeleteId) return;
    try {
      if (useFirebase && !isOfflineMode) await deleteTaskFromFirestore(taskToDeleteId);
      setTasks(prev => prev.filter(t => t.id !== taskToDeleteId));
      showToast("Đã xóa công việc", "info");
    } catch (e) { showToast("Lỗi khi xóa.", "error"); }
    setTaskToDeleteId(null);
  }, [taskToDeleteId, useFirebase, isOfflineMode, showToast]);

  const renderContent = () => {
    switch (viewMode) {
      case ViewMode.STATS: return <StatsView currentDate={currentDate} tasks={tasks} tags={tags} />;
      case ViewMode.LIST: return <DashboardView filteredTasks={filteredTasks} tags={tags} onToggleComplete={handleToggleComplete} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onDeleteTask={(id) => { setTaskToDeleteId(id); setIsDeleteModalOpen(true); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.KANBAN: return <KanbanView tasks={filteredTasks} tags={tags} onToggleComplete={handleToggleComplete} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onUpdateStatus={(id, s) => { const t = tasks.find(x => x.id === id); if(t) handleUpdateTask({...t, customStatus: s, completed: s === 'done'}); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.TIMELINE: return <TimelineView currentDate={currentDate} tasks={filteredTasks} tags={tags} onOpenEditModal={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onTagClick={setSelectedTagFilter} />;
      case ViewMode.FOCUS: return <FocusView tasks={filteredTasks} tags={tags} onCompleteSession={(id) => { const t = tasks.find(x => x.id === id); if(t) handleUpdateTask({...t, pomodoroSessions: (t.pomodoroSessions || 0) + 1}, false); }} />;
      default: return <CalendarView currentDate={currentDate} viewMode={viewMode} tasks={filteredTasks} tags={tags} onDeleteTask={(id) => { setTaskToDeleteId(id); setIsDeleteModalOpen(true); }} onEditTask={(t) => { setEditingTask(t); setIsEditModalOpen(true); }} onToggleComplete={handleToggleComplete} onMoveTask={(id, d) => { const t = tasks.find(x => x.id === id); if(t) handleUpdateTask({...t, date: d}); }} onSelectDate={(d) => { setCurrentDate(d); setViewMode(ViewMode.DAY); }} onTagClick={setSelectedTagFilter} />;
    }
  };

  if (isAuthLoading) return <div className="flex h-screen items-center justify-center bg-primary-50 dark:bg-gray-950"><RefreshCw className="animate-spin text-primary-600" size={32} /></div>;
  if (!user && !isOfflineMode) return <LoginScreen onBypassAuth={() => { setIsOfflineMode(true); setUseFirebase(false); }} />;

  return (
    <div 
      className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] text-gray-800 dark:text-gray-100 bg-primary-50 dark:bg-gray-950 overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <Toast toasts={toasts} onRemove={removeToast} />
      
      {/* Global Banner Notification Removed per user request */}

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
          <Sidebar onAddTask={handleRequestAddTask} onGenerateReport={() => { setIsReportLoading(true); generateReport(tasks, "Tháng").then(r => {setAiReport(r); setIsReportLoading(false);}); }} isReportLoading={isReportLoading} aiReport={aiReport} tags={tags} user={user} isOfflineMode={isOfflineMode} isDarkMode={isDarkMode} showToast={showToast} />
        </aside>

        <MobileNavigation viewMode={viewMode} setViewMode={setViewMode} onCreateNewTask={() => { setEditingTask({ id: 'temp', title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', completed: false, tags: ['Khác'] }); setIsEditModalOpen(true); }} onOpenSettings={() => setIsSettingsOpen(true)} />
      </div>

      <AiAssistant tasks={tasks} />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} telegramConfig={telegramConfig} tags={tags} onSaveConfig={setTelegramConfig} onSaveTags={(t) => setTags(t)} onManualSync={() => {}} isSyncing={false} lastSyncTime={format(new Date(), 'HH:mm')} showToast={showToast} currentTheme={currentTheme} setCurrentTheme={setCurrentTheme} themes={APP_THEMES} />
      
      <EditTaskModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} task={editingTask} tags={tags} onSave={async (t) => { if(t.id === 'temp') await handleRequestAddTask(t); else await handleUpdateTask(t); setIsEditModalOpen(false); }} showToast={showToast} />
      
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
    </div>
  );
};

export default App;
