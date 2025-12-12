
import React from 'react';
import { Task, Tag } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  MoreHorizontal,
  Plus,
  CircleDashed,
  CheckCircle
} from 'lucide-react';

interface KanbanViewProps {
  tasks: Task[];
  tags: Tag[];
  onToggleComplete: (task: Task) => void;
  onOpenEditModal: (task: Task) => void;
  onUpdateStatus: (taskId: string, status: 'todo' | 'in_progress' | 'done') => void;
}

const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  tags,
  onToggleComplete,
  onOpenEditModal,
  onUpdateStatus
}) => {

  // Phân loại task vào 3 cột dựa trên customStatus hoặc fallback logic
  const todoTasks = tasks.filter(t => !t.completed && (!t.customStatus || t.customStatus === 'todo'));
  const inProgressTasks = tasks.filter(t => !t.completed && t.customStatus === 'in_progress');
  const doneTasks = tasks.filter(t => t.completed || t.customStatus === 'done');

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
        onUpdateStatus(taskId, status);
    }
  };

  const renderCard = (task: Task) => {
    const tagConfig = tags.find(t => t.name === task.tag) || tags.find(t => t.name === 'Khác');
    
    return (
      <div 
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onClick={() => onOpenEditModal(task)}
        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
      >
        <div className="flex justify-between items-start mb-2">
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagConfig?.color || 'bg-gray-100 text-gray-600'}`}>
             {task.tag}
           </span>
           <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition">
             <MoreHorizontal size={14} />
           </button>
        </div>
        
        <h4 className={`text-sm font-semibold mb-1 text-gray-800 dark:text-gray-200 ${task.completed ? 'line-through text-gray-400' : ''}`}>
           {task.title}
        </h4>
        
        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
           <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <Clock size={12} />
              {task.time} - {task.date}
           </div>
           
           {task.subtasks && task.subtasks.length > 0 && (
             <div className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
               {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
             </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 h-full overflow-x-auto overflow-y-hidden p-2 lg:p-4 pb-20 lg:pb-0">
      <div className="flex h-full gap-4 min-w-[800px] lg:min-w-0">
        
        {/* Column 1: To Do */}
        <div 
          className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 min-w-[280px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'todo')}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-gray-50 dark:bg-gray-900/50 rounded-t-xl z-10">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 text-sm uppercase">
               <Circle size={16} className="text-gray-400" /> Cần làm
            </h3>
            <span className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">{todoTasks.length}</span>
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
             {todoTasks.map(renderCard)}
             <button className="w-full py-2 text-xs text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center gap-1 transition">
                <Plus size={14} /> Thêm thẻ
             </button>
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div 
          className="flex-1 flex flex-col bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 min-w-[280px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'in_progress')}
        >
          <div className="p-3 border-b border-blue-100 dark:border-blue-900/30 flex justify-between items-center sticky top-0 bg-blue-50 dark:bg-blue-900/10 rounded-t-xl z-10">
            <h3 className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2 text-sm uppercase">
               <CircleDashed size={16} className="text-blue-500 animate-spin-slow" /> Đang làm
            </h3>
            <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-bold px-2 py-0.5 rounded-full">{inProgressTasks.length}</span>
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
             {inProgressTasks.map(renderCard)}
             {inProgressTasks.length === 0 && (
                <div className="h-20 border-2 border-dashed border-blue-200 dark:border-blue-800/50 rounded-lg flex items-center justify-center text-blue-300 dark:text-blue-500/50 text-xs">
                   Kéo việc vào đây
                </div>
             )}
          </div>
        </div>

        {/* Column 3: Done */}
        <div 
          className="flex-1 flex flex-col bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30 min-w-[280px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'done')}
        >
          <div className="p-3 border-b border-green-100 dark:border-green-900/30 flex justify-between items-center sticky top-0 bg-green-50 dark:bg-green-900/10 rounded-t-xl z-10">
            <h3 className="font-bold text-green-700 dark:text-green-300 flex items-center gap-2 text-sm uppercase">
               <CheckCircle size={16} className="text-green-500" /> Đã xong
            </h3>
            <span className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs font-bold px-2 py-0.5 rounded-full">{doneTasks.length}</span>
          </div>
          <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
             {doneTasks.map(renderCard)}
          </div>
        </div>

      </div>
    </div>
  );
};

export default React.memo(KanbanView);
