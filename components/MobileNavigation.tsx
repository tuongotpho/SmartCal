
import React from 'react';
import { 
  Layout, 
  LayoutGrid, 
  Plus, 
  PieChart, 
  Settings,
  GanttChartSquare,
  Timer
} from 'lucide-react';
import { ViewMode } from '../types';

interface MobileNavigationProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onCreateNewTask: () => void;
  onOpenSettings: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  viewMode,
  setViewMode,
  onCreateNewTask,
  onOpenSettings
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-primary-100 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-[env(safe-area-inset-bottom,20px)] h-auto min-h-[64px]">
      <div className="grid grid-cols-5 h-[64px] items-center max-w-md mx-auto">
        {/* 1. Dashboard */}
        <button onClick={() => setViewMode(ViewMode.LIST)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.LIST ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          <Layout size={22} strokeWidth={viewMode === ViewMode.LIST ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Dashboard</span>
        </button>

        {/* 2. Calendar/Timeline */}
        <button 
           onClick={() => setViewMode(ViewMode.MONTH)} 
           className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.MONTH || viewMode === ViewMode.TIMELINE ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <LayoutGrid size={22} strokeWidth={viewMode === ViewMode.MONTH ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Lịch</span>
        </button>
        
        {/* 3. Focus FAB */}
        <div className="relative flex justify-center items-center h-full pointer-events-none">
          <button 
             onClick={() => setViewMode(ViewMode.FOCUS)}
             className={`pointer-events-auto absolute -top-6 bg-gradient-to-tr text-white p-3.5 rounded-full shadow-xl border-4 border-[#fff7ed] dark:border-gray-950 active:scale-90 transition-all hover:scale-105 ${viewMode === ViewMode.FOCUS ? 'from-orange-500 to-red-600 shadow-orange-500/30' : 'from-primary-500 to-primary-700 shadow-primary-500/30'}`}
          >
             <Timer size={28} />
          </button>
        </div>

        {/* 4. Stats */}
        <button onClick={() => setViewMode(ViewMode.STATS)} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all ${viewMode === ViewMode.STATS ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          <PieChart size={22} strokeWidth={viewMode === ViewMode.STATS ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Thống kê</span>
        </button>

        {/* 5. Create New */}
        <button onClick={onCreateNewTask} className={`flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}>
          <Plus size={22} />
          <span className="text-[9px] font-medium">Thêm mới</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(MobileNavigation);
