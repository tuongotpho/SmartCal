import React, { useState, useMemo } from 'react';
import { Task, Tag } from '../types';
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
import { format, isPast, isToday, isFuture, parseISO } from 'date-fns';

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
  const [mobileTab, setMobileTab] = useState<'overdue' | 'today' | 'upcoming'>('today');

  // Phân loại task dùng useMemo để tránh tính toán lại
  const { overdue, today, upcoming } = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return {
      overdue: filteredTasks.filter(t => t.date < todayStr && !t.completed).sort((a, b) => a.date.localeCompare(b.date)),
      today: filteredTasks.filter(t => (t.date === todayStr || (t.date <= todayStr && (t.endDate || t.date) >= todayStr))).sort((a, b) => a.time.localeCompare(b.time)),
      upcoming: filteredTasks.filter(t => t.date > todayStr).sort((a, b) => a.date.localeCompare(b.date))
    };
  }, [filteredTasks]);

  const TaskCard = React.memo(({ task }: { task: Task }) => {
    const mainTagName = task.tags?.[0] || 'Khác';
    const tagCfg = tags.find(t => t.name === mainTagName) || tags.find(t => t.name === 'Khác');

    return (
      <div className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] ${task.completed ? 'opacity-60' : ''}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
          className={`shrink-0 transition-transform active:scale-125 ${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`}
        >
          {task.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </button>

        <div className="flex-1 min-w-0" onClick={() => onOpenEditModal(task)}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {task.time}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tagCfg?.color || 'bg-blue-50 text-blue-600'}`}>
              {task.date === format(new Date(), 'yyyy-MM-dd') ? 'Hôm nay' : task.date}
            </span>
            {task.recurringType !== 'none' && <Repeat size={10} className="text-blue-500" />}
          </div>
          <h3 className={`text-sm font-bold truncate text-gray-800 dark:text-gray-200 ${task.completed ? 'line-through' : ''}`}>
            {task.title} {task.googleEventId ? '📅' : ''}
          </h3>
          {task.description && <p className="text-[10px] text-gray-500 truncate">{task.description}</p>}
        </div>

        <div className="flex gap-1 shrink-0">
          <button onClick={() => onDeleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mobile Selector */}
      <div className="lg:hidden flex p-1 gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 mb-2 shadow-sm shrink-0">
        {[
          { id: 'overdue', icon: <History size={14} />, label: 'Trễ', count: overdue.length },
          { id: 'today', icon: <Flame size={14} />, label: 'Nay', count: today.length },
          { id: 'upcoming', icon: <Calendar size={14} />, label: 'Sắp tới', count: upcoming.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mobileTab === tab.id ? 'bg-primary-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            {tab.icon} {tab.label} <span className="text-[10px] opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full overflow-y-auto lg:overflow-hidden custom-scrollbar">
        {/* Render các cột tùy thuộc vào mobileTab hoặc luôn hiện trên Desktop */}
        {[
          { id: 'overdue', list: overdue, title: 'Công việc quá hạn', color: 'text-red-600', bg: 'bg-red-50/50' },
          { id: 'today', list: today, title: 'Việc của hôm nay', color: 'text-orange-600', bg: 'bg-orange-50/50' },
          { id: 'upcoming', list: upcoming, title: 'Kế hoạch sắp tới', color: 'text-blue-600', bg: 'bg-blue-50/50' }
        ].map(col => (
          <div key={col.id} className={`${mobileTab === col.id ? 'flex' : 'hidden'} lg:flex flex-col h-full overflow-hidden bg-gray-50/30 dark:bg-gray-900/10 rounded-2xl border border-gray-100 dark:border-gray-800`}>
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-800/50">
              <h2 className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.title}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">{col.list.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {col.list.map(t => <TaskCard key={t.id} task={t} />)}
              {col.list.length === 0 && (
                <div className="h-32 flex flex-col items-center justify-center text-gray-400 opacity-40 italic text-[10px]">
                  Trống
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(DashboardView);