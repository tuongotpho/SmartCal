
import React from 'react';
import {
  Layout,
  LayoutGrid,
  Plus,
  PieChart,
  Settings,
  Sparkles
} from 'lucide-react';
import { ViewMode } from '../types';

interface MobileNavigationProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onCreateNewTask: () => void;
  onOpenSettings: () => void;
  onOpenAI?: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  viewMode,
  setViewMode,
  onCreateNewTask,
  onOpenSettings,
  onOpenAI
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-primary-100 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-[env(safe-area-inset-bottom,20px)] h-auto min-h-[64px]">
      <div className="grid grid-cols-5 h-[64px] items-center max-w-md mx-auto">

        {/* 1. Dashboard */}
        <button
          onClick={() => setViewMode(ViewMode.LIST)}
          className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.LIST ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <Layout size={22} strokeWidth={viewMode === ViewMode.LIST ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Dashboard</span>
        </button>

        {/* 2. Lịch */}
        <button
          onClick={() => setViewMode(ViewMode.MONTH)}
          className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.MONTH || viewMode === ViewMode.WEEK || viewMode === ViewMode.DAY || viewMode === ViewMode.TIMELINE ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <LayoutGrid size={22} strokeWidth={viewMode === ViewMode.MONTH ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Lịch</span>
        </button>

        {/* 3. Thêm mới (FAB giữa) */}
        <div className="relative flex justify-center items-center h-full pointer-events-none">
          <button
            onClick={onCreateNewTask}
            className="pointer-events-auto absolute -top-6 bg-gradient-to-tr from-primary-500 to-primary-700 text-white p-3.5 rounded-full shadow-xl border-4 border-[#fff7ed] dark:border-gray-950 active:scale-90 transition-all hover:scale-105 shadow-primary-500/30"
          >
            <Plus size={28} />
          </button>
        </div>

        {/* 4. AI Trợ lý */}
        <button
          onClick={onOpenAI}
          className="flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400"
        >
          <Sparkles size={22} />
          <span className="text-[9px] font-medium">AI</span>
        </button>

        {/* 5. Cài đặt */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Settings size={22} />
          <span className="text-[9px] font-medium">Cài đặt</span>
        </button>

      </div>
    </div>
  );
};

export default React.memo(MobileNavigation);
