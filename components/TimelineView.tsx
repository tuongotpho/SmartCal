import React, { useRef, useEffect } from 'react';
import { Task, Tag } from '../types';
import { 
  format, 
  eachDayOfInterval, 
  endOfMonth, 
  isSameDay, 
  differenceInDays, 
  addDays,
  isToday
} from 'date-fns';
import startOfMonth from 'date-fns/startOfMonth';
import startOfDay from 'date-fns/startOfDay';
import parseISO from 'date-fns/parseISO';
import { AlertCircle } from 'lucide-react';

interface TimelineViewProps {
  currentDate: Date;
  tasks: Task[];
  tags: Tag[];
  onOpenEditModal: (task: Task) => void;
  onTagClick: (tagName: string) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  currentDate,
  tasks,
  tags,
  onOpenEditModal,
  onTagClick
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Define range: Start of month to End of month
  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Config
  const COLUMN_WIDTH = 50; // px per day
  const ROW_HEIGHT = 44; // px
  const HEADER_HEIGHT = 40; // px
  const SIDEBAR_WIDTH = 140; // px

  // Filter tasks in range
  const visibleTasks = tasks.filter(t => {
     const tStart = parseISO(t.date);
     const tEnd = t.endDate ? parseISO(t.endDate) : tStart;
     return tStart <= endDate && tEnd >= startDate;
  }).sort((a, b) => a.date.localeCompare(b.date));

  // Scroll to today on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
       const today = new Date();
       if (today >= startDate && today <= endDate) {
          const diff = differenceInDays(today, startDate);
          scrollContainerRef.current.scrollLeft = (diff * COLUMN_WIDTH) - 100;
       }
    }
  }, [currentDate]);

  const getTaskStyle = (task: Task) => {
    const tStart = parseISO(task.date);
    const tEnd = task.endDate ? parseISO(task.endDate) : tStart;
    
    // Clamp start/end to view range
    const effectiveStart = tStart < startDate ? startDate : tStart;
    const effectiveEnd = tEnd > endDate ? endDate : tEnd;
    
    const offsetDays = differenceInDays(effectiveStart, startDate);
    const durationDays = differenceInDays(effectiveEnd, effectiveStart) + 1;
    
    const mainTagName = task.tags && task.tags.length > 0 ? task.tags[0] : 'Khác';
    const tagConfig = tags.find(t => t.name === mainTagName) || tags.find(t => t.name === 'Khác');
    
    return {
      left: `${offsetDays * COLUMN_WIDTH}px`,
      width: `${durationDays * COLUMN_WIDTH - 4}px`, // -4 for gap
      backgroundColor: task.completed ? '#9ca3af' : undefined, // Gray if completed
      // Use tailwind classes for colors ideally, but dynamic style needs specific values or mapped classes
      // We'll use the dot color class to guess background or default to primary
      className: `${task.completed ? '' : (tagConfig?.color.split(' ')[0] || 'bg-primary-100')} ${task.completed ? '' : (tagConfig?.color.split(' ')[2] || 'text-primary-800')}`
    };
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden pb-32 lg:pb-0">
      
      {/* Header Month Label */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
         <h2 className="font-bold text-gray-800 dark:text-gray-200">Timeline - Tháng {format(currentDate, 'MM/yyyy')}</h2>
         <span className="text-xs text-gray-500">{visibleTasks.length} công việc</span>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Task Names) */}
        <div 
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
          style={{ width: `${SIDEBAR_WIDTH}px` }}
        >
           {/* Header Spacer */}
           <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50" style={{ height: `${HEADER_HEIGHT}px` }}></div>
           
           {/* Task List */}
           <div className="overflow-hidden">
              {visibleTasks.map(task => {
                const mainTagName = task.tags && task.tags.length > 0 ? task.tags[0] : 'Khác';
                return (
                  <div 
                    key={task.id} 
                    className="px-2 flex items-center border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer truncate"
                    style={{ height: `${ROW_HEIGHT}px` }}
                    onClick={() => onOpenEditModal(task)}
                    title={task.title}
                  >
                    <span 
                        className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${tags.find(t => t.name === mainTagName)?.dot || 'bg-gray-400'} cursor-pointer hover:scale-125 transition-transform`}
                        onClick={(e) => { e.stopPropagation(); onTagClick(mainTagName); }}
                        title={`Lọc theo: ${mainTagName}`}
                    ></span>
                    <span className={`text-xs font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      {task.title}
                    </span>
                  </div>
                )
              })}
              {visibleTasks.length === 0 && (
                 <div className="p-4 text-xs text-gray-400 text-center">Trống</div>
              )}
           </div>
        </div>

        {/* Right Scrollable Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto custom-scrollbar bg-gray-50/30 dark:bg-gray-900 relative"
        >
           <div style={{ width: `${days.length * COLUMN_WIDTH}px` }}>
              
              {/* Timeline Header (Days) */}
              <div className="flex sticky top-0 z-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" style={{ height: `${HEADER_HEIGHT}px` }}>
                 {days.map(day => (
                   <div 
                     key={day.toString()} 
                     className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center ${isToday(day) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                     style={{ width: `${COLUMN_WIDTH}px` }}
                   >
                     <span className={`text-[10px] font-bold ${isToday(day) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {format(day, 'dd')}
                     </span>
                     <span className="text-[9px] text-gray-400 uppercase">{format(day, 'EE')}</span>
                   </div>
                 ))}
              </div>

              {/* Grid & Bars */}
              <div className="relative">
                 {/* Background Grid Lines */}
                 <div className="absolute inset-0 flex pointer-events-none">
                    {days.map(day => (
                      <div 
                        key={`grid-${day}`}
                        className={`flex-shrink-0 border-r border-dashed border-gray-200 dark:border-gray-800/50 h-full ${isToday(day) ? 'bg-primary-50/30 dark:bg-primary-900/5' : ''}`}
                        style={{ width: `${COLUMN_WIDTH}px` }}
                      ></div>
                    ))}
                 </div>

                 {/* Task Bars */}
                 <div>
                    {visibleTasks.map(task => {
                      const style = getTaskStyle(task);
                      return (
                        <div 
                          key={`bar-${task.id}`}
                          className="relative border-b border-transparent"
                          style={{ height: `${ROW_HEIGHT}px` }}
                        >
                           <div
                             onClick={() => onOpenEditModal(task)}
                             className={`absolute top-2 bottom-2 rounded-md shadow-sm border border-black/5 cursor-pointer hover:brightness-95 transition flex items-center px-2 overflow-hidden whitespace-nowrap ${style.className}`}
                             style={{ left: style.left, width: style.width, backgroundColor: style.backgroundColor }}
                           >
                             {!task.completed && (
                                <span className="text-[10px] font-bold truncate opacity-90">{task.time}</span>
                             )}
                           </div>
                        </div>
                      )
                    })}
                 </div>
              </div>

           </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;