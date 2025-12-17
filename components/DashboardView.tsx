
import React, { useState } from 'react';
import { Task, Tag, Subtask } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Edit3, 
  Trash2, 
  Timer, 
  Repeat, 
  History, 
  Flame, 
  Calendar 
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardViewProps {
  filteredTasks: Task[];
  tags: Tag[];
  onToggleComplete: (task: Task) => void;
  onOpenEditModal: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onTagClick: (tagName: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  filteredTasks,
  tags,
  onToggleComplete,
  onOpenEditModal,
  onDeleteTask,
  onTagClick
}) => {
  const [mobileListTab, setMobileListTab] = useState<'past' | 'today' | 'upcoming'>('today');

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
      // Use first tag for styling the time box
      const mainTagName = task.tags && task.tags.length > 0 ? task.tags[0] : 'Khác';
      const mainTagConfig = tags.find(t => t.name === mainTagName) || tags.find(t => t.name === 'Khác');
      
      // Check multi-day for label
      const isMultiDay = task.endDate && task.endDate !== task.date;
      
      return (
          <div key={task.id} className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all group ${task.completed ? 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}>
              <button onClick={() => onToggleComplete(task)} className={`flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-gray-600 hover:text-green-500'}`}>
              {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenEditModal(task)}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{task.time}</span>
                  {task.duration && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center gap-0.5 border border-blue-100 dark:border-blue-800">
                       <Timer size={10} /> {task.duration}
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${task.completed ? 'bg-gray-100 text-gray-500' : (mainTagConfig?.color || 'bg-gray-100 text-gray-700')}`}>
                      {task.date}
                      {isMultiDay && <span className="ml-1 opacity-70">→ {task.endDate}</span>}
                  </span>
                  {task.recurringType !== 'none' && <Repeat size={12} className="text-blue-500" />}
                  
                  {/* Multi Tags */}
                  {(task.tags || []).map(tagName => {
                      const tConf = tags.find(t => t.name === tagName);
                      if (!tConf) return null;
                      return (
                        <span 
                          key={tagName} 
                          className={`w-2 h-2 rounded-full ${tConf.dot} cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 dark:hover:ring-gray-600 transition-all`} 
                          title={`Lọc theo: ${tagName}`}
                          onClick={(e) => { e.stopPropagation(); onTagClick(tagName); }}
                        ></span>
                      )
                  })}
              </div>
              <h3 className={`font-semibold text-sm truncate text-gray-800 dark:text-gray-200`}>{task.title}</h3>
              {task.description && <p className="text-xs text-gray-500 truncate">{task.description}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onOpenEditModal(task)} className="p-2 text-gray-400 hover:text-orange-500"><Edit3 size={16}/></button>
              <button onClick={() => onDeleteTask(task.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
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
};

export default React.memo(DashboardView);
