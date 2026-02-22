import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { RefreshCw, Timer } from 'lucide-react';

import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import LoginScreen from './components/LoginScreen';
import AiAssistant from './components/AiAssistant';
import Toast from './components/Toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNavigation from './components/MobileNavigation';
import DashboardView from './components/DashboardView';
import KanbanView from './components/KanbanView';
import TimelineView from './components/TimelineView';
import FocusView from './components/FocusView';
import ModalsContainer from './components/ModalsContainer';

import { AppTheme, ViewMode, TelegramConfig, Task } from './types';
import { auth, logOut, saveTelegramConfigToFirestore } from './services/firebase';
import { hapticFeedback } from './services/hapticService';
import { generateReport } from './services/geminiService';
import { getLunarAnniversarySolar } from './services/lunarService';

// Custom Hooks
import { useNotifications } from './hooks/useNotifications';
import { useTheme } from './hooks/useTheme';
import { usePWA } from './hooks/usePWA';
import { useFCM } from './hooks/useFCM';
import { useTasks } from './hooks/useTasks';
import { useTelegramSync } from './hooks/useTelegramSync';
import { useReminders } from './hooks/useReminders';
import { useModals } from './hooks/useModals';
import { useGoogleSync } from './hooks/useGoogleSync';

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
  // 1. Auth & App Core State
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [useFirebase, setUseFirebase] = useState(true);

  // 2. View State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 3. AI Report State
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // 4. Custom Hooks
  const { isDarkMode, toggleTheme, currentTheme, setCurrentTheme } = useTheme(APP_THEMES);
  const { toasts, notifications, showToast, removeToast, addNotification, markAllNotificationsAsRead, clearAllNotifications, markNotificationAsRead } = useNotifications();
  const { deferredPrompt, handleInstallClick } = usePWA(showToast);
  const { fcmConfig, setFcmConfig } = useFCM(user, isOfflineMode, showToast, addNotification);

  // Telegram config lives here so it can be passed around
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('telegramConfig');
      return saved ? JSON.parse(saved) : { botToken: '', chatId: '' };
    } catch (e) {
      return { botToken: '', chatId: '' };
    }
  });

  const {
    tasks, tags, setTags, isConflictModalOpen, setIsConflictModalOpen,
    proposedTask, setProposedTask, pendingConflicts, saveTaskToDatabase,
    handleRequestAddTask, handleUpdateTask, executeDeleteTask
  } = useTasks(user, isOfflineMode, useFirebase, telegramConfig, showToast, addNotification, setUseFirebase);

  const { isSyncing, handleManualSync } = useTelegramSync(
    user, isOfflineMode, telegramConfig, tags, handleRequestAddTask, showToast, addNotification
  );

  const {
    reminderMinutesBefore, setReminderMinutesBefore, isReminderModalOpen, reminderTask,
    handleReminderClose, handleReminderSnooze, handleReminderComplete
  } = useReminders(tasks, telegramConfig, addNotification, showToast, handleUpdateTask);

  const {
    isSettingsOpen, setIsSettingsOpen, isEditModalOpen, setIsEditModalOpen, editingTask, setEditingTask,
    isDeleteModalOpen, setIsDeleteModalOpen, taskToDeleteId, setTaskToDeleteId,
    showOnboarding, closeOnboarding, isAIOpen, setIsAIOpen
  } = useModals();

  // 5. Automatic Google Calendar Light 2-Way Sync
  useGoogleSync(user, isOfflineMode, tasks);

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

  // Request Notification Permission on Load
  useEffect(() => {
    const requestNotifPermission = async () => {
      if ((window as any).__TAURI_INTERNALS__) {
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

  // Pull to refresh logic
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);

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

  const handleToggleComplete = async (task: any) => {
    const nextState = !task.completed;
    const updated = { ...task, completed: nextState };
    await handleUpdateTask(updated, false);

    if (nextState) {
      hapticFeedback.medium();
      showToast(`Đã xong: ${task.title}`, "success");
      addNotification("Đã hoàn thành", `Chúc mừng bạn đã hoàn thành: ${task.title}`, "success", false);
    }
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

      <Header
        currentDate={currentDate} setCurrentDate={setCurrentDate} getHeaderText={format(currentDate, viewMode === ViewMode.DAY ? 'dd/MM/yyyy' : 'MM/yyyy')}
        onPrev={() => setCurrentDate(prev => addMonths(prev, -1))} onNext={() => setCurrentDate(prev => addMonths(prev, 1))}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearchActive={isSearchActive} setIsSearchActive={setIsSearchActive}
        isDatePickerOpen={isDatePickerOpen} setIsDatePickerOpen={setIsDatePickerOpen} user={user} isOfflineMode={isOfflineMode}
        isDarkMode={isDarkMode} toggleTheme={toggleTheme} setIsSettingsOpen={setIsSettingsOpen}
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
          <div className="flex-1 relative overflow-hidden">
            {isRefreshing && (
              <div className="absolute top-0 left-0 right-0 flex justify-center p-2 z-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <RefreshCw className="animate-spin text-primary-500" size={24} />
              </div>
            )}
            {renderContent()}
          </div>
        </main>

        <aside className={`hidden lg:flex flex-col border-l border-primary-200 dark:border-gray-800 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0'}`}>
          <Sidebar onAddTask={handleRequestAddTask} onGenerateReport={() => { setIsReportLoading(true); generateReport(tasks, "Tháng").then(r => { setAiReport(r); setIsReportLoading(false); }); }} isReportLoading={isReportLoading} aiReport={aiReport} tags={tags} user={user} isOfflineMode={isOfflineMode} isDarkMode={isDarkMode} showToast={showToast} />
        </aside>

        <MobileNavigation viewMode={viewMode} setViewMode={setViewMode} onCreateNewTask={() => { setEditingTask({ id: 'temp', title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', completed: false, tags: ['Khác'] }); setIsEditModalOpen(true); }} onOpenSettings={() => setIsSettingsOpen(true)} onOpenAI={() => setIsAIOpen(true)} />
      </div>

      <ModalsContainer
        tasks={tasks} isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen}
        isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen}
        telegramConfig={telegramConfig} tags={tags}
        onSaveConfig={(cfg) => {
          setTelegramConfig(cfg);
          localStorage.setItem('telegramConfig', JSON.stringify(cfg));
          if (user && useFirebase) {
            saveTelegramConfigToFirestore(user.uid, cfg);
            showToast("Cấu hình Telegram đã được đồng bộ lên Cloud", "success");
          }
        }}
        onSaveTags={(t) => setTags(t)} handleManualSync={handleManualSync}
        isSyncing={isSyncing} lastSyncTime={format(new Date(), 'HH:mm')} showToast={showToast}
        currentTheme={currentTheme} setCurrentTheme={setCurrentTheme} themes={APP_THEMES}
        fcmConfig={fcmConfig} setFcmConfig={setFcmConfig} userId={user?.uid}
        reminderMinutesBefore={reminderMinutesBefore} setReminderMinutesBefore={(minutes) => {
          setReminderMinutesBefore(minutes);
          localStorage.setItem('reminder_minutes_before', minutes.toString());
        }}
        isEditModalOpen={isEditModalOpen} setIsEditModalOpen={setIsEditModalOpen}
        editingTask={editingTask} handleRequestAddTask={handleRequestAddTask} handleUpdateTask={handleUpdateTask}
        isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
        executeDeleteTask={executeDeleteTask} taskToDeleteId={taskToDeleteId}
        isConflictModalOpen={isConflictModalOpen} setIsConflictModalOpen={setIsConflictModalOpen}
        saveTaskToDatabase={saveTaskToDatabase} proposedTask={proposedTask} setProposedTask={setProposedTask} pendingConflicts={pendingConflicts}
        isReminderModalOpen={isReminderModalOpen} reminderTask={reminderTask} handleReminderClose={handleReminderClose}
        handleReminderSnooze={handleReminderSnooze} handleReminderComplete={handleReminderComplete}
        showOnboarding={showOnboarding} user={user} closeOnboarding={closeOnboarding}
      />
    </div>
  );
};

export default App;